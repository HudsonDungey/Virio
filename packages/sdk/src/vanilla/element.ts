import type { Address } from "viem";

import { styles } from "../checkout/styles.js";
import type { ChainName } from "../chains.js";
import { openVirioCheckout, type OpenCheckoutOptions } from "./checkout.js";

// The framework-neutral surface. A custom element works natively in plain HTML,
// Vue, Svelte, Angular and Solid, so one implementation covers every framework:
//
//   <virio-button rpc-url="https://…" plan-id="0x…">Subscribe</virio-button>
//
// Results surface as bubbling CustomEvents: virio:connect, virio:pending,
// virio:success, virio:error (the subscription id / address / error in detail).

class VirioButtonElement extends HTMLElement {
  private rendered = false;

  connectedCallback(): void {
    if (this.rendered) return;
    this.rendered = true;

    const label = this.textContent?.trim() || "Subscribe with Crypto";
    const button = document.createElement("button");
    button.type = "button";
    Object.assign(button.style, styles.button);
    button.textContent = label;
    button.addEventListener("click", () => this.open());
    this.replaceChildren(button);
  }

  private open(): void {
    openVirioCheckout({
      ...this.readOptions(),
      onConnect: (address) => this.emit("connect", address),
      onPending: (txHash) => this.emit("pending", txHash),
      onSuccess: (subscriptionId) => this.emit("success", subscriptionId),
      onError: (error) => this.emit("error", error),
    });
  }

  private readOptions(): OpenCheckoutOptions {
    const chainAttr = this.getAttribute("chain");
    return {
      rpcUrl: this.getAttribute("rpc-url") ?? "",
      planId: this.getAttribute("plan-id") ?? "",
      chain: chainAttr ? coerceChain(chainAttr) : undefined,
      contractAddress: (this.getAttribute("contract-address") as Address | null) ?? undefined,
      projectId: this.getAttribute("project-id") ?? undefined,
      appName: this.getAttribute("app-name") ?? undefined,
      autoConnect: this.boolAttr("auto-connect"),
      autoSign: this.boolAttr("auto-sign"),
    };
  }

  /** Absent → undefined (controller default true); present unless "false"/"0". */
  private boolAttr(name: string): boolean | undefined {
    if (!this.hasAttribute(name)) return undefined;
    const value = this.getAttribute(name);
    return value !== "false" && value !== "0";
  }

  private emit(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(`virio:${type}`, { detail, bubbles: true }));
  }
}

function coerceChain(value: string): ChainName | number {
  const asNumber = Number(value);
  return value.trim() !== "" && Number.isFinite(asNumber) ? asNumber : (value as ChainName);
}

/** Register the `<virio-button>` element. Idempotent and SSR-safe. */
export function defineVirioButton(tag = "virio-button"): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(tag)) customElements.define(tag, VirioButtonElement);
}
