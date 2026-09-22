import type { Hex } from "viem";
import type { UsageEvent } from "../billing/types.js";

// ─── Usage storage ───────────────────────────────────────────────────────────
//
// Usage lives off-chain: putting an API call on-chain costs far more gas than
// the call is worth. What goes on-chain is a periodic settlement the merchant
// signs. This interface is the seam between the two, and mirrors
// @virio/scheduler's SchedulerStorage so the same shape of adapter works for
// both — swap the in-memory implementation for Postgres, Redis or anything
// else without touching the accumulator.
//
// Three properties an implementation must hold, because the accumulator relies
// on them rather than re-checking:
//   1. `record` is idempotent on idempotencyKey, scoped to the meter.
//   2. `listEvents` returns events in [from, to) — half-open, so consecutive
//      windows can abut without double-counting the boundary second.
//   3. Nonces from `nextNonce` are never reused for a merchant.

export interface UsageQuery {
  authorizationId: Hex;
  meterId: Hex;
  /** Unix seconds, inclusive. */
  from: number;
  /** Unix seconds, exclusive. */
  to: number;
}

export interface UsageStore {
  /**
   * Store one usage event. Returns false when `idempotencyKey` was already
   * seen for this meter — a retry, not an error, and not a second billable
   * unit.
   */
  record(event: UsageEvent): Promise<boolean>;

  /** Events in the half-open window [from, to), oldest first. */
  listEvents(query: UsageQuery): Promise<UsageEvent[]>;

  /** Total units in the window. Equivalent to summing `listEvents`. */
  totalUnits(query: UsageQuery): Promise<bigint>;

  /**
   * A statement nonce for this merchant that has never been issued before.
   * Nonces are burned on-chain, so reusing one makes a statement unsettleable.
   */
  nextNonce(merchant: Hex): Promise<bigint>;
}
