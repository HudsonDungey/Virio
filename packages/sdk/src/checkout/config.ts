import type { Address, Chain } from "viem";

import { resolveChain, VIRIO_CONTRACT_ADDRESS, type ChainName } from "../chains.js";
import type { WcConfig } from "./walletconnect.js";

// Virio ships a shared WalletConnect project so a merchant only has to provide
// an RPC URL. Override with `projectId` to use your own WalletConnect Cloud
// project (recommended for production / branded session metadata).
const DEFAULT_PROJECT_ID = "2f05a7cdc2bb8b1f4d6e7c8a9b0c1d2e";

/** What a merchant supplies — only `rpcUrl` is required. */
export interface CheckoutConfigInput {
  rpcUrl: string;
  chain?: ChainName | number;
  contractAddress?: Address;
  projectId?: string;
  appName?: string;
}

/** Fully-resolved config consumed by the controller and bindings. */
export interface ResolvedCheckoutConfig {
  rpcUrl: string;
  chain: Chain;
  contractAddress: Address;
  projectId: string;
  appName: string;
}

export function resolveConfig(input: CheckoutConfigInput): ResolvedCheckoutConfig {
  return {
    rpcUrl: input.rpcUrl,
    chain: resolveChain(input.chain ?? "base"),
    contractAddress: input.contractAddress ?? VIRIO_CONTRACT_ADDRESS,
    projectId: input.projectId ?? DEFAULT_PROJECT_ID,
    appName: input.appName ?? "Virio",
  };
}

/** Narrow the resolved config to the subset the WalletConnect layer needs. */
export function toWcConfig(config: ResolvedCheckoutConfig): WcConfig {
  return {
    projectId: config.projectId,
    chainId: config.chain.id,
    rpcUrl: config.rpcUrl,
    appName: config.appName,
  };
}
