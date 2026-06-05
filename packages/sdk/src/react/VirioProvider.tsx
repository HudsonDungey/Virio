"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Address, Chain } from "viem";

import { resolveChain, VIRIO_CONTRACT_ADDRESS, type ChainName } from "../chains.js";
import {
  getWcProvider,
  wcConnect,
  wcDisconnect,
  wcSwitchChain,
  type WcConfig,
  type WcProvider,
} from "./walletconnect.js";

// Virio ships a shared WalletConnect project so a merchant only has to provide
// an RPC URL. Override with the `projectId` prop to use your own WalletConnect
// Cloud project (recommended for production / branded session metadata).
const DEFAULT_PROJECT_ID = "2f05a7cdc2bb8b1f4d6e7c8a9b0c1d2e";

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

/** Full internal context — consumed by VirioButton / VirioModal. */
interface VirioContextValue {
  rpcUrl: string;
  chain: Chain;
  contractAddress: Address;
  connected: boolean;
  address: Address | undefined;
  chainId: number | undefined;
  connect: (onDisplayUri?: (uri: string) => void) => Promise<{ address: Address; chainId: number }>;
  disconnect: () => Promise<void>;
  switchChain: (chainId: number) => Promise<void>;
  getProvider: () => Promise<WcProvider>;
}

const VirioContext = createContext<VirioContextValue | null>(null);

export function VirioProvider({
  rpcUrl,
  chain,
  contractAddress,
  projectId,
  appName,
  children,
}: VirioProviderProps): JSX.Element {
  const resolvedChain = useMemo(() => resolveChain(chain ?? "base"), [chain]);
  const resolvedContract = contractAddress ?? VIRIO_CONTRACT_ADDRESS;

  const config = useMemo<WcConfig>(
    () => ({
      projectId: projectId ?? DEFAULT_PROJECT_ID,
      chainId: resolvedChain.id,
      rpcUrl,
      appName: appName ?? "Virio",
    }),
    [projectId, resolvedChain.id, rpcUrl, appName],
  );

  const [address, setAddress] = useState<Address>();
  const [chainId, setChainId] = useState<number>();

  // Restore any persisted WalletConnect session on mount and keep local state
  // in sync with the wallet (account/chain switches, disconnects).
  useEffect(() => {
    let active = true;
    let provider: WcProvider | null = null;

    const onAccounts = (accounts: string[]): void => {
      if (active) setAddress((accounts[0] as Address) ?? undefined);
    };
    const onChain = (next: string): void => {
      if (active) setChainId(Number.parseInt(next, 16));
    };
    const onDisconnect = (): void => {
      if (!active) return;
      setAddress(undefined);
      setChainId(undefined);
    };

    void (async () => {
      try {
        provider = await getWcProvider(config);
        provider.on("accountsChanged", onAccounts);
        provider.on("chainChanged", onChain);
        provider.on("disconnect", onDisconnect);
        if (active && provider.accounts.length > 0) {
          setAddress(provider.accounts[0] as Address);
          setChainId(provider.chainId);
        }
      } catch (err) {
        // A bad/placeholder projectId or offline relay shouldn't crash the app;
        // connection errors surface in the modal when the user actually clicks.
        console.warn("Virio: WalletConnect initialisation failed.", err);
      }
    })();

    return () => {
      active = false;
      if (provider) {
        provider.removeListener("accountsChanged", onAccounts);
        provider.removeListener("chainChanged", onChain);
        provider.removeListener("disconnect", onDisconnect);
      }
    };
  }, [config]);

  const connect = useCallback(
    async (onDisplayUri?: (uri: string) => void) => {
      const result = await wcConnect(config, onDisplayUri);
      setAddress(result.address);
      setChainId(result.chainId);
      return result;
    },
    [config],
  );

  const disconnect = useCallback(async () => {
    await wcDisconnect();
    setAddress(undefined);
    setChainId(undefined);
  }, []);

  const switchChain = useCallback(async (next: number) => {
    await wcSwitchChain(next);
    setChainId(next);
  }, []);

  const getProvider = useCallback(() => getWcProvider(config), [config]);

  const value = useMemo<VirioContextValue>(
    () => ({
      rpcUrl,
      chain: resolvedChain,
      contractAddress: resolvedContract,
      connected: address !== undefined,
      address,
      chainId,
      connect,
      disconnect,
      switchChain,
      getProvider,
    }),
    [
      rpcUrl,
      resolvedChain,
      resolvedContract,
      address,
      chainId,
      connect,
      disconnect,
      switchChain,
      getProvider,
    ],
  );

  return <VirioContext.Provider value={value}>{children}</VirioContext.Provider>;
}

/** Internal accessor used by VirioButton / VirioModal. */
export function useVirioContext(): VirioContextValue {
  const ctx = useContext(VirioContext);
  if (!ctx) throw new Error("Virio components must be used within <VirioProvider>.");
  return ctx;
}

/** Public connection state + actions. */
export interface UseVirio {
  connected: boolean;
  address: string | undefined;
  chainId: number | undefined;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export function useVirio(): UseVirio {
  const ctx = useVirioContext();
  return {
    connected: ctx.connected,
    address: ctx.address,
    chainId: ctx.chainId,
    connect: async () => {
      await ctx.connect();
    },
    disconnect: ctx.disconnect,
  };
}
