// ─── @virio/sdk/react ────────────────────────────────────────────────────────
// WalletConnect-powered React components for adding crypto subscriptions with a
// single button. Wrap your app in <VirioProvider> and drop in <VirioButton />.

export { VirioProvider, useVirio } from "./VirioProvider.js";
export type { VirioProviderProps, UseVirio } from "./VirioProvider.js";

export { VirioButton } from "./VirioButton.js";
export type { VirioButtonProps } from "./VirioButton.js";

export type { PlanSummary } from "../checkout/transaction.js";
