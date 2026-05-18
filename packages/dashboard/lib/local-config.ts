/// Loader for the gitignored `pulse.local.json` + env vars. Server-only — never import
/// from a client component. Use `lib/public-config.ts` to surface the safe subset to the browser.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PulseLocalConfig, Network } from "./types";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

let cached: PulseLocalConfig | null = null;
let cachedError: string | null = null;

interface RawLocal {
  network?: Network;
  rpc?: { alchemyKey?: string | null; fullUrlOverride?: string | null };
  walletConnectProjectId?: string | null;
  contracts?: {
    manager?: string;
    usdc?: string;
    feeRecipient?: string;
    payrollManager?: string;
    executor?: string;
  };
  deploymentBlock?: number | string | null;
  payrollDeploymentBlock?: number | string | null;
  merchant?: { address?: string; label?: string };
  executor?: { privateKey?: string | null };
  testAddresses?: Array<{ label?: string; address?: string }>;
}

function readRaw(): RawLocal {
  const p = join(process.cwd(), "pulse.local.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as RawLocal;
  } catch (e) {
    cachedError = `Failed to parse pulse.local.json: ${(e as Error).message}`;
    return {};
  }
}

function asHex(v: string | undefined | null, fallback: `0x${string}`): `0x${string}` {
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) return fallback;
  return v as `0x${string}`;
}

function asPk(v: string | undefined | null): `0x${string}` | null {
  if (!v) return null;
  if (!/^0x[0-9a-fA-F]{64}$/.test(v)) return null;
  return v as `0x${string}`;
}

export function getLocalConfig(): PulseLocalConfig {
  if (cached) return cached;
  const raw = readRaw();

  // env wins over JSON for secrets — keeps keys out of files you might commit by mistake.
  const alchemyKey =
    process.env.NEXT_PUBLIC_ALCHEMY_KEY?.trim() || raw.rpc?.alchemyKey?.trim() || null;
  const wcId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ||
    raw.walletConnectProjectId?.trim() ||
    null;
  const execPk = asPk(process.env.EXECUTOR_PRIVATE_KEY ?? raw.executor?.privateKey ?? null);

  cached = {
    network: raw.network ?? "sepolia",
    rpc: {
      alchemyKey: alchemyKey && !alchemyKey.startsWith("REPLACE_") ? alchemyKey : null,
      fullUrlOverride: raw.rpc?.fullUrlOverride ?? null,
    },
    walletConnectProjectId: wcId && !wcId.startsWith("REPLACE_") ? wcId : null,
    contracts: {
      manager: asHex(raw.contracts?.manager, ZERO),
      usdc: asHex(raw.contracts?.usdc, ZERO),
      feeRecipient: asHex(raw.contracts?.feeRecipient, ZERO),
      payrollManager: asHex(raw.contracts?.payrollManager, ZERO),
      executor: asHex(raw.contracts?.executor, ZERO),
    },
    deploymentBlock: raw.deploymentBlock != null ? BigInt(raw.deploymentBlock) : 0n,
    payrollDeploymentBlock:
      raw.payrollDeploymentBlock != null ? BigInt(raw.payrollDeploymentBlock) : 0n,
    merchant: {
      address: asHex(raw.merchant?.address, ZERO),
      label: raw.merchant?.label ?? "My Merchant",
    },
    executor: { privateKey: execPk },
    testAddresses: (raw.testAddresses ?? [])
      .map((a) => ({ label: a.label ?? "Address", address: asHex(a.address, ZERO) }))
      .filter((a) => a.address !== ZERO),
  };
  return cached;
}

export function getConfigLoadError(): string | null {
  return cachedError;
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
    executor: `0x${string}`;
  };
  /// Carried as string for serialization through Next.js RSC — clients parse as needed.
  deploymentBlock: string;
  payrollDeploymentBlock: string;
  merchant: { address: `0x${string}`; label: string };
  testAddresses: Array<{ label: string; address: `0x${string}` }>;
}

export function buildRpcUrl(cfg: PulseLocalConfig): string | null {
  if (cfg.rpc.fullUrlOverride) return cfg.rpc.fullUrlOverride;
  if (!cfg.rpc.alchemyKey) return null;
  const host =
    cfg.network === "sepolia" ? "eth-sepolia.g.alchemy.com" : "eth-mainnet.g.alchemy.com";
  return `https://${host}/v2/${cfg.rpc.alchemyKey}`;
}

export function publicView(cfg: PulseLocalConfig): PublicLocalConfig {
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
