// ─── Headless checkout core ──────────────────────────────────────────────────
// Framework-agnostic building blocks shared by every binding (React, vanilla
// Web Component, or your own). No React, no DOM-render assumptions.

export { VirioCheckout } from "./controller.js";
export type {
  CheckoutState,
  CheckoutStatus,
  CheckoutOptions,
  CheckoutCallbacks,
} from "./controller.js";

export { resolveConfig, toWcConfig } from "./config.js";
export type { CheckoutConfigInput, ResolvedCheckoutConfig } from "./config.js";

export {
  getSession,
  subscribeSession,
  initSession,
  connectSession,
  disconnectSession,
  switchSessionChain,
} from "./session.js";

export { loadPlan, subscribeToPlan, formatAmount, formatInterval } from "./transaction.js";
export type { PlanSummary, LoadPlanArgs, SubscribeArgs } from "./transaction.js";

export { styles, KEYFRAMES } from "./styles.js";
