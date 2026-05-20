import type { Address, Hex } from "viem";
import { keccak256, encodePacked } from "viem";

// ─── USDC convenience (6 decimals) ────────────────────────────────────────────

const USDC_DECIMALS = 6;

/** Convert a human-readable USDC amount to its 6-decimal bigint: `usdc(49) -> 49000000n`. */
export function usdc(amount: number | string): bigint {
  return parseUnits(amount, USDC_DECIMALS);
}

/** Convert a 6-decimal USDC bigint back to a human number: `fromUsdc(49000000n) -> 49`. */
export function fromUsdc(units: bigint): number {
  return Number(units) / 10 ** USDC_DECIMALS;
}

/** Format a USDC bigint as a fixed-2 string: `formatUsdc(49000000n) -> "49.00"`. */
export function formatUsdc(units: bigint): string {
  return fromUsdc(units).toFixed(2);
}

/** Generic decimal → bigint conversion (no float drift for typical inputs). */
export function parseUnits(amount: number | string, decimals: number): bigint {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const sign = whole.trim().startsWith("-") ? -1n : 1n;
  const wholeDigits = whole.replace("-", "") || "0";
  return sign * (BigInt(wholeDigits) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0"));
}

/** Generic bigint → decimal string conversion. */
export function formatUnits(units: bigint, decimals: number): string {
  const neg = units < 0n;
  const abs = neg ? -units : units;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

// ─── Common periods (seconds) ─────────────────────────────────────────────────

export const PERIOD = {
  MINUTE:   60n,
  HOURLY:   3_600n,
  DAILY:    86_400n,
  WEEKLY:   604_800n,
  MONTHLY:  2_592_000n,  // 30 days
  ANNUALLY: 31_536_000n, // 365 days
} as const;

/** Map a Stripe-style interval word to its period in seconds. */
export function intervalToPeriod(interval: "day" | "week" | "month" | "year"): bigint {
  switch (interval) {
    case "day":   return PERIOD.DAILY;
    case "week":  return PERIOD.WEEKLY;
    case "month": return PERIOD.MONTHLY;
    case "year":  return PERIOD.ANNUALLY;
  }
}

// ─── ID computation (mirrors Solidity) ───────────────────────────────────────

/**
 * Compute the deterministic subscription id for a (plan, customer) pair.
 * Mirrors `keccak256(abi.encodePacked(planId, customer))` in the contract.
 */
export function computeSubscriptionId(planId: Hex, customer: Address): Hex {
  return keccak256(encodePacked(["bytes32", "address"], [planId, customer]));
}
