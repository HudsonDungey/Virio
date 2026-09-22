/// Shared setup for the examples. Kept here rather than repeated three times,
/// but deliberately thin — each example still shows its own billing calls in
/// full, because those are the part you are reading the example for.

import { createPublicClient, createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { Virio, usdcAddressFor } from "@virio/sdk";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required — see examples/README.md`);
  return value;
}

export const RPC_URL = process.env.VIRIO_RPC_URL ?? "https://sepolia.base.org";

export const BILLING = {
  authorizationRegistry: required("VIRIO_AUTHORIZATION_REGISTRY") as Address,
  recurringBilling: required("VIRIO_RECURRING_BILLING") as Address,
  meteredBilling: required("VIRIO_METERED_BILLING") as Address,
};

/// USDC on Base Sepolia, unless overridden for a local deployment.
export const TOKEN = (process.env.VIRIO_USDC_ADDRESS as Address) ?? usdcAddressFor(baseSepolia.id)!;

export const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

/// A Virio client signing as one party. Examples build two: merchant and payer.
export function clientFor(privateKeyEnv: string): Virio {
  const account = privateKeyToAccount(required(privateKeyEnv) as Hex);
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
  return new Virio({
    contractAddress: BILLING.recurringBilling, // unused by the billing surface
    chain: baseSepolia,
    rpcUrl: RPC_URL,
    usdcAddress: TOKEN,
    walletClient,
    billing: BILLING,
  });
}

export function addressOf(privateKeyEnv: string): Address {
  return privateKeyToAccount(required(privateKeyEnv) as Hex).address;
}

/// Print the numbers a customer actually cares about: what is left to spend.
export async function printBudget(virio: Virio, authorizationId: Hex, label: string) {
  const [authorization, remaining] = await Promise.all([
    virio.billing.getAuthorization(authorizationId),
    virio.billing.remaining(authorizationId),
  ]);
  const decimals = await virio.billing.tokenDecimals();
  const fmt = (v: bigint | null) =>
    v === null ? "uncapped" : `$${(Number(v) / 10 ** decimals).toFixed(2)}`;

  console.log(`\n  ${label}`);
  console.log(`    spent this period : ${fmt(authorization.spentThisPeriod)}`);
  console.log(`    remaining         : ${fmt(remaining.thisPeriod)}`);
  console.log(`    max per charge    : ${fmt(remaining.perCharge)}`);
  console.log(`    active            : ${authorization.active}`);
}

/// The payer must approve the registry before any charge can pull funds.
/// Authorizing sets limits; the ERC-20 approval is what actually allows a
/// transfer. Both are required, and neither implies the other.
export async function approveRegistry(virio: Virio, amount: bigint) {
  console.log("  approving the authorization registry on USDC…");
  await virio.approve(amount, TOKEN, BILLING.authorizationRegistry);
}
