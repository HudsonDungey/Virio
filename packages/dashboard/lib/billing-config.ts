/// Addresses and feature flags for the programmable billing stack.
///
/// These are separate from lib/addresses.ts on purpose: the subscription
/// manager and payroll manager are deployed and immutable, while the billing
/// modules are new and target testnet first. Nothing here changes the behaviour
/// of the existing contracts.

import type { Hex } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

function address(name: string, fallback: Hex = ZERO): Hex {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed address, received "${value}"`);
  }
  return value as Hex;
}

function flag(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export const BILLING = {
  authorizationRegistry: address("NEXT_PUBLIC_VIRIO_AUTHORIZATION_REGISTRY"),
  recurringBilling: address("NEXT_PUBLIC_VIRIO_RECURRING_BILLING"),
  meteredBilling: address("NEXT_PUBLIC_VIRIO_METERED_BILLING"),
} as const;

export const BILLING_DEPLOYMENT_BLOCK = BigInt(
  process.env.NEXT_PUBLIC_VIRIO_BILLING_DEPLOYMENT_BLOCK?.trim() || "0",
);

/// Per-module feature flags.
///
/// Recurring and metered default on because both have test coverage and target
/// Base Sepolia first. Hybrid is not a separate deployment — it is a HYBRID
/// authorization settled by the same two modules — so its flag gates the UI,
/// not a contract. Agent delegation and the x402 adapter default OFF: neither
/// has had the security review that shipping them would require.
export const FEATURES = {
  recurringBilling: flag("NEXT_PUBLIC_RECURRING_BILLING_ENABLED", true),
  meteredBilling: flag("NEXT_PUBLIC_METERED_BILLING_ENABLED", true),
  hybridBilling: flag("NEXT_PUBLIC_HYBRID_BILLING_ENABLED", true),
  agentDelegation: flag("NEXT_PUBLIC_AGENT_DELEGATION_ENABLED", false),
  x402Adapter: flag("NEXT_PUBLIC_X402_ADAPTER_ENABLED", false),
} as const;

/// True when every billing address is set. Reads return empty rather than
/// throwing when it is false, so the app boots fine before a deployment.
export function isBillingConfigured(): boolean {
  return (
    BILLING.authorizationRegistry !== ZERO &&
    BILLING.recurringBilling !== ZERO &&
    BILLING.meteredBilling !== ZERO
  );
}
