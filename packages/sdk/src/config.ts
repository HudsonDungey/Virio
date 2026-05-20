import { readFileSync, existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import type { Address, Hex } from "viem";
import { resolveChain, type ChainName } from "./chains.js";
import type { ResolvedVirioConfig } from "./Virio.js";

// ─── Config file schema ───────────────────────────────────────────────────────
//
// A Virio config file is JSON. The minimal shape is:
//
//   {
//     "chain": "sepolia",
//     "rpcUrl": "https://sepolia.infura.io/v3/<key>",
//     "contractAddress": "0xManager…"
//   }
//
// For multi-chain setups, use a `chains` map and a `defaultChain`:
//
//   {
//     "defaultChain": "base",
//     "contractAddress": "0xManager…",   // same address on every chain (CREATE2)
//     "account": "0xYourAddress…",
//     "chains": {
//       "base":    { "rpcUrl": "https://…", "usdcAddress": "0x…", "deploymentBlock": 12345 },
//       "sepolia": { "rpcUrl": "https://…" }
//     }
//   }
//
// Secrets (privateKey) and RPC URLs may also be provided via environment
// variables, which always win over the file:
//   VIRIO_PRIVATE_KEY, VIRIO_RPC_URL, VIRIO_CONFIG (path to the config file).

export interface ChainFileConfig {
  rpcUrl?: string;
  usdcAddress?: Address;
  /** Per-chain override of the top-level contractAddress. */
  contractAddress?: Address;
  /** Block to start event scans from (skip scanning pre-deployment history). */
  deploymentBlock?: number | string;
}

export interface VirioFileConfig {
  /** Chain for a single-chain config. Alias of `defaultChain`. */
  chain?: ChainName | string | number;
  /** Selected chain when using the `chains` map. */
  defaultChain?: ChainName | string | number;
  /** Manager contract address, shared across chains unless overridden per-chain. */
  contractAddress?: Address;
  /** Default account used for reads like `getBalance()`. */
  account?: Address;
  /** Server-side signing key. Prefer the VIRIO_PRIVATE_KEY env var instead. */
  privateKey?: Hex | null;
  /** Single-chain shorthands (used when `chains` is omitted). */
  rpcUrl?: string;
  usdcAddress?: Address;
  deploymentBlock?: number | string;
  /** Multi-chain map keyed by friendly chain name. */
  chains?: Record<string, ChainFileConfig>;
}

export interface LoadConfigOptions {
  /** Explicit path to the config file. */
  path?: string;
  /** Override which chain to select from the file's `chains` map. */
  chain?: ChainName | string | number;
}

const DEFAULT_FILENAMES = ["virio.config.json", "virio.local.json", ".viriorc.json"];

/** Locate a Virio config file: explicit path → VIRIO_CONFIG → conventional names in cwd. */
export function findConfigFile(path?: string): string {
  if (path) {
    const abs = resolvePath(process.cwd(), path);
    if (!existsSync(abs)) throw new Error(`Virio: config file not found at ${abs}`);
    return abs;
  }
  const fromEnv = process.env.VIRIO_CONFIG;
  if (fromEnv) {
    const abs = resolvePath(process.cwd(), fromEnv);
    if (!existsSync(abs)) throw new Error(`Virio: VIRIO_CONFIG points to a missing file: ${abs}`);
    return abs;
  }
  for (const name of DEFAULT_FILENAMES) {
    const abs = resolvePath(process.cwd(), name);
    if (existsSync(abs)) return abs;
  }
  throw new Error(
    `Virio: no config file found. Create one of ${DEFAULT_FILENAMES.join(", ")} in ${process.cwd()}, ` +
      `pass { path } to fromConfigFile(), or set the VIRIO_CONFIG env var.`,
  );
}

/** Read + parse a config file into the resolved options the Virio constructor expects. */
export function loadConfig(options: LoadConfigOptions = {}): ResolvedVirioConfig {
  const file = findConfigFile(options.path);
  let raw: VirioFileConfig;
  try {
    raw = JSON.parse(readFileSync(file, "utf8")) as VirioFileConfig;
  } catch (err) {
    throw new Error(`Virio: failed to parse config file ${file}: ${(err as Error).message}`);
  }
  return resolveFileConfig(raw, options.chain, file);
}

/** Resolve an in-memory config object (same merge rules as `loadConfig`, no file IO). */
export function resolveFileConfig(
  raw: VirioFileConfig,
  chainOverride?: ChainName | string | number,
  source = "config",
): ResolvedVirioConfig {
  const chainKey = chainOverride ?? raw.chain ?? raw.defaultChain ?? singleChainKey(raw);
  if (chainKey === undefined) {
    throw new Error(
      `Virio: ${source} must specify a chain ("chain"/"defaultChain", or a single-entry "chains" map).`,
    );
  }

  const perChain: ChainFileConfig =
    (raw.chains && typeof chainKey === "string" && raw.chains[chainKey]) || {};

  const chain = resolveChain(chainKey);

  const contractAddress = perChain.contractAddress ?? raw.contractAddress;
  if (!contractAddress) {
    throw new Error(`Virio: ${source} is missing "contractAddress" (the Virio manager address).`);
  }

  const rpcUrl = process.env.VIRIO_RPC_URL ?? perChain.rpcUrl ?? raw.rpcUrl;
  const usdcAddress = perChain.usdcAddress ?? raw.usdcAddress;
  const deploymentBlockRaw = perChain.deploymentBlock ?? raw.deploymentBlock;
  const privateKey = (process.env.VIRIO_PRIVATE_KEY as Hex | undefined) ?? raw.privateKey ?? undefined;

  return {
    contractAddress,
    chain,
    rpcUrl,
    usdcAddress,
    account: raw.account,
    privateKey: privateKey || undefined,
    deploymentBlock:
      deploymentBlockRaw === undefined ? undefined : BigInt(deploymentBlockRaw),
  };
}

/** If `chains` has exactly one entry, use it implicitly. */
function singleChainKey(raw: VirioFileConfig): string | undefined {
  if (!raw.chains) return undefined;
  const keys = Object.keys(raw.chains);
  return keys.length === 1 ? keys[0] : undefined;
}
