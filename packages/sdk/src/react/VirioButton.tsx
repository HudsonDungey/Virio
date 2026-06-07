"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Hex } from "viem";

import { VirioCheckout } from "../checkout/controller.js";
import { styles } from "../checkout/styles.js";
import { VirioModal } from "./VirioModal.js";
import { useVirioConfig } from "./VirioProvider.js";

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
  const config = useVirioConfig();
  const [checkout, setCheckout] = useState<VirioCheckout | null>(null);

  const open = (): void => {
    const instance = new VirioCheckout({
      config,
      planId: planId as Hex,
      autoConnect,
      autoSign,
      onConnect,
      onPending,
      onSuccess,
      onError,
    });
    setCheckout(instance);
    instance.open();
  };

  const close = (): void => {
    checkout?.destroy();
    setCheckout(null);
  };

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
        onClick={open}
      >
        {children ?? "Subscribe with Crypto"}
      </button>
      {checkout && <VirioModal checkout={checkout} autoSign={autoSign} onClose={close} />}
    </>
  );
}
