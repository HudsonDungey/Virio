"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Hash, Hex } from "viem";

import { useVirioContext } from "./VirioProvider.js";
import {
  formatAmount,
  formatInterval,
  loadPlan,
  subscribeToPlan,
  type PlanSummary,
} from "./transaction.js";
import { openWallet } from "./walletconnect.js";
import { toDataUrl } from "./qr.js";
import { KEYFRAMES, styles } from "./styles.js";

type ModalState = "connect" | "connecting" | "preparing" | "signing" | "success" | "error";

interface Props {
  planId: Hex;
  autoConnect: boolean;
  autoSign: boolean;
  onConnect?: (address: string) => void;
  onPending?: (txHash: string) => void;
  onSuccess?: (subscriptionId: string) => void;
  onError?: (error: Error) => void;
  onClose: () => void;
}

export function VirioModal({
  planId,
  autoConnect,
  autoSign,
  onConnect,
  onPending,
  onSuccess,
  onError,
  onClose,
}: Props): JSX.Element {
  const ctx = useVirioContext();

  const [state, setState] = useState<ModalState>(
    ctx.connected && autoConnect ? "preparing" : "connect",
  );
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const cardRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const fail = useCallback(
    (phase: "connect" | "sign" | "prepare", err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      setErrorMsg(describeError(phase, error));
      setState("error");
      onError?.(error);
    },
    [onError],
  );

  const sign = useCallback(
    async (summary: PlanSummary) => {
      try {
        const account = ctx.address;
        if (!account) throw new Error("No connected account.");
        setState("signing");
        const provider = await ctx.getProvider();
        const { subscriptionId } = await subscribeToPlan({
          rpcUrl: ctx.rpcUrl,
          chain: ctx.chain,
          contractAddress: ctx.contractAddress,
          plan: summary,
          account,
          provider,
          onPending: (hash: Hash) => onPending?.(hash),
        });
        setState("success");
        onSuccess?.(subscriptionId);
      } catch (err) {
        fail("sign", err);
      }
    },
    [ctx, onPending, onSuccess, fail],
  );

  const prepare = useCallback(async () => {
    try {
      const summary = await loadPlan({
        rpcUrl: ctx.rpcUrl,
        chain: ctx.chain,
        contractAddress: ctx.contractAddress,
        planId,
      });
      setPlan(summary);
      // Wrong chain: ask the wallet to switch before we request a signature.
      if (ctx.chainId !== ctx.chain.id) {
        await ctx.switchChain(ctx.chain.id);
      }
      if (autoSign) await sign(summary);
      // Otherwise we stay on "preparing", showing the summary + a Subscribe button.
    } catch (err) {
      fail("prepare", err);
    }
  }, [ctx, planId, autoSign, sign, fail]);

  const connect = useCallback(
    async (mode: "wallet" | "qr") => {
      setQrImage(null);
      setState("connecting");
      try {
        const { address } = await ctx.connect((uri) => {
          if (mode === "wallet") openWallet(uri);
          else void toDataUrl(uri).then(setQrImage).catch(() => undefined);
        });
        onConnect?.(address);
        startedRef.current = true;
        setState("preparing");
        void prepare();
      } catch (err) {
        fail("connect", err);
      }
    },
    [ctx, onConnect, prepare, fail],
  );

  const retry = useCallback(() => {
    setErrorMsg("");
    setPlan(null);
    setQrImage(null);
    if (ctx.connected) {
      startedRef.current = true;
      setState("preparing");
      void prepare();
    } else {
      startedRef.current = false;
      setState("connect");
    }
  }, [ctx.connected, prepare]);

  // Already connected when the modal opens (and autoConnect): skip straight to
  // preparing + signing. The ref guards against React's double-invoked effects.
  useEffect(() => {
    if (startedRef.current) return;
    if (ctx.connected && autoConnect) {
      startedRef.current = true;
      void prepare();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // Accessibility: ESC to close, Tab trapped within the card, body scroll locked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab") trapFocus(e, cardRef.current);
    };
    document.addEventListener("keydown", onKey);
    cardRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      style={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="virio-title"
        tabIndex={-1}
        style={styles.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" style={styles.close} onClick={onClose}>
          ×
        </button>
        {renderBody({ state, plan, qrImage, errorMsg, autoSign, sign, connect, retry, onClose })}
      </div>
    </div>
  );
}

// ── Body per state ──

interface BodyArgs {
  state: ModalState;
  plan: PlanSummary | null;
  qrImage: string | null;
  errorMsg: string;
  autoSign: boolean;
  sign: (plan: PlanSummary) => void;
  connect: (mode: "wallet" | "qr") => void;
  retry: () => void;
  onClose: () => void;
}

function renderBody(a: BodyArgs): JSX.Element {
  switch (a.state) {
    case "connect":
      return (
        <>
          <Header title="Connect Wallet" subtitle="Choose how you would like to connect." />
          <div style={styles.options}>
            <button type="button" style={styles.option} onClick={() => a.connect("wallet")}>
              Continue with Wallet
              <span style={styles.optionHint}>MetaMask, Coinbase, Rainbow, Trust, Rabby</span>
            </button>
            <button type="button" style={styles.option} onClick={() => a.connect("qr")}>
              Connect on another device
              <span style={styles.optionHint}>Scan a QR code with your wallet</span>
            </button>
          </div>
        </>
      );

    case "connecting":
      return (
        <>
          <Header
            title="Connecting"
            subtitle={a.qrImage ? "Scan with your wallet to connect." : "Approve the connection in your wallet."}
          />
          <div style={styles.center}>
            {a.qrImage ? (
              <img src={a.qrImage} alt="WalletConnect QR code" style={styles.qr} />
            ) : (
              <Spinner />
            )}
          </div>
        </>
      );

    case "preparing":
      return (
        <>
          <Header
            title="Preparing Subscription"
            subtitle={a.plan ? "Review the details below." : "Loading plan details…"}
          />
          {a.plan ? <Summary plan={a.plan} /> : <div style={styles.center}><Spinner /></div>}
          {a.plan && !a.autoSign && (
            <button type="button" style={styles.primary} onClick={() => a.sign(a.plan as PlanSummary)}>
              Create Subscription
            </button>
          )}
        </>
      );

    case "signing":
      return (
        <>
          <Header title="Confirm Subscription" subtitle="Approve the request in your wallet." />
          {a.plan && <Summary plan={a.plan} />}
          <div style={styles.center}>
            <Spinner />
            <span style={styles.statusText}>Waiting for confirmation…</span>
          </div>
        </>
      );

    case "success":
      return (
        <>
          <div style={styles.center}>
            <div style={styles.successIcon} aria-hidden="true">
              ✓
            </div>
          </div>
          <Header
            title="Subscription Active"
            subtitle="Payments will be processed automatically."
          />
          <button type="button" style={styles.primary} onClick={a.onClose}>
            Done
          </button>
        </>
      );

    case "error":
      return (
        <>
          <Header title={a.errorMsg || "Something went wrong"} subtitle="Please try again." />
          <button type="button" style={styles.primary} onClick={a.retry}>
            Try again
          </button>
        </>
      );
  }
}

// ── Small presentational pieces ──

function Header({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div>
      <h2 id="virio-title" style={styles.title}>
        {title}
      </h2>
      <p style={styles.subtitle}>{subtitle}</p>
    </div>
  );
}

function Summary({ plan }: { plan: PlanSummary }): JSX.Element {
  return (
    <div style={styles.summary}>
      <div style={styles.summaryAmount}>{formatAmount(plan)}</div>
      <div style={styles.summaryInterval}>{formatInterval(plan.period)}</div>
    </div>
  );
}

function Spinner(): JSX.Element {
  return <div data-virio-spinner style={styles.spinner} aria-hidden="true" />;
}

// ── Helpers ──

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

function trapFocus(e: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const activeEl = document.activeElement;
  if (e.shiftKey && activeEl === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && activeEl === last) {
    e.preventDefault();
    first.focus();
  }
}
