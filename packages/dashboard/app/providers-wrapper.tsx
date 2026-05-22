"use client";

import dynamic from "next/dynamic";
import type { PublicLocalConfig } from "@/lib/local-config";

/// Client-only mount point for the wallet provider tree.
/// `next/dynamic({ ssr: false })` keeps wagmi + RainbowKit + MetaMask SDK +
/// WalletConnect out of every SSR render — they're useless before the user
/// connects a wallet anyway, and SSR'ing them per prerendered route was
/// blowing past Vercel's build-time memory cap.
const Providers = dynamic(() => import("./providers").then((m) => m.Providers), {
  ssr: false,
});

interface Props {
  config: PublicLocalConfig;
  children: React.ReactNode;
}

export function ProvidersWrapper({ config, children }: Props) {
  return <Providers config={config}>{children}</Providers>;
}
