import type { CheckoutState } from "../checkout/controller.js";
import { formatAmount, formatInterval, type PlanSummary } from "../checkout/transaction.js";
import { styles } from "../checkout/styles.js";

// DOM renderer for the vanilla / Web Component modal. It mirrors the React
// modal's markup but builds elements imperatively. The *logic* lives in the
// shared controller; only this presentation layer differs from React, which is
// unavoidable across two render technologies.

export interface ModalHandlers {
  connect: (mode: "wallet" | "qr") => void;
  sign: () => void;
  retry: () => void;
  close: () => void;
  autoSign: boolean;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  styleKey?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (styleKey && styles[styleKey]) Object.assign(el.style, styles[styleKey]);
  if (text !== undefined) el.textContent = text;
  return el;
}

export function renderModal(state: CheckoutState, handlers: ModalHandlers): HTMLElement {
  const overlay = make("div", "overlay");
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) handlers.close();
  });

  const card = make("div", "card");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "virio-title");
  card.tabIndex = -1;
  card.addEventListener("mousedown", (e) => e.stopPropagation());
  overlay.appendChild(card);

  const closeBtn = make("button", "close", "×");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.addEventListener("click", () => handlers.close());
  card.appendChild(closeBtn);

  for (const node of body(state, handlers)) card.appendChild(node);
  return overlay;
}

function body(state: CheckoutState, h: ModalHandlers): HTMLElement[] {
  switch (state.status) {
    case "connect": {
      const options = make("div", "options");
      options.append(
        option("Continue with Wallet", "MetaMask, Coinbase, Rainbow, Trust, Rabby", () =>
          h.connect("wallet"),
        ),
        option("Connect on another device", "Scan a QR code with your wallet", () => h.connect("qr")),
      );
      return [header("Connect Wallet", "Choose how you would like to connect."), options];
    }

    case "connecting": {
      const center = make("div", "center");
      if (state.qrImage) {
        const img = make("img", "qr");
        img.src = state.qrImage;
        img.alt = "WalletConnect QR code";
        center.appendChild(img);
      } else {
        center.appendChild(spinner());
      }
      const subtitle = state.qrImage
        ? "Scan with your wallet to connect."
        : "Approve the connection in your wallet.";
      return [header("Connecting", subtitle), center];
    }

    case "preparing": {
      const nodes: HTMLElement[] = [
        header(
          "Preparing Subscription",
          state.plan ? "Review the details below." : "Loading plan details…",
        ),
      ];
      if (state.plan) {
        nodes.push(summary(state.plan));
        if (!h.autoSign) {
          const btn = make("button", "primary", "Create Subscription");
          btn.type = "button";
          btn.addEventListener("click", () => h.sign());
          nodes.push(btn);
        }
      } else {
        const center = make("div", "center");
        center.appendChild(spinner());
        nodes.push(center);
      }
      return nodes;
    }

    case "signing": {
      const nodes: HTMLElement[] = [
        header("Confirm Subscription", "Approve the request in your wallet."),
      ];
      if (state.plan) nodes.push(summary(state.plan));
      const center = make("div", "center");
      center.appendChild(spinner());
      center.appendChild(make("span", "statusText", "Waiting for confirmation…"));
      nodes.push(center);
      return nodes;
    }

    case "success": {
      const center = make("div", "center");
      const icon = make("div", "successIcon", "✓");
      icon.setAttribute("aria-hidden", "true");
      center.appendChild(icon);
      const done = make("button", "primary", "Done");
      done.type = "button";
      done.addEventListener("click", () => h.close());
      return [
        center,
        header("Subscription Active", "Payments will be processed automatically."),
        done,
      ];
    }

    case "error": {
      const retry = make("button", "primary", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => h.retry());
      return [header(state.errorMessage || "Something went wrong", "Please try again."), retry];
    }
  }
}

// ── Pieces ──

function header(title: string, subtitle: string): HTMLElement {
  const wrap = make("div");
  const heading = make("h2", "title", title);
  heading.id = "virio-title";
  wrap.append(heading, make("p", "subtitle", subtitle));
  return wrap;
}

function option(label: string, hint: string, onClick: () => void): HTMLButtonElement {
  const btn = make("button", "option");
  btn.type = "button";
  btn.appendChild(document.createTextNode(label));
  btn.appendChild(make("span", "optionHint", hint));
  btn.addEventListener("click", onClick);
  return btn;
}

function summary(plan: PlanSummary): HTMLElement {
  const wrap = make("div", "summary");
  wrap.append(
    make("div", "summaryAmount", formatAmount(plan)),
    make("div", "summaryInterval", formatInterval(plan.period)),
  );
  return wrap;
}

function spinner(): HTMLElement {
  const el = make("div", "spinner");
  el.setAttribute("data-virio-spinner", "");
  el.setAttribute("aria-hidden", "true");
  return el;
}

/** Keep Tab focus inside the modal card. Shared shape with the React trap. */
export function trapFocus(e: KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
