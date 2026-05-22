/// Loader for RPC + wallet-connect + executor settings. Server-only — never import
/// from a client component. Addresses live in `lib/addresses.ts`.

import type { Network, VirioLocalConfig } from "./types";
import {
  CONTRACTS,
  DEPLOYMENT_BLOCK,
  MERCHANT,
  NETWORK,
  PAYROLL_DEPLOYMENT_BLOCK,
  TEST_ADDRESSES,
} from "./addresses";

let cached: VirioLocalConfig | null = null;

function asPk(v: string | undefined | null): `0x${string}` | null {
  if (!v) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) return null;
  return v as `0x${string}`;
}

export function getLocalConfig(): VirioLocalConfig {
  if (cached) return cached;
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY?.trim() || null;
  const fullUrlOverride = process.env.VIRIO_RPC_URL?.trim() || null;
  const wcId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || null;
  const execPk = asPk(process.env.EXECUTOR_PRIVATE_KEY ?? null);

  cached = {
    network: (process.env.VIRIO_NETWORK?.trim() as "sepolia" | "anvil" | undefined) ?? NETWORK,
    rpc: {
      alchemyKey,
      fullUrlOverride,
    },
    walletConnectProjectId: wcId,
    contracts: CONTRACTS,
    deploymentBlock: DEPLOYMENT_BLOCK,
    payrollDeploymentBlock: PAYROLL_DEPLOYMENT_BLOCK,
    merchant: MERCHANT,
    executor: { privateKey: execPk },
    testAddresses: [...TEST_ADDRESSES],
  };
  return cached;
}

export function getConfigLoadError(): string | null {
  return null;
}

/// Subset of the local config safe to expose to the browser (no private keys).
export interface PublicLocalConfig {
  network: Network;
  rpcUrl: string | null;
  walletConnectProjectId: string | null;
  contracts: {
    manager: `0x${string}`;
    usdc: `0x${string}`;
    feeRecipient: `0x${string}`;
    payrollManager: `0x${string}`;
    delegate: `0x${string}`;
  };
  /// Carried as string for serialization through Next.js RSC — clients parse as needed.
  deploymentBlock: string;
  payrollDeploymentBlock: string;
  merchant: { address: `0x${string}`; label: string };
  testAddresses: Array<{ label: string; address: `0x${string}` }>;
}

export function buildRpcUrl(cfg: VirioLocalConfig): string | null {
  if (cfg.rpc.fullUrlOverride) return cfg.rpc.fullUrlOverride;
  if (!cfg.rpc.alchemyKey) return null;
  const host =
    cfg.network === "sepolia" ? "eth-sepolia.g.alchemy.com" : "eth-mainnet.g.alchemy.com";
  return `https://${host}/v2/${cfg.rpc.alchemyKey}`;
}

export function publicView(cfg: VirioLocalConfig): PublicLocalConfig {
  return {
    network: cfg.network,
    rpcUrl: buildRpcUrl(cfg),
    walletConnectProjectId: cfg.walletConnectProjectId,
    contracts: cfg.contracts,
    deploymentBlock: cfg.deploymentBlock.toString(),
    payrollDeploymentBlock: cfg.payrollDeploymentBlock.toString(),
    merchant: cfg.merchant,
    testAddresses: cfg.testAddresses,
  };
}
