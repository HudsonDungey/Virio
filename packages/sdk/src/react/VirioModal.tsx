"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { VirioCheckout, CheckoutState } from "../checkout/controller.js";
import { formatAmount, formatInterval, type PlanSummary } from "../checkout/transaction.js";
import { KEYFRAMES, styles } from "../checkout/styles.js";

interface Props {
  checkout: VirioCheckout;
  autoSign: boolean;
  onClose: () => void;
}

export function VirioModal({ checkout, autoSign, onClose }: Props): JSX.Element {
  const state = useSyncExternalStore(
    (listener) => checkout.subscribe(listener),
    () => checkout.getState(),
    () => checkout.getState(),
  );

  const cardRef = useRef<HTMLDivElement>(null);

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
        {renderBody({ state, autoSign, checkout, onClose })}
      </div>
    </div>
  );
}

// ── Body per state ──

interface BodyArgs {
  state: CheckoutState;
  autoSign: boolean;
  checkout: VirioCheckout;
  onClose: () => void;
}

function renderBody({ state, autoSign, checkout, onClose }: BodyArgs): JSX.Element {
  switch (state.status) {
    case "connect":
      return (
        <>
          <Header title="Connect Wallet" subtitle="Choose how you would like to connect." />
          <div style={styles.options}>
            <button type="button" style={styles.option} onClick={() => void checkout.connect("wallet")}>
              Continue with Wallet
              <span style={styles.optionHint}>MetaMask, Coinbase, Rainbow, Trust, Rabby</span>
            </button>
            <button type="button" style={styles.option} onClick={() => void checkout.connect("qr")}>
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

    case "preparing":
      return (
        <>
          <Header
            title="Preparing Subscription"
            subtitle={state.plan ? "Review the details below." : "Loading plan details…"}
          />
          {state.plan ? <Summary plan={state.plan} /> : <div style={styles.center}><Spinner /></div>}
          {state.plan && !autoSign && (
            <button type="button" style={styles.primary} onClick={() => void checkout.sign()}>
              Create Subscription
            </button>
          )}
        </>
      );

    case "signing":
      return (
        <>
          <Header title="Confirm Subscription" subtitle="Approve the request in your wallet." />
          {state.plan && <Summary plan={state.plan} />}
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
          <Header title="Subscription Active" subtitle="Payments will be processed automatically." />
          <button type="button" style={styles.primary} onClick={onClose}>
            Done
          </button>
        </>
      );

    case "error":
      return (
        <>
          <Header title={state.errorMessage || "Something went wrong"} subtitle="Please try again." />
          <button type="button" style={styles.primary} onClick={() => checkout.retry()}>
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
