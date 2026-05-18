import type { Address, Hex } from "viem";
import { keccak256, encodePacked } from "viem";

// ─── USDC convenience ─────────────────────────────────────────────────────────

/** Convert a human-readable USDC amount to its 6-decimal bigint. */
export function usdc(amount: number | string): bigint {
  return BigInt(Math.round(Number(amount) * 1_000_000));
}

// ─── Common periods ───────────────────────────────────────────────────────────

export const PERIOD = {
  DAILY:    86_400n,
  WEEKLY:   604_800n,
  MONTHLY:  2_592_000n,  // 30 days
  ANNUALLY: 31_536_000n, // 365 days
} as const;

// ─── ID computation (mirrors Solidity) ───────────────────────────────────────

/**
 * Compute the deterministic subscription id for a (plan, customer) pair.
 * Mirrors: keccak256(abi.encodePacked(planId, customer))
 */
export function computeSubscriptionId(planId: Hex, customer: Address): Hex {
  return keccak256(encodePacked(["bytes32", "address"], [planId, customer]));
}

/**
 * Compute the deterministic paymentId used by PulseExecutor.
 * Mirrors: keccak256(abi.encodePacked(manager, innerId, block.chainid))
 *
 * `innerId` is the subscriptionId (for the subscription manager) or the
 * recipientId (for the payroll manager).
 */
export function computePaymentId(
  manager: Address,
  innerId: Hex,
  chainId: number | bigint,
): Hex {
  return keccak256(
    encodePacked(
      ["address", "bytes32", "uint256"],
      [manager, innerId, BigInt(chainId)],
    ),
  );
}
