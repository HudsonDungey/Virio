/// Server-side chain client. Reads runtime config (network + RPC URL + contracts +
/// executor key) from `lib/local-config.ts`. Browser components should NOT import this —
/// they should use wagmi hooks + the public config from `<Providers>`.

import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Address,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, foundry } from "viem/chains";
import { getLocalConfig, buildRpcUrl } from "./local-config";
import { managerAbi, payrollAbi, erc20Abi } from "./abis";

const cfg = getLocalConfig();
const rpcUrl = buildRpcUrl(cfg);
const chain: Chain = cfg.network === "anvil" ? foundry : sepolia;

if (cfg.network === "sepolia" && !rpcUrl) {
  // Console warning rather than a throw — lets the app still boot so the user
  // sees "Connect Wallet" + a clear "no RPC configured" error in the UI.
  // eslint-disable-next-line no-console
  console.warn(
    "[pulse] No Alchemy key or rpc.fullUrlOverride set in pulse.local.json / .env.local — Sepolia reads will use viem's default public RPC and likely rate-limit. See pulse.local.example.json.",
  );
}

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl ?? undefined),
});

export const NETWORK = cfg.network;
export const CHAIN = chain;
export const MANAGER_ADDRESS = cfg.contracts.manager as Address;
export const USDC_ADDRESS = cfg.contracts.usdc as Address;
export const FEE_RECIPIENT = cfg.contracts.feeRecipient as Address;
export const PAYROLL_ADDRESS = cfg.contracts.payrollManager as Address;
export const MERCHANT_ADDRESS = cfg.merchant.address as Address;
export const DEPLOYMENT_BLOCK = cfg.deploymentBlock;
export const PAYROLL_DEPLOYMENT_BLOCK = cfg.payrollDeploymentBlock;

/// Addresses surfaced to the UI for dropdowns ("My Merchant", "My Customer Wallet").
/// These are *view-only* — clients sign with their own connected wallet via wagmi.
export interface DisplayAccount {
  name: string;
  address: Address;
}

export const displayAccounts: DisplayAccount[] = [
  { name: cfg.merchant.label, address: cfg.merchant.address },
  ...cfg.testAddresses.map((a) => ({ name: a.label, address: a.address })),
];

/// Server-side wallet for the off-chain scheduler that calls `manager.charge(subId)`.
/// Returns null when no key is configured — callers should fall back gracefully.
export function executorWallet() {
  if (!cfg.executor.privateKey) return null;
  const account = privateKeyToAccount(cfg.executor.privateKey);
  return createWalletClient({ account, chain, transport: http(rpcUrl ?? undefined) });
}

export function executorAddress(): Address | null {
  return cfg.executor.privateKey ? privateKeyToAccount(cfg.executor.privateKey).address : null;
}

export function findDisplayAccount(address: string): DisplayAccount | undefined {
  return displayAccounts.find((a) => a.address.toLowerCase() === address.toLowerCase());
}

export { managerAbi, payrollAbi, erc20Abi };

/// Convert a USDC display amount (e.g. 9.99) to base units (6 decimals).
export function usdcUnits(display: number): bigint {
  return BigInt(Math.round(display * 1_000_000));
}

/// Convert USDC base units back to a display number.
export function usdcDisplay(units: bigint): number {
  return Number(units) / 1_000_000;
}
