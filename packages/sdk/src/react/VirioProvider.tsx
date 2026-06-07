"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { Address } from "viem";

import {
  resolveConfig,
  toWcConfig,
  type CheckoutConfigInput,
  type ResolvedCheckoutConfig,
} from "../checkout/config.js";
import {
  connectSession,
  disconnectSession,
  getSession,
  initSession,
  subscribeSession,
} from "../checkout/session.js";
import type { ChainName } from "../chains.js";

export interface VirioProviderProps {
  /** RPC endpoint for the chain the Virio contract is deployed on. Required. */
  rpcUrl: string;
  /** Chain name or id. Defaults to "base". */
  chain?: ChainName | number;
  /** Virio subscription-manager address. Defaults to the canonical deployment. */
  contractAddress?: Address;
  /** WalletConnect Cloud project id. Defaults to Virio's shared project. */
  projectId?: string;
  /** Name shown in the user's wallet during connection. Defaults to "Virio". */
  appName?: string;
  children: ReactNode;
}

const VirioConfigContext = createContext<ResolvedCheckoutConfig | null>(null);

export function VirioProvider({
  rpcUrl,
  chain,
  contractAddress,
  projectId,
  appName,
  children,
}: VirioProviderProps): JSX.Element {
  const config = useMemo<ResolvedCheckoutConfig>(
    () => resolveConfig({ rpcUrl, chain, contractAddress, projectId, appName } satisfies CheckoutConfigInput),
    [rpcUrl, chain, contractAddress, projectId, appName],
  );

  // Restore any persisted WalletConnect session and wire wallet events once.
  // A bad/placeholder projectId or offline relay shouldn't crash the app; the
  // error surfaces in the modal when the user actually clicks.
  useEffect(() => {
    void initSession(toWcConfig(config)).catch((err) => {
      console.warn("Virio: WalletConnect initialisation failed.", err);
    });
  }, [config]);

  return <VirioConfigContext.Provider value={config}>{children}</VirioConfigContext.Provider>;
}

/** Resolved config from the nearest provider. Used by VirioButton. */
export function useVirioConfig(): ResolvedCheckoutConfig {
  const config = useContext(VirioConfigContext);
  if (!config) throw new Error("Virio components must be used within <VirioProvider>.");
  return config;
}

/** Public connection state + actions, backed by the shared session store. */
export interface UseVirio {
  connected: boolean;
  address: string | undefined;
  chainId: number | undefined;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useVirio(): UseVirio {
  const config = useVirioConfig();
  const session = useSyncExternalStore(subscribeSession, getSession, getSession);
  return {
    connected: session.address !== undefined,
    address: session.address,
    chainId: session.chainId,
    connect: async () => {
      await connectSession(toWcConfig(config));
    },
    disconnect: disconnectSession,
  };
}
