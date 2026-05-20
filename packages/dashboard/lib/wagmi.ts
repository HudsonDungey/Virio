"use client";

import { http, createConfig, type Config } from "wagmi";
import { mainnet, sepolia, foundry } from "wagmi/chains";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  injectedWallet,
  coinbaseWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import type { PublicLocalConfig } from "./local-config";

/// Build the wagmi config from the runtime public config. Called once in the providers tree.
export function buildWagmiConfig(publicCfg: PublicLocalConfig): Config {
  const primary = publicCfg.network === "anvil" ? foundry : sepolia;
  const rpcUrl = publicCfg.rpcUrl ?? undefined;

  const connectors = connectorsForWallets(
    [
      {
        groupName: "Recommended",
        wallets: [
          metaMaskWallet,
          rainbowWallet,
          injectedWallet,
          coinbaseWallet,
          ...(publicCfg.walletConnectProjectId ? [walletConnectWallet] : []),
        ],
      },
    ],
    {
      appName: "Virio",
      // RainbowKit requires SOMETHING here; if the user hasn't set up WC yet, use a
      // placeholder. WalletConnect-based connections will fail with a clear error
      // until they paste a real id, but MetaMask / injected / Coinbase still work.
      projectId: publicCfg.walletConnectProjectId ?? "virio-dev-placeholder",
    },
  );

  // We list all three chains so the union of chain IDs in the wagmi types is stable.
  // The user's selected `primary` gets the Alchemy URL; the rest use viem defaults.
  return createConfig({
    chains: [primary, sepolia, mainnet, foundry],
    connectors,
    transports: {
      [sepolia.id]: http(primary.id === sepolia.id ? rpcUrl : undefined),
      [mainnet.id]: http(),
      [foundry.id]: http(primary.id === foundry.id ? rpcUrl : "http://127.0.0.1:8545"),
    },
    ssr: true,
  });
}
