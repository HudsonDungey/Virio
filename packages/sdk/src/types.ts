import type { Address, Hash, Hex } from "viem";

// ─── On-chain structs (mirrors Solidity) ─────────────────────────────────────

export interface Plan {
  merchant: Address;
  token: Address;
  /** Gross amount (fee-inclusive) per charge, in token's smallest unit. */
  amount: bigint;
  /** Minimum seconds between charges. */
  period: bigint;
  /** Hard per-charge cap enforced by the contract. */
  maxAmountPerCharge: bigint;
  /** Protocol fee in basis points (100 = 1 %). */
  feeBps: number;
  active: boolean;
}

export interface Subscription {
  planId: Hex;
  customer: Address;
  /** Unix timestamp of the next allowed charge. */
  nextChargeAt: bigint;
  /** Cumulative gross amount charged so far. */
  totalSpent: bigint;
  /** Opt-in lifetime spend limit; 0n = unlimited. */
  totalSpendCap: bigint;
  active: boolean;
}

// ─── SDK params ──────────────────────────────────────────────────────────────

export interface CreatePlanParams {
  token: Address;
  amount: bigint;
  period: bigint;
  maxAmountPerCharge: bigint;
  feeBps: number;
}

export interface SubscribeParams {
  planId: Hex;
  /** 0n = unlimited */
  totalSpendCap: bigint;
}

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
  /** Net merchant amount in token's smallest unit. */
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
