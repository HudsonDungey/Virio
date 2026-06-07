import type { Address } from "viem";

import {
  getWcProvider,
  wcConnect,
  wcDisconnect,
  wcSwitchChain,
  type WcConfig,
  type WcProvider,
} from "./walletconnect.js";

// The single connection authority. WalletConnect already keeps one provider
// singleton (walletconnect.ts); this wraps it in an observable store so every
// consumer — the React `useVirio` hook and every checkout controller, React or
// vanilla — reads the same address/chain and reacts to the same wallet events.
// No second source of truth.

interface SessionState {
  address: Address | undefined;
  chainId: number | undefined;
}

let state: SessionState = { address: undefined, chainId: undefined };
const listeners = new Set<() => void>();
let wired = false;

function setState(patch: Partial<SessionState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function getSession(): SessionState {
  return state;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Initialise the provider, restore any persisted session, and wire wallet
 * events exactly once. Safe to call repeatedly (e.g. on every mount/connect).
 */
export async function initSession(config: WcConfig): Promise<void> {
  const provider = await getWcProvider(config);
  if (!wired) {
    wired = true;
    provider.on("accountsChanged", (accounts: string[]) => {
      setState({ address: (accounts[0] as Address) ?? undefined });
    });
    provider.on("chainChanged", (next: string) => {
      setState({ chainId: Number.parseInt(next, 16) });
    });
    provider.on("disconnect", () => {
      setState({ address: undefined, chainId: undefined });
    });
  }
  if (provider.accounts.length > 0) {
    setState({ address: provider.accounts[0] as Address, chainId: provider.chainId });
  }
}

export async function connectSession(
  config: WcConfig,
  onDisplayUri?: (uri: string) => void,
): Promise<{ address: Address; chainId: number }> {
  await initSession(config);
  const result = await wcConnect(config, onDisplayUri);
  setState({ address: result.address, chainId: result.chainId });
  return result;
}

export async function disconnectSession(): Promise<void> {
  await wcDisconnect();
  setState({ address: undefined, chainId: undefined });
}

export async function switchSessionChain(chainId: number): Promise<void> {
  await wcSwitchChain(chainId);
  setState({ chainId });
}

export function getSessionProvider(config: WcConfig): Promise<WcProvider> {
  return getWcProvider(config);
}
