import { mainnet, base, arbitrum } from "viem/chains";
import type { Chain } from "viem";

// ─── Supported chains ─────────────────────────────────────────────────────────
// Same contract address on all chains via CREATE2.

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum] as const;
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];
export type SupportedChainId = SupportedChain["id"];

// Native USDC addresses on each supported chain.
// Source: https://www.circle.com/en/multi-chain-usdc
export const USDC_ADDRESSES: Record<SupportedChainId, `0x${string}`> = {
  [mainnet.id]:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  [base.id]:      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  [arbitrum.id]:  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};

// The deterministic VirioSubscriptionManager address (same on every chain).
// Set after first CREATE2 deployment.
export const VIRIO_CONTRACT_ADDRESS: `0x${string}` =
  "0x0000000000000000000000000000000000000000"; // TODO: update after deployment

export { mainnet, base, arbitrum };
export type { Chain };
