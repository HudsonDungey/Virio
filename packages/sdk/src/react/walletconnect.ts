"use client";

import { EthereumProvider } from "@walletconnect/ethereum-provider";
import type { Address } from "viem";

// WalletConnect connection layer. This is the spec's WalletConnectService and
// VirioSessionManager combined into one module: a single provider instance owns
// the relay connection, QR/deep-link URIs, session persistence and reconnection.
// EthereumProvider stores its session in localStorage and restores it on init,
// which gives us "reconnect on refresh" for free.

export type WcProvider = Awaited<ReturnType<typeof EthereumProvider.init>>;

export interface WcConfig {
  /** WalletConnect Cloud project id. Virio ships a default; merchants may override. */
  projectId: string;
  /** Chain the Virio contract lives on. */
  chainId: number;
  /** RPC endpoint used by the provider for reads/chain metadata. */
  rpcUrl: string;
  /** Shown to the user in their wallet during connection. */
  appName: string;
}

// Singleton: one provider per page. Re-initialising would orphan the relay
// socket and drop the restored session, so we memoise both the instance and
// the in-flight init promise (guards against concurrent first calls).
let instance: WcProvider | null = null;
let pending: Promise<WcProvider> | null = null;

export async function getWcProvider(config: WcConfig): Promise<WcProvider> {
  if (instance) return instance;
  if (!pending) {
    pending = EthereumProvider.init({
      projectId: config.projectId,
      chains: [config.chainId],
      optionalChains: [config.chainId],
      // We render our own modal (two options + QR), so the bundled one is off.
      showQrModal: false,
      rpcMap: { [config.chainId]: config.rpcUrl },
      metadata: {
        name: config.appName,
        description: `${config.appName} — crypto subscriptions powered by Virio`,
        url: typeof window !== "undefined" ? window.location.origin : "https://virio.xyz",
        icons: [],
      },
    }).then((provider) => {
      instance = provider;
      return provider;
    });
  }
  return pending;
}

/**
 * Open a WalletConnect session. Emits the pairing URI to `onDisplayUri` (for
 * QR rendering or a mobile deep link) and resolves once the wallet approves.
 * If a session already exists it resolves immediately.
 */
export async function wcConnect(
  config: WcConfig,
  onDisplayUri?: (uri: string) => void,
): Promise<{ address: Address; chainId: number }> {
  const provider = await getWcProvider(config);
  const handler = (uri: string): void => onDisplayUri?.(uri);
  provider.on("display_uri", handler);
  try {
    if (!provider.session || provider.accounts.length === 0) {
      await provider.connect();
    }
  } finally {
    provider.removeListener("display_uri", handler);
  }
  const address = provider.accounts[0] as Address | undefined;
  if (!address) throw new Error("WalletConnect: no account returned after connection.");
  return { address, chainId: provider.chainId };
}

export async function wcDisconnect(): Promise<void> {
  if (instance?.session) {
    await instance.disconnect();
  }
}

/** Ask the connected wallet to switch to `chainId` (EIP-3326). */
export async function wcSwitchChain(chainId: number): Promise<void> {
  if (!instance) throw new Error("WalletConnect: provider not initialised.");
  await instance.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${chainId.toString(16)}` }],
  });
}

/**
 * Hand a pairing URI off to an installed wallet. On mobile the OS routes the
 * `wc:` scheme to a wallet app; this powers "Continue with Wallet".
 */
export function openWallet(uri: string): void {
  if (typeof window !== "undefined") window.location.href = uri;
}
