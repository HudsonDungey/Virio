"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Hex } from "viem";

import { VirioModal } from "./VirioModal.js";
import { styles } from "./styles.js";

export interface VirioButtonProps {
  /** The plan to subscribe to. Resolved from the contract — the source of truth. */
  planId: string;
  /** Button label. Defaults to "Subscribe with Crypto". */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  /** Skip the connect screen when a session is already restored. Default true. */
  autoConnect?: boolean;
  /** Start the signing flow automatically after connecting. Default true. */
  autoSign?: boolean;
  onConnect?: (address: string) => void;
  onPending?: (txHash: string) => void;
  onSuccess?: (subscriptionId: string) => void;
  onError?: (error: Error) => void;
}

export function VirioButton({
  planId,
  children,
  className,
  style,
  disabled = false,
  autoConnect = true,
  autoSign = true,
  onConnect,
  onPending,
  onSuccess,
  onError,
}: VirioButtonProps): JSX.Element {
  const [open, setOpen] = useState(false);

  // A custom className opts out of the default look entirely; otherwise the
  // built-in style applies and `style` merges on top.
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
        {children ?? "Subscribe with Crypto"}
      </button>
      {open && (
        <VirioModal
          planId={planId as Hex}
          autoConnect={autoConnect}
          autoSign={autoSign}
          onConnect={onConnect}
          onPending={onPending}
          onSuccess={onSuccess}
          onError={onError}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
