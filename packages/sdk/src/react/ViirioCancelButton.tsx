"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Hash, Hex } from "viem";

import { cancelSubscription } from "../checkout/transaction.js";
import {
  connectSession,
  getSession,
  getSessionProvider,
  switchSessionChain,
} from "../checkout/session.js";
import { toWcConfig } from "../checkout/config.js";
import { openWallet } from "../checkout/walletconnect.js";
import { toDataUrl } from "../checkout/qr.js";
import { KEYFRAMES, styles } from "../checkout/styles.js";
import { useVirioConfig } from "./VirioProvider.js";

type CancelStatus = "connect" | "connecting" | "cancelling" | "success" | "error";

interface CancelState {
  status: CancelStatus;
  qrImage: string | null;
  errorMessage: string;
  address: string | undefined;
}

export interface ViirioCancelButtonProps {
  subscriptionId: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  onPending?: (txHash: string) => void;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

export function ViirioCancelButton({
  subscriptionId,
  children,
  className,
  style,
  disabled = false,
  onPending,
  onSuccess,
  onError,
}: ViirioCancelButtonProps): JSX.Element {
  const config = useVirioConfig();
  const [open, setOpen] = useState(false);

  const buttonStyle = className
    ? style
    : { ...styles.button, ...(disabled ? styles.buttonDisabled : null), ...style };

  return (
    <>
      <button
        type="button"
        className={className}
        style={buttonStyle}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children ?? "Cancel Subscription"}
      </button>
      {open && (
        <CancelModal
          subscriptionId={subscriptionId as Hex}
          config={config}
          onPending={onPending}
          onSuccess={onSuccess}
          onError={onError}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ── Cancel modal ──

interface CancelModalProps {
  subscriptionId: Hex;
  config: ReturnType<typeof useVirioConfig>;
  onPending?: (txHash: string) => void;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
  onClose: () => void;
}

function CancelModal({
  subscriptionId,
  config,
  onPending,
  onSuccess,
  onError,
  onClose,
}: CancelModalProps): JSX.Element {
  const [state, setState] = useState<CancelState>(() => {
    const session = getSession();
    return {
      status: session.address ? "cancelling" : "connect",
      qrImage: null,
      errorMessage: "",
      address: session.address,
    };
  });

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Tab") trapFocus(e, cardRef.current);
    };
    document.addEventListener("keydown", onKey);
    cardRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // When already connected, run cancel immediately on mount.
  useEffect(() => {
    if (state.status === "cancelling" && state.address) {
      void runCancel(state.address as `0x${string}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wcConfig = toWcConfig(config);

  async function connect(mode: "wallet" | "qr"): Promise<void> {
    setState((s) => ({ ...s, status: "connecting", qrImage: null }));
    try {
      const { address } = await connectSession(wcConfig, (uri) => {
        if (mode === "wallet") openWallet(uri);
        else void toDataUrl(uri).then((img) => setState((s) => ({ ...s, qrImage: img }))).catch(() => undefined);
      });
      setState((s) => ({ ...s, status: "cancelling", address }));
      await runCancel(address as `0x${string}`);
    } catch (err) {
      fail(err);
    }
  }

  async function runCancel(account: `0x${string}`): Promise<void> {
    setState((s) => ({ ...s, status: "cancelling" }));
    try {
      if (getSession().chainId !== config.chain.id) {
        await switchSessionChain(config.chain.id);
      }
      const provider = await getSessionProvider(wcConfig);
      const hash = await cancelSubscription({
        rpcUrl: config.rpcUrl,
        chain: config.chain,
        contractAddress: config.contractAddress,
        subscriptionId,
        account,
        provider,
        onPending: (h: Hash) => onPending?.(h),
      });
      setState((s) => ({ ...s, status: "success" }));
      onSuccess?.(hash);
    } catch (err) {
      fail(err);
    }
  }

  function fail(err: unknown): void {
    const error = err instanceof Error ? err : new Error(String(err));
    const isRejection =
      (err as { code?: number }).code === 4001 ||
      error.message.toLowerCase().includes("reject") ||
      error.message.toLowerCase().includes("denied") ||
      error.message.toLowerCase().includes("user closed");
    const message = isRejection ? "Transaction Cancelled" : error.message || "Something went wrong.";
    setState((s) => ({ ...s, status: "error", errorMessage: message }));
    onError?.(error);
  }

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
        aria-labelledby="virio-cancel-title"
        tabIndex={-1}
        style={styles.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" style={styles.close} onClick={onClose}>
          ×
        </button>
        {renderBody({ state, connect, onClose, retry: () => {
          const session = getSession();
          if (session.address) {
            setState((s) => ({ ...s, status: "cancelling", errorMessage: "" }));
            void runCancel(session.address as `0x${string}`);
          } else {
            setState((s) => ({ ...s, status: "connect", errorMessage: "" }));
          }
        }})}
      </div>
    </div>
  );
}

interface BodyArgs {
  state: CancelState;
  connect: (mode: "wallet" | "qr") => Promise<void>;
  onClose: () => void;
  retry: () => void;
}

function renderBody({ state, connect, onClose, retry }: BodyArgs): JSX.Element {
  switch (state.status) {
    case "connect":
      return (
        <>
          <Header title="Connect Wallet" subtitle="Connect your wallet to cancel this subscription." />
          <div style={styles.options}>
            <button type="button" style={styles.option} onClick={() => void connect("wallet")}>
              Continue with Wallet
              <span style={styles.optionHint}>MetaMask, Coinbase, Rainbow, Trust, Rabby</span>
            </button>
            <button type="button" style={styles.option} onClick={() => void connect("qr")}>
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
            subtitle={state.qrImage ? "Scan with your wallet to connect." : "Approve the connection in your wallet."}
          />
          <div style={styles.center}>
            {state.qrImage ? (
              <img src={state.qrImage} alt="WalletConnect QR code" style={styles.qr} />
            ) : (
              <Spinner />
            )}
          </div>
        </>
      );

    case "cancelling":
      return (
        <>
          <Header title="Cancelling Subscription" subtitle="Approve the transaction in your wallet." />
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
            <div style={styles.successIcon} aria-hidden="true">✓</div>
          </div>
          <Header title="Subscription Cancelled" subtitle="No further charges will be made." />
          <button type="button" style={styles.primary} onClick={onClose}>
            Done
          </button>
        </>
      );

    case "error":
      return (
        <>
          <Header title={state.errorMessage || "Something went wrong"} subtitle="Please try again." />
          <button type="button" style={styles.primary} onClick={retry}>
            Try again
          </button>
        </>
      );
  }
}

function Header({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div>
      <h2 id="virio-cancel-title" style={styles.title}>{title}</h2>
      <p style={styles.subtitle}>{subtitle}</p>
    </div>
  );
}

function Spinner(): JSX.Element {
  return <div data-virio-spinner style={styles.spinner} aria-hidden="true" />;
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
