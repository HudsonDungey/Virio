import { type Address, type Hex } from "viem";
import {
  PulseClient,
  buildEvent,
  signWebhook,
  type SubscriptionChargedData,
} from "@pulse/sdk";
import type { SchedulerStorage, StoredSubscription } from "./storage.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  storage: SchedulerStorage;
  /**
   * One PulseClient per chainId. Each client must have a walletClient set —
   * that wallet is the bot's identity (msg.sender) and the payee that earns
   * the executor fee.
   */
  clients: Record<number, PulseClient>;
  /**
   * Deployed PulseExecutor contract address per chainId. The bot dispatches
   * `execute(paymentId)` against this address. Must match the trustedExecutor
   * configured on each manager.
   */
  executorAddresses: Record<number, Address>;
  /**
   * If the number of due subscriptions on a given chain is at least this big,
   * the scheduler dispatches a single executeBatch tx for that chain instead
   * of one per payment. Defaults to 3.
   */
  batchThreshold?: number;
  /**
   * Called with the raw event payload and signature so the caller can POST
   * them to the merchant's webhook URL. Defaults to a fetch()-based dispatcher.
   */
  dispatch?: (url: string, payload: string, signature: string) => Promise<void>;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  private readonly storage: SchedulerStorage;
  private readonly clients: Record<number, PulseClient>;
  private readonly executorAddresses: Record<number, Address>;
  private readonly batchThreshold: number;
  private readonly dispatch: (url: string, payload: string, signature: string) => Promise<void>;

  constructor(config: SchedulerConfig) {
    this.storage           = config.storage;
    this.clients           = config.clients;
    this.executorAddresses = config.executorAddresses;
    this.batchThreshold    = config.batchThreshold ?? 3;
    this.dispatch          = config.dispatch ?? defaultDispatch;
  }

  /**
   * Single scheduler tick. Find all due subscriptions and execute them via
   * the PulseExecutor router.
   *
   * Call this on a cron (e.g. every 60 s). The contract enforces timing
   * on-chain so duplicate calls are safe — the executor records them as
   * failures (PaymentNotDue) rather than double-charging the customer.
   *
   * Per-chain due lists are processed in parallel; within a chain the bot
   * EITHER batches into a single executeBatch tx (when len ≥ batchThreshold)
   * OR runs them sequentially oldest-first (older = higher fee).
   */
  async tick(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const due = await this.storage.getDueSubscriptions(now);
    if (due.length === 0) return;

    // Bucket by chain so we can choose batch vs. sequential per chain.
    const byChain = new Map<number, StoredSubscription[]>();
    for (const sub of due) {
      const arr = byChain.get(sub.chainId) ?? [];
      arr.push(sub);
      byChain.set(sub.chainId, arr);
    }

    await Promise.allSettled(
      Array.from(byChain.entries()).map(([chainId, subs]) =>
        this.processChain(chainId, subs, now),
      ),
    );
  }

  private async processChain(
    chainId: number,
    subs: StoredSubscription[],
    nowSec: number,
  ): Promise<void> {
    const client          = this.clients[chainId];
    const executorAddress = this.executorAddresses[chainId];
    if (!client) {
      console.error(`[Scheduler] no client for chainId=${chainId}`);
      return;
    }
    if (!executorAddress) {
      console.error(`[Scheduler] no executor address for chainId=${chainId}`);
      return;
    }

    // Process the oldest (most overdue → highest dynamic fee) first. The
    // executor's linear ramp tops out at 0.30% after 2 days overdue.
    subs.sort((a, b) => a.nextChargeAt - b.nextChargeAt);

    if (subs.length >= this.batchThreshold) {
      await this.executeBatch(client, executorAddress, subs, nowSec);
    } else {
      for (const sub of subs) {
        await this.executeOne(client, executorAddress, sub, nowSec);
      }
    }
  }

  private async executeOne(
    client: PulseClient,
    executorAddress: Address,
    sub: StoredSubscription,
    nowSec: number,
  ): Promise<void> {
    const ageSeconds = Math.max(0, nowSec - sub.nextChargeAt);

    let txHash: Hex;
    try {
      txHash = (await client.executePayment(executorAddress, sub.paymentId)) as Hex;
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      // Most reverts here mean contention loss (another keeper already
      // executed this period) or transient network issues. Don't crash —
      // the scheduler keeps running; failures show up via on-chain events.
      console.error(
        `[Scheduler] execute failed sub=${sub.subscriptionId.slice(0, 10)}… ` +
          `paymentId=${sub.paymentId.slice(0, 10)}… age=${fmtAge(ageSeconds)} :: ${msg.slice(0, 160)}`,
      );
      return;
    }

    // Pull the new scheduledAt from chain (canonical) and update storage.
    const newScheduledAt = await this.extractNextChargeAt(client, sub.subscriptionId);
    await this.storage.updateNextChargeAt(sub.subscriptionId, newScheduledAt);

    await this.dispatchWebhook(sub, txHash, newScheduledAt);
  }

  private async executeBatch(
    client: PulseClient,
    executorAddress: Address,
    subs: StoredSubscription[],
    nowSec: number,
  ): Promise<void> {
    const paymentIds = subs.map((s) => s.paymentId);
    const oldest = nowSec - subs[0].nextChargeAt;
    const newest = nowSec - subs[subs.length - 1].nextChargeAt;

    let txHash: Hex;
    try {
      txHash = (await client.executePaymentsBatch(executorAddress, paymentIds)) as Hex;
      console.log(
        `[Scheduler] batch executed n=${subs.length} oldest=${fmtAge(oldest)} newest=${fmtAge(newest)} tx=${txHash.slice(0, 10)}…`,
      );
    } catch (err) {
      console.error(
        `[Scheduler] batch execute failed n=${subs.length}: ${(err as Error).message?.slice(0, 160)}`,
      );
      return;
    }

    // Per-payment outcomes (success vs. fail) are emitted as
    // ExecutionSucceeded / ExecutionFailed events from the executor. We
    // re-read each sub's current scheduledAt from chain to update storage —
    // failed ones won't have advanced.
    await Promise.allSettled(
      subs.map(async (sub) => {
        const newScheduledAt = await this.extractNextChargeAt(client, sub.subscriptionId);
        if (newScheduledAt > sub.nextChargeAt) {
          await this.storage.updateNextChargeAt(sub.subscriptionId, newScheduledAt);
          await this.dispatchWebhook(sub, txHash, newScheduledAt);
        }
      }),
    );
  }

  private async dispatchWebhook(
    sub: StoredSubscription,
    txHash: Hex,
    nextChargeAt: number,
  ): Promise<void> {
    const eventData: SubscriptionChargedData = {
      subscriptionId: sub.subscriptionId,
      planId:         sub.planId,
      customer:       sub.customer,
      merchant:       sub.merchant,
      amount:         sub.amount,
      fee:            "0", // enriched from receipt in a future version
      txHash,
      nextChargeAt,
      chainId:        sub.chainId,
    };

    const event   = buildEvent("subscription.charged", eventData);
    const payload = JSON.stringify(event);
    const sig     = signWebhook(payload, sub.webhookSecret);

    try {
      await this.dispatch(sub.webhookUrl, payload, sig);
    } catch (err) {
      // Webhook delivery failure must not retry the on-chain execution —
      // the charge already succeeded.
      console.error(
        `[Scheduler] webhook dispatch failed for ${sub.subscriptionId.slice(0, 10)}…:`,
        err,
      );
    }
  }

  private async extractNextChargeAt(
    client: PulseClient,
    subscriptionId: Hex,
  ): Promise<number> {
    try {
      const sub = await client.getSubscription(subscriptionId);
      return Number(sub.nextChargeAt);
    } catch {
      // Fallback: chain read failed; conservative future timestamp so we don't
      // immediately retry. Real value will sync on the next successful call.
      return Math.floor(Date.now() / 1000) + 86_400;
    }
  }
}

function fmtAge(seconds: number): string {
  if (seconds < 60)      return `${seconds}s`;
  if (seconds < 3_600)   return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400)  return `${Math.floor(seconds / 3_600)}h`;
  return `${Math.floor(seconds / 86_400)}d`;
}

// ─── Default dispatcher ───────────────────────────────────────────────────────

async function defaultDispatch(url: string, payload: string, sig: string): Promise<void> {
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-pulse-signature": sig,
    },
    body: payload,
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: HTTP ${res.status} from ${url}`);
  }
}
