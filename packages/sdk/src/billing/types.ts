import type { Address, Hash, Hex } from "viem";

// ─── On-chain structs (mirror contracts/src/billing) ─────────────────────────

/** Which billing model an authorization is for. Matches the Solidity enum. */
export type BillingType = "recurring" | "metered" | "hybrid";

/** Numeric encoding used on-chain. Index matches the Solidity enum order. */
export const BILLING_TYPE_VALUES = ["recurring", "metered", "hybrid"] as const;

/**
 * A payer's standing permission for a merchant to pull payments.
 * Every settlement in the protocol is checked against one of these.
 */
export interface Authorization {
  payer: Address;
  merchant: Address;
  token: Address;
  billingType: BillingType;
  /** Largest single settlement. Always > 0n. */
  maxPerCharge: bigint;
  /** Spend ceiling per period; 0n = uncapped within the period. */
  periodSpendCap: bigint;
  /** Lifetime spend ceiling; 0n = uncapped. */
  totalSpendCap: bigint;
  spentThisPeriod: bigint;
  totalSpent: bigint;
  /** Start of the current spend period. Advances additively, never drifts. */
  periodStart: bigint;
  /** Seconds in a spend period; 0n = no period accounting. */
  periodDuration: bigint;
  validAfter: bigint;
  /** Exclusive; 0n = no expiry. */
  validUntil: bigint;
  active: boolean;
}

export interface AuthorizationRecord extends Authorization {
  /** keccak256(payer ‖ nonce ‖ chainId). */
  id: Hex;
}

/** Headroom under each of an authorization's caps, right now. */
export interface AuthorizationRemaining {
  perCharge: bigint;
  /** `null` when the cap is not set (unlimited). */
  thisPeriod: bigint | null;
  lifetime: bigint | null;
}

export interface RecurringPlan {
  merchant: Address;
  token: Address;
  amount: bigint;
  period: bigint;
  active: boolean;
}

export interface RecurringSubscription {
  authorizationId: Hex;
  planId: Hex;
  payer: Address;
  /** Denormalized from the plan at subscribe time. */
  amount: bigint;
  period: bigint;
  nextChargeAt: bigint;
  active: boolean;
}

export interface Meter {
  merchant: Address;
  token: Address;
  /** keccak256 of the unit label; the readable label lives off-chain. */
  unit: Hex;
  /** Price per unit in the token's smallest unit. Immutable once created. */
  unitPrice: bigint;
  /** Units granted free each period — the allowance half of a hybrid plan. */
  includedUnitsPerPeriod: bigint;
  /** Cadence the merchant intends to settle on. Advisory. */
  settlementInterval: bigint;
  active: boolean;
}

/**
 * A merchant's signed assertion of usage, settled on-chain.
 *
 * The signature proves the merchant attested to this usage. It does not prove
 * the usage occurred — see the metered billing docs for the trust model.
 */
export interface MeterStatement {
  meterId: Hex;
  authorizationId: Hex;
  periodStart: bigint;
  periodEnd: bigint;
  units: bigint;
  unitPrice: bigint;
  amount: bigint;
  nonce: bigint;
}

export interface SignedMeterStatement {
  statement: MeterStatement;
  signature: Hex;
}

// ─── Settlement history ──────────────────────────────────────────────────────

/** One movement of money, reconstructed from a registry `Settled` log. */
export interface Settlement {
  authorizationId: Hex;
  module: Address;
  executor: Address;
  gross: bigint;
  merchantAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  periodStart: bigint;
  txHash: Hash;
  blockNumber: bigint;
}

// ─── High-level create params ────────────────────────────────────────────────

/** Stripe-style interval words accepted wherever a cadence is expected. */
export type Interval = "day" | "week" | "month" | "year";

/**
 * Spend limits, in human-readable token amounts ("29.00").
 *
 * `maxPerCharge` is required by the protocol; when omitted the SDK derives the
 * tightest safe value from the billing terms, so a caller never accidentally
 * authorizes an unbounded charge.
 */
export interface BillingLimits {
  maxPerCharge?: string;
  /** Ceiling per period. Aliased as `monthlyCap` when the period is a month. */
  periodCap?: string;
  monthlyCap?: string;
  /** Lifetime ceiling across every period. */
  totalCap?: string;
  /** Period the caps are measured over. Defaults to the billing cadence. */
  period?: Interval;
  /** Authorization expiry. */
  expiresAt?: Date;
  /** Authorization start; defaults to now. */
  startsAt?: Date;
}

export interface CreateRecurringBilling {
  type: "recurring";
  merchant?: Address;
  /** Human-readable amount per charge, e.g. "29.00". */
  amount: string;
  interval: Interval;
  token?: Address;
  limits?: BillingLimits;
  /** Reuse an existing plan instead of creating one. */
  planId?: Hex;
}

export interface MeterTerms {
  /** Readable unit label, e.g. "api_request". Hashed for on-chain storage. */
  unit: string;
  /** Human-readable price per unit, e.g. "0.002". */
  pricePerUnit: string;
  /** Units included free each period. Defaults to 0. */
  includedUnits?: number | bigint;
}

export interface CreateMeteredBilling {
  type: "metered";
  merchant?: Address;
  meter: MeterTerms;
  settlement?: { interval: Interval };
  token?: Address;
  limits?: BillingLimits;
  /** Reuse an existing meter instead of creating one. */
  meterId?: Hex;
}

export interface CreateHybridBilling {
  type: "hybrid";
  merchant?: Address;
  base: { amount: string; interval: Interval };
  usage: MeterTerms;
  token?: Address;
  limits?: BillingLimits;
  planId?: Hex;
  meterId?: Hex;
}

export type CreateBillingParams =
  | CreateRecurringBilling
  | CreateMeteredBilling
  | CreateHybridBilling;

/**
 * What a `billing.create()` produced. The ids present depend on the billing
 * type: recurring has a plan and subscription, metered has a meter, hybrid has
 * all of them — all bound to one authorization.
 */
export interface BillingResult {
  type: BillingType;
  authorizationId: Hex;
  planId?: Hex;
  subscriptionId?: Hex;
  meterId?: Hex;
  transactions: Hash[];
}

// ─── Usage ───────────────────────────────────────────────────────────────────

/**
 * One normalized usage event, as recorded by the off-chain meter.
 * `idempotencyKey` is what makes ingestion safe to retry.
 */
export interface UsageEvent {
  meterId: Hex;
  authorizationId: Hex;
  customer: Address;
  merchant: Address;
  /** Units consumed. Must be a positive integer. */
  quantity: bigint;
  /** Unix seconds. Defaults to now when recording. */
  timestamp: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

/** Input accepted by `usage.record()`; the SDK fills in the rest. */
export interface RecordUsageParams {
  authorizationId: Hex;
  meterId: Hex;
  quantity: number | bigint;
  idempotencyKey: string;
  customer?: Address;
  merchant?: Address;
  timestamp?: number;
  metadata?: Record<string, string>;
}

export interface RecordUsageResult {
  /** False when the idempotency key was already seen — not an error. */
  recorded: boolean;
  event: UsageEvent;
}

/**
 * Accrued usage for one authorization over a period, with the inputs that
 * produced the amount so a payer can audit it rather than trust a total.
 */
export interface UsageSummary {
  authorizationId: Hex;
  meterId: Hex;
  periodStart: number;
  periodEnd: number;
  /** Raw units consumed, before the included allowance. */
  units: bigint;
  /** Units actually billable after the included allowance. */
  billableUnits: bigint;
  unitPrice: bigint;
  /** billableUnits × unitPrice, formatted in the token's decimals. */
  accruedAmount: string;
  /** Period cap from the authorization; null when uncapped. */
  periodCap: string | null;
  remainingCap: string | null;
  eventCount: number;
}
