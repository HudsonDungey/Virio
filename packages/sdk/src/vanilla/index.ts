// ─── @virio/sdk/vanilla ──────────────────────────────────────────────────────
// Framework-neutral checkout: a <virio-button> Web Component (works in plain
// HTML, Vue, Svelte, Angular, Solid) plus an imperative openVirioCheckout().
// Importing this entry registers <virio-button> automatically.

import { defineVirioButton } from "./element.js";

export { defineVirioButton } from "./element.js";
export { openVirioCheckout } from "./checkout.js";
export type { OpenCheckoutOptions } from "./checkout.js";

// Re-export the headless core for advanced/custom UIs.
export { VirioCheckout } from "../checkout/controller.js";
export type {
  CheckoutState,
  CheckoutStatus,
  CheckoutOptions,
  CheckoutCallbacks,
} from "../checkout/controller.js";
export type { PlanSummary } from "../checkout/transaction.js";

// Auto-register so `import "@virio/sdk/vanilla"` is enough in plain HTML.
defineVirioButton();
