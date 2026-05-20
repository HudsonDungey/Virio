import {
  mainnet,
  base,
  arbitrum,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  foundry,
} from "viem/chains";
import type { Address, Chain } from "viem";

// ─── Chain registry ────────────────────────────────────────────────────────────
// The Virio contract is deployed at the same address on every chain via CREATE2,
// so an SDK instance only needs to know *which* chain it is talking to.

/** Friendly chain names accepted in config files and the `chain` option. */
export const CHAINS = {
  mainnet,
  base,
  arbitrum,
  sepolia,
  "base-sepolia": baseSepolia,
  baseSepolia,
  "arbitrum-sepolia": arbitrumSepolia,
  arbitrumSepolia,
  // Local dev nodes (anvil / hardhat both use chain id 31337).
  anvil: foundry,
  foundry,
  hardhat: foundry,
  localhost: foundry,
} as const;

export type ChainName = keyof typeof CHAINS;

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, sepolia] as const;

/**
 * Resolve a chain from a viem `Chain` object, a friendly name, or a chain id.
 * Throws a helpful error if it can't be resolved.
 */
export function resolveChain(chain: Chain | ChainName | string | number): Chain {
  if (typeof chain === "object" && chain !== null && "id" in chain) return chain;

  if (typeof chain === "string") {
    const match = (CHAINS as Record<string, Chain>)[chain];
    if (match) return match;
    throw new Error(
      `Virio: unknown chain "${chain}". Supported names: ${Object.keys(CHAINS).join(", ")}, ` +
        `or pass a viem Chain object / chain id.`,
    );
  }

  // numeric chain id
  const byId = Object.values(CHAINS).find((c) => c.id === chain);
  if (byId) return byId;
  throw new Error(`Virio: unknown chain id ${chain}. Pass a viem Chain object instead.`);
}

// ─── Native USDC addresses ───────────────────────────────────────────────────
// Source: https://www.circle.com/multi-chain-usdc . Local chains have no canonical
// USDC — supply `usdcAddress` in your Virio config for those.
export const USDC_ADDRESSES: Record<number, Address> = {
  [mainnet.id]:         "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]:            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [arbitrum.id]:        "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  [sepolia.id]:         "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  [baseSepolia.id]:     "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  [arbitrumSepolia.id]: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
};

/** Look up the canonical USDC address for a chain id, if known. */
export function usdcAddressFor(chainId: number): Address | undefined {
  return USDC_ADDRESSES[chainId];
}

/**
 * The deterministic VirioSubscriptionManager address (same on every chain via
 * CREATE2). Left as the zero address until the first deployment — always set
 * `contractAddress` explicitly in your config.
 */
export const VIRIO_CONTRACT_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000";

export { mainnet, base, arbitrum, sepolia, baseSepolia, arbitrumSepolia, foundry };
export type { Chain };
