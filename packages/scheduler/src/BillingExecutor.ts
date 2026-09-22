import type { Hex } from "viem";
import type { BillingClient, SignedMeterStatement } from "@virio/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// BillingExecutor
//
// The executor side of programmable billing. One tick discovers work across
// every billing model and submits what is actually settleable:
//
//   recurring / hybrid base  → a due subscription charge
//   metered / hybrid usage   → a signed statement whose window has closed
//
// Before sending anything it reads current chain state and asks the contract
// whether the call would succeed. That is an economic filter, not a safety one:
// double-charge protection, spend caps, replay protection and authorization
// validity are all enforced on-chain. An executor that skipped every check here
// would waste gas, not overcharge anyone.
//
// Two executors racing the same item is expected and safe. The loser's
// transaction reverts because the winner already advanced the state it depended
// on, and `failedSimulation` counts it rather than treating it as an error.
// ─────────────────────────────────────────────────────────────────────────────

export interface BillingExecutorConfig {
  /** A configured SDK billing client with a wallet. */
  billing: BillingClient;
  /** Subscription ids to consider each tick. */
  subscriptions?: Hex[];
  /**
   * Signed statements waiting to settle. Supplying this as a callback rather
   * than a list lets a merchant's metering service hand over statements as it
   * produces them, without the executor holding a queue it cannot refill.
   */
  pendingStatements?: () => Promise<SignedMeterStatement[]>;
  /** Cap on transactions per tick; protects against a runaway backlog. */
  maxPerTick?: number;
  /** Structured log sink. Defaults to console. */
  log?: (record: ExecutorLogRecord) => void;
}

/**
 * One structured log line. Deliberately carries only ids, counts and error
 * selectors — never keys, signatures or customer metadata.
 */
export interface ExecutorLogRecord {
  level: "info" | "warn";
  event:
    | "tick_started"
    | "tick_finished"
    | "charge_submitted"
    | "charge_skipped"
    | "charge_failed"
    | "settlement_submitted"
    | "settlement_skipped"
    | "settlement_failed";
  [key: string]: unknown;
}

/** Counters for one tick. Feed these straight into a metrics backend. */
export interface TickResult {
  recurringDiscovered: number;
  recurringSubmitted: number;
  recurringSkipped: number;
  recurringFailed: number;
  meteredDiscovered: number;
  meteredSubmitted: number;
  meteredSkipped: number;
  meteredFailed: number;
  /** Gross value settled this tick, in the token's smallest unit. */
  grossSettled: bigint;
}

const DEFAULT_MAX_PER_TICK = 25;

export class BillingExecutor {
  private readonly config: BillingExecutorConfig;
  private readonly log: (record: ExecutorLogRecord) => void;
  private readonly maxPerTick: number;

  constructor(config: BillingExecutorConfig) {
    this.config = config;
    this.maxPerTick = config.maxPerTick ?? DEFAULT_MAX_PER_TICK;
    this.log = config.log ?? ((record) => console.log(JSON.stringify(record)));
  }

  /**
   * One pass over all candidates. Safe to call on a timer and safe to run
   * concurrently with other executors — the contracts settle the race.
   */
  async tick(): Promise<TickResult> {
    const result: TickResult = {
      recurringDiscovered: 0,
      recurringSubmitted: 0,
      recurringSkipped: 0,
      recurringFailed: 0,
      meteredDiscovered: 0,
      meteredSubmitted: 0,
      meteredSkipped: 0,
      meteredFailed: 0,
      grossSettled: 0n,
    };

    this.log({ level: "info", event: "tick_started" });
    await this.chargeDueSubscriptions(result);
    await this.settlePendingStatements(result);
    this.log({
      level: "info",
      event: "tick_finished",
      ...result,
      grossSettled: result.grossSettled.toString(),
    });
    return result;
  }

  // ─── Recurring ────────────────────────────────────────────────────────────

  private async chargeDueSubscriptions(result: TickResult): Promise<void> {
    const subscriptions = this.config.subscriptions ?? [];
    result.recurringDiscovered = subscriptions.length;

    let submitted = 0;
    for (const subscriptionId of subscriptions) {
      if (submitted >= this.maxPerTick) break;

      // One eth_call tells us whether the charge is due AND whether the payer's
      // limits still allow it, so we never pay gas to learn the answer.
      const { ok, reason } = await this.config.billing.chargeable(subscriptionId);
      if (!ok) {
        result.recurringSkipped += 1;
        this.log({ level: "info", event: "charge_skipped", subscriptionId, reason });
        continue;
      }

      const subscription = await this.config.billing.getSubscription(subscriptionId);
      try {
        const txHash = await this.config.billing.charge(subscriptionId);
        submitted += 1;
        result.recurringSubmitted += 1;
        result.grossSettled += subscription.amount;
        this.log({ level: "info", event: "charge_submitted", subscriptionId, txHash });
      } catch (error) {
        // Almost always a lost race: another executor charged it first and
        // nextChargeAt moved past now. Nothing to repair.
        result.recurringFailed += 1;
        this.log({
          level: "warn",
          event: "charge_failed",
          subscriptionId,
          error: describeError(error),
        });
      }
    }
  }

  // ─── Metered ──────────────────────────────────────────────────────────────

  private async settlePendingStatements(result: TickResult): Promise<void> {
    if (!this.config.pendingStatements) return;

    const statements = await this.config.pendingStatements();
    result.meteredDiscovered = statements.length;

    let submitted = 0;
    for (const signed of statements) {
      if (submitted >= this.maxPerTick) break;

      const { ok, reason } = await this.config.billing.settleable(signed.statement);
      if (!ok) {
        result.meteredSkipped += 1;
        this.log({
          level: "info",
          event: "settlement_skipped",
          meterId: signed.statement.meterId,
          nonce: signed.statement.nonce.toString(),
          reason,
        });
        continue;
      }

      try {
        const txHash = await this.config.billing.settleStatement(signed);
        submitted += 1;
        result.meteredSubmitted += 1;
        result.grossSettled += signed.statement.amount;
        this.log({
          level: "info",
          event: "settlement_submitted",
          meterId: signed.statement.meterId,
          nonce: signed.statement.nonce.toString(),
          amount: signed.statement.amount.toString(),
          txHash,
        });
      } catch (error) {
        result.meteredFailed += 1;
        this.log({
          level: "warn",
          event: "settlement_failed",
          meterId: signed.statement.meterId,
          nonce: signed.statement.nonce.toString(),
          error: describeError(error),
        });
      }
    }
  }
}

/**
 * A short, log-safe description of a failure. Revert data and RPC messages can
 * be long and can echo call arguments, so they are truncated rather than dumped.
 */
function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0].slice(0, 200);
}
