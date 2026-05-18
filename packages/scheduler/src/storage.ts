import type { Hex } from "viem";

// ─── Stored subscription record ───────────────────────────────────────────────

export interface StoredSubscription {
  subscriptionId: Hex;
  /**
   * Deterministic PulseExecutor payment id for this subscription:
   *   keccak256(managerAddress, subscriptionId, chainId)
   * The bot dispatches via `executor.execute(paymentId)` rather than the old
   * `manager.charge(subId)`. Computed once at upsert time and cached so the
   * scheduler doesn't recompute it every tick.
   */
  paymentId: Hex;
  /** Subscription manager contract address this sub lives on. */
  manager: `0x${string}`;
  planId: Hex;
  /** Address of the subscriber. */
  customer: `0x${string}`;
  /** Address of the plan's merchant (denormalised for fast webhook dispatch). */
  merchant: `0x${string}`;
  /** ERC-20 token address for the plan. */
  token: `0x${string}`;
  /** The chain this subscription lives on. */
  chainId: number;
  /** Gross amount per charge in token's smallest unit (stored as string to avoid JSON bigint loss). */
  amount: string;
  /** Webhook URL to notify after a successful charge. */
  webhookUrl: string;
  /** Shared HMAC secret for this merchant's webhooks. */
  webhookSecret: string;
  /**
   * Unix timestamp (seconds) of the next allowed charge. Field name kept for
   * back-compat — it's the same value as PulseExecutor's `scheduledAt`.
   */
  nextChargeAt: number;
  /** Whether this subscription is still active. */
  active: boolean;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SchedulerStorage {
  /**
   * Upsert a subscription record.  Called after Subscribed / Charged events
   * are observed on-chain.
   */
  upsertSubscription(sub: StoredSubscription): Promise<void>;

  /**
   * Return all active subscriptions whose nextChargeAt ≤ nowSeconds.
   * The scheduler calls this on every tick.
   */
  getDueSubscriptions(nowSeconds: number): Promise<StoredSubscription[]>;

  /** Update nextChargeAt after a successful charge. */
  updateNextChargeAt(subscriptionId: Hex, nextChargeAt: number): Promise<void>;

  /** Mark a subscription inactive (e.g. after on-chain Cancelled event). */
  deactivate(subscriptionId: Hex): Promise<void>;
}
