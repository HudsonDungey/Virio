import { type Hex } from "viem";
import {
  VirioClient,
  VIRIO_ABI,
  buildEvent,
  signWebhook,
  type SubscriptionChargedData,
} from "@virio/sdk";
import type { SchedulerStorage } from "./storage.js";

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  storage: SchedulerStorage;
  /**
   * One VirioClient per chain.  Key is the chainId.
   * Each client must have a walletClient set (used to call charge()).
   */
  clients: Record<number, VirioClient>;
  /**
   * Called with the raw event payload and signature so the caller can
   * POST them to the merchant's webhook URL.  Defaults to a fetch()-based
   * dispatcher if not provided.
   */
  dispatch?: (url: string, payload: string, signature: string) => Promise<void>;
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

export class Scheduler {
  private readonly storage: SchedulerStorage;
  private readonly clients: Record<number, VirioClient>;
  private readonly dispatch: (url: string, payload: string, signature: string) => Promise<void>;

  constructor(config: SchedulerConfig) {
    this.storage  = config.storage;
    this.clients  = config.clients;
    this.dispatch = config.dispatch ?? defaultDispatch;
  }

  /**
   * Single scheduler tick.  Find all due subscriptions and charge them.
   *
   * Call this on a cron (e.g. every 60 s).  The contract enforces timing
   * on-chain so duplicate calls are safe — they will revert with
   * TooEarlyToCharge, not double-charge the customer.
   */
  async tick(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const due = await this.storage.getDueSubscriptions(now);

    await Promise.allSettled(due.map((sub) => this.chargeSub(sub)));
  }

  private async chargeSub(sub: import("./storage.js").StoredSubscription): Promise<void> {
    const client = this.clients[sub.chainId];
    if (!client) {
      console.error(`[Scheduler] No client for chainId=${sub.chainId}`);
      return;
    }

    let txHash: Hex;
    try {
      txHash = await client.charge(sub.subscriptionId) as Hex;
    } catch (err) {
      // The contract reverted — log and skip; don't crash the scheduler.
      // Callers should monitor for repeated failures and surface to merchants.
      console.error(`[Scheduler] charge failed for ${sub.subscriptionId}:`, err);
      return;
    }

    // Read the Charged event from the receipt to get the canonical nextChargeAt.
    // We rely on the contract's value, not our local clock, to avoid drift.
    const onChainNextChargeAt = await this.extractNextChargeAt(client, txHash, sub.subscriptionId);
    await this.storage.updateNextChargeAt(sub.subscriptionId, onChainNextChargeAt);

    // Build and dispatch webhook
    const eventData: SubscriptionChargedData = {
      subscriptionId: sub.subscriptionId,
      planId:         sub.planId,
      customer:       sub.customer,
      merchant:       sub.merchant,
      amount:         sub.amount,
      fee:            "0", // enriched from receipt in a future version
      txHash,
      nextChargeAt:   onChainNextChargeAt,
      chainId:        sub.chainId,
    };

    const event   = buildEvent("subscription.charged", eventData);
    const payload = JSON.stringify(event);
    const sig     = signWebhook(payload, sub.webhookSecret);

    try {
      await this.dispatch(sub.webhookUrl, payload, sig);
    } catch (err) {
      // Webhook dispatch failure must not block the scheduler or trigger a retry
      // on the charge itself — the charge already succeeded on-chain.
      console.error(`[Scheduler] webhook dispatch failed for ${sub.subscriptionId}:`, err);
    }
  }

  private async extractNextChargeAt(
    client: VirioClient,
    txHash: Hex,
    subscriptionId: Hex,
  ): Promise<number> {
    try {
      // Access publicClient via the client's internal pub; we expose it here
      // by reading the subscription state from chain instead.
      const sub = await client.getSubscription(subscriptionId);
      return Number(sub.nextChargeAt);
    } catch {
      // Fallback: we couldn't read the chain; estimate locally.
      return Math.floor(Date.now() / 1000) + 86_400;
    }
  }
}

// ─── Default dispatcher ───────────────────────────────────────────────────────

async function defaultDispatch(url: string, payload: string, sig: string): Promise<void> {
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-virio-signature": sig,
    },
    body: payload,
  });
  if (!res.ok) {
    throw new Error(`Webhook delivery failed: HTTP ${res.status} from ${url}`);
  }
}
