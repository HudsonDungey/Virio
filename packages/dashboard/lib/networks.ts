/// The chains the dashboard can talk to, in one place.
///
/// The dashboard targets ONE chain at a time — `VIRIO_NETWORK` picks it. The
/// subscription and payroll managers are deployed on Ethereum Sepolia; the
/// programmable billing modules target Base Sepolia. Point the dashboard at
/// whichever chain holds the contracts you are working with; the other set
/// simply reads back empty.

import { sepolia, baseSepolia, foundry, type Chain } from "viem/chains";
import type { Network } from "./types";

interface NetworkDef {
  chain: Chain;
  label: string;
  /// Alchemy subdomain, for building an RPC URL from a key. Null for chains we
  /// do not build an Alchemy URL for.
  alchemyHost: string | null;
}

const NETWORKS: Record<Network, NetworkDef> = {
  sepolia: { chain: sepolia, label: "Sepolia", alchemyHost: "eth-sepolia.g.alchemy.com" },
  "base-sepolia": {
    chain: baseSepolia,
    label: "Base Sepolia",
    alchemyHost: "base-sepolia.g.alchemy.com",
  },
  anvil: { chain: foundry, label: "Anvil", alchemyHost: null },
};

export function chainFor(network: Network): Chain {
  return NETWORKS[network].chain;
}

export function chainIdFor(network: Network): number {
  return NETWORKS[network].chain.id;
}

/// "Base Sepolia (84532)" — for the "switch your wallet" error, which is
/// useless without both the name and the id.
export function networkLabel(network: Network): string {
  const def = NETWORKS[network];
  return `${def.label} (${def.chain.id})`;
}

export function alchemyHostFor(network: Network): string | null {
  return NETWORKS[network].alchemyHost;
}

export const ALL_NETWORKS = Object.keys(NETWORKS) as Network[];
