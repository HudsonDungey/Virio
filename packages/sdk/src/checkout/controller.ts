import type { Hash, Hex } from "viem";

import { type ResolvedCheckoutConfig, toWcConfig } from "./config.js";
import {
  connectSession,
  getSession,
  getSessionProvider,
  switchSessionChain,
} from "./session.js";
import { loadPlan, subscribeToPlan, type PlanSummary } from "./transaction.js";
import { openWallet } from "./walletconnect.js";
import { toDataUrl } from "./qr.js";

// The framework-agnostic checkout engine. It owns the whole flow — connect,
// load plan, switch chain, approve + subscribe — as an observable state machine
// with zero rendering opinions. React and the vanilla Web Component are each a
// thin view that subscribes to `getState()` and calls `connect/sign/retry`.

export type CheckoutStatus =
  | "connect"
  | "connecting"
  | "preparing"
  | "signing"
  | "success"
  | "error";

export interface CheckoutState {
  status: CheckoutStatus;
  plan: PlanSummary | null;
  /** Data-URL QR image while connecting via "another device", else null. */
  qrImage: string | null;
  /** Human-readable message shown in the error state. */
  errorMessage: string;
  address: string | undefined;
}

export interface CheckoutCallbacks {
  onConnect?: (address: string) => void;
  onPending?: (txHash: string) => void;
  onSuccess?: (subscriptionId: string) => void;
  onError?: (error: Error) => void;
}

export interface CheckoutOptions extends CheckoutCallbacks {
  config: ResolvedCheckoutConfig;
  planId: Hex;
  /** Skip the connect screen when a session is already restored. Default true. */
  autoConnect?: boolean;
  /** Start signing automatically after connecting. Default true. */
  autoSign?: boolean;
}

export class VirioCheckout {
  private state: CheckoutState;
  private readonly listeners = new Set<() => void>();
  private started = false;

  constructor(private readonly opts: CheckoutOptions) {
    this.state = {
      status: "connect",
      plan: null,
      qrImage: null,
      errorMessage: "",
      address: getSession().address,
    };
  }

  getState(): CheckoutState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<CheckoutState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Begin the flow: jump straight to preparing when already connected. */
  open(): void {
    if (this.started) return;
    const connected = getSession().address !== undefined;
    if (connected && (this.opts.autoConnect ?? true)) {
      this.started = true;
      this.set({ status: "preparing", address: getSession().address });
      void this.prepare();
    } else {
      this.set({ status: "connect" });
    }
  }

  /** Connect a wallet via deep link ("wallet") or QR ("qr"), then prepare. */
  async connect(mode: "wallet" | "qr"): Promise<void> {
    this.set({ status: "connecting", qrImage: null });
    try {
      const { address } = await connectSession(toWcConfig(this.opts.config), (uri) => {
        if (mode === "wallet") openWallet(uri);
        else void toDataUrl(uri).then((img) => this.set({ qrImage: img })).catch(() => undefined);
      });
      this.opts.onConnect?.(address);
      this.started = true;
      this.set({ status: "preparing", address });
      await this.prepare();
    } catch (err) {
      this.fail("connect", err);
    }
  }

  private async prepare(): Promise<void> {
    try {
      const plan = await loadPlan({
        rpcUrl: this.opts.config.rpcUrl,
        chain: this.opts.config.chain,
        contractAddress: this.opts.config.contractAddress,
        planId: this.opts.planId,
      });
      this.set({ plan });
      // Wrong chain: ask the wallet to switch before requesting a signature.
      if (getSession().chainId !== this.opts.config.chain.id) {
        await switchSessionChain(this.opts.config.chain.id);
      }
      if (this.opts.autoSign ?? true) await this.sign();
      // Otherwise we stay on "preparing", showing the summary + a Subscribe button.
    } catch (err) {
      this.fail("prepare", err);
    }
  }

  /** Run the approve + subscribe sequence for the loaded plan. */
  async sign(): Promise<void> {
    const plan = this.state.plan;
    const account = getSession().address;
    if (!plan) return this.fail("sign", new Error("Plan not loaded."));
    if (!account) return this.fail("sign", new Error("No connected account."));
    try {
      this.set({ status: "signing" });
      const provider = await getSessionProvider(toWcConfig(this.opts.config));
      const { subscriptionId } = await subscribeToPlan({
        rpcUrl: this.opts.config.rpcUrl,
        chain: this.opts.config.chain,
        contractAddress: this.opts.config.contractAddress,
        plan,
        account,
        provider,
        onPending: (hash: Hash) => this.opts.onPending?.(hash),
      });
      this.set({ status: "success" });
      this.opts.onSuccess?.(subscriptionId);
    } catch (err) {
      this.fail("sign", err);
    }
  }

  /** Retry after an error: re-prepare when connected, else back to connect. */
  retry(): void {
    const connected = getSession().address !== undefined;
    this.set({ errorMessage: "", plan: null, qrImage: null });
    if (connected) {
      this.started = true;
      this.set({ status: "preparing" });
      void this.prepare();
    } else {
      this.started = false;
      this.set({ status: "connect" });
    }
  }

  /** Drop all listeners. Views call this on unmount/close. */
  destroy(): void {
    this.listeners.clear();
  }

  private fail(phase: "connect" | "sign" | "prepare", err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    this.set({ status: "error", errorMessage: describeError(phase, error) });
    this.opts.onError?.(error);
  }
}

// ── Error mapping (shared by every binding) ──

function describeError(phase: "connect" | "sign" | "prepare", error: Error): string {
  if (phase === "connect") {
    if (isExpired(error)) return "Connection Expired";
    if (isRejection(error)) return "Connection Cancelled";
    return error.message || "Could not connect.";
  }
  if (phase === "sign") {
    if (isRejection(error)) return "Signature Cancelled";
    return error.message || "Transaction failed.";
  }
  return error.message || "Something went wrong.";
}

function errorCode(e: unknown): number | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

function isRejection(e: Error): boolean {
  if (errorCode(e) === 4001) return true;
  const m = e.message.toLowerCase();
  return (
    m.includes("reject") || m.includes("cancel") || m.includes("denied") || m.includes("user closed")
  );
}

function isExpired(e: Error): boolean {
  const m = e.message.toLowerCase();
  return m.includes("expired") || m.includes("timeout") || m.includes("timed out");
}
