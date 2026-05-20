"use client";

import * as React from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { buildWagmiConfig } from "@/lib/wagmi";
import type { PublicLocalConfig } from "@/lib/local-config";

export const ConfigContext = React.createContext<PublicLocalConfig | null>(null);

/// Convenience hook for client components that need access to the runtime config
/// (contract addresses, merchant address, network name).
export function useVirioConfig(): PublicLocalConfig {
  const ctx = React.useContext(ConfigContext);
  if (!ctx) throw new Error("useVirioConfig must be used inside <Providers>");
  return ctx;
}

interface Props {
  config: PublicLocalConfig;
  children: React.ReactNode;
}

export function Providers({ config, children }: Props) {
  // Memoize so HMR doesn't churn the wagmi config (each rebuild would reset connectors).
  const wagmiConfig = React.useMemo(() => buildWagmiConfig(config), [config]);
  const [queryClient] = React.useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } }),
  );

  return (
    <ConfigContext.Provider value={config}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#6366f1",
              accentColorForeground: "white",
              borderRadius: "medium",
              fontStack: "system",
            })}
          >
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ConfigContext.Provider>
  );
}
