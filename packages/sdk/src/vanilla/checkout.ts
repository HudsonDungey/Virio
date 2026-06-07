import type { Hex } from "viem";

import { VirioCheckout, type CheckoutCallbacks } from "../checkout/controller.js";
import { resolveConfig, type CheckoutConfigInput } from "../checkout/config.js";
import { KEYFRAMES } from "../checkout/styles.js";
import { renderModal, trapFocus } from "./render.js";

export interface OpenCheckoutOptions extends CheckoutConfigInput, CheckoutCallbacks {
  planId: string;
  autoConnect?: boolean;
  autoSign?: boolean;
}

let keyframesInjected = false;
function ensureKeyframes(): void {
  if (keyframesInjected || typeof document === "undefined") return;
  keyframesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-virio", "");
  style.textContent = KEYFRAMES;
  document.head.appendChild(style);
}

/**
 * Open the checkout modal imperatively from any framework or plain JS. Mounts a
 * portal on `document.body`, drives it from the shared controller, and tears
 * everything down on close. Returns the controller so callers can observe state.
 */
export function openVirioCheckout(options: OpenCheckoutOptions): VirioCheckout {
  ensureKeyframes();

  const checkout = new VirioCheckout({
    config: resolveConfig(options),
    planId: options.planId as Hex,
    autoConnect: options.autoConnect,
    autoSign: options.autoSign,
    onConnect: options.onConnect,
    onPending: options.onPending,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });

  const autoSign = options.autoSign ?? true;
  const root = document.createElement("div");
  document.body.appendChild(root);
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
    else if (e.key === "Tab") trapFocus(e, root.querySelector<HTMLElement>('[role="dialog"]'));
  };

  function close(): void {
    unsubscribe();
    checkout.destroy();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = previousOverflow;
    root.remove();
  }

  function rerender(): void {
    const modal = renderModal(checkout.getState(), {
      connect: (mode) => void checkout.connect(mode),
      sign: () => void checkout.sign(),
      retry: () => checkout.retry(),
      close,
      autoSign,
    });
    root.replaceChildren(modal);
    root.querySelector<HTMLElement>('[role="dialog"]')?.focus();
  }

  const unsubscribe = checkout.subscribe(rerender);
  document.addEventListener("keydown", onKey);
  rerender();
  checkout.open();
  return checkout;
}
