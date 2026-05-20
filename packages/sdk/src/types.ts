import type { Address, Hash, Hex } from "viem";

// ─── On-chain structs (mirror VirioSubscriptionManager.sol) ───────────────────

export interface Plan {
  merchant: Address;
  token: Address;
  /** Gross amount (fee-inclusive) per charge, in the token's smallest unit. */
  amount: bigint;
  /** Minimum seconds between charges. */
  period: bigint;
  active: boolean;
}

export interface Subscription {
  customer: Address;
  merchant: Address;
  token: Address;
  /** Gross amount per charge, denormalised from the plan at subscribe time. */
  amount: bigint;
  /** Seconds between charges, denormalised from the plan at subscribe time. */
  period: bigint;
  /** Unix timestamp of the next allowed charge. */
  nextChargeAt: bigint;
  /** Opt-in lifetime spend limit; 0n = unlimited. */
  totalSpendCap: bigint;
  /** Cumulative gross amount charged so far. */
  totalSpent: bigint;
  active: boolean;
}

// ─── Records (struct + its on-chain id, returned by list helpers) ─────────────

export interface PlanRecord extends Plan {
  /** keccak256(merchant ‖ nonce ‖ chainId). */
  id: Hex;
}

export interface SubscriptionRecord extends Subscription {
  /** keccak256(planId ‖ customer). */
  id: Hex;
  /** The plan this subscription belongs to. */
  planId: Hex;
}

/** A single successful charge, reconstructed from a `ChargeExecuted` log. */
export interface Charge {
  subscriptionId: Hex;
  executor: Address;
  customer: Address;
  /** Total amount pulled from the customer. */
  gross: bigint;
  /** Net amount the merchant received. */
  merchantAmount: bigint;
  executorFee: bigint;
  protocolFee: bigint;
  nextChargeAt: bigint;
  txHash: Hash;
  blockNumber: bigint;
}

/** Protocol-wide fee configuration, read from the contract. */
export interface Fees {
  executorFeeBps: number;
  protocolFeeBps: number;
  protocolFlatFee: bigint;
  feeRecipient: Address;
}

// ─── Call params ──────────────────────────────────────────────────────────────

export interface CreatePlanParams {
  /** Defaults to the configured USDC address when omitted. */
  token?: Address;
  /** Gross amount per charge, in the token's smallest unit (use `usdc(49)`). */
  amount: bigint;
  /** Seconds between charges (use the `PERIOD` constants). */
  period: bigint;
}

export interface SubscribeParams {
  planId: Hex;
  /** Lifetime spend cap; omit or pass 0n for unlimited. */
  totalSpendCap?: bigint;
}

/** Filter passed to `getSubscriptions(address, …)`. */
export type SubscriptionRole = "customer" | "merchant" | "any";

// ─── Webhook types ────────────────────────────────────────────────────────────

export type VirioEventType =
  | "subscription.created"
  | "subscription.charged"
  | "subscription.cancelled"
  | "plan.deactivated";

export interface VirioEvent {
  id: string;
  type: VirioEventType;
  createdAt: number; // unix seconds
  data: SubscriptionChargedData | SubscriptionCreatedData | Record<string, unknown>;
}

export interface SubscriptionChargedData {
  subscriptionId: Hex;
  planId: Hex;
  customer: Address;
  merchant: Address;
  /** Net merchant amount in the token's smallest unit. */
  amount: string;
  fee: string;
  txHash: Hash;
  nextChargeAt: number;
  chainId: number;
}

export interface SubscriptionCreatedData {
  subscriptionId: Hex;
  planId: Hex;
  customer: Address;
  totalSpendCap: string;
  chainId: number;
}
