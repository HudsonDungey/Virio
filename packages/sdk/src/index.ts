// ─── Main client ───────────────────────────────────────────────────────────
export { Virio } from "./Virio.js";
// Default export so `import Virio from "@virio/sdk"` works too.
export { Virio as default } from "./Virio.js";
// Backwards-compatible alias for the previous class name.
export { Virio as VirioClient } from "./Virio.js";

export type {
  VirioOptions,
  ResolvedVirioConfig,
  PlansNamespace,
  SubscriptionsNamespace,
} from "./Virio.js";

// `VirioClientConfig` was the old name for the constructor options.
export type { VirioOptions as VirioClientConfig } from "./Virio.js";

// ─── Programmable billing ───────────────────────────────────────────────────
export { BillingClient, hashUnit } from "./billing/client.js";
export type { BillingAddresses, BillingClientOptions } from "./billing/client.js";
export { REGISTRY_ABI, RECURRING_ABI, METERED_ABI } from "./billing/abi.js";
export type { REGISTRYAbi, RECURRINGAbi, METEREDAbi } from "./billing/abi.js";
export { BILLING_TYPE_VALUES } from "./billing/types.js";
export type {
  Authorization,
  AuthorizationRecord,
  AuthorizationRemaining,
  BillingLimits,
  BillingResult,
  BillingType,
  CreateBillingParams,
  CreateHybridBilling,
  CreateMeteredBilling,
  CreateRecurringBilling,
  Interval,
  Meter,
  MeterStatement,
  MeterTerms,
  RecurringPlan,
  RecurringSubscription,
  Settlement,
  SignedMeterStatement,
} from "./billing/types.js";

// ─── Usage ──────────────────────────────────────────────────────────────────
export { UsageClient } from "./usage/client.js";
export { MemoryUsageStore } from "./usage/MemoryUsageStore.js";
export type { UsageStore, UsageQuery } from "./usage/store.js";
export type {
  RecordUsageParams,
  RecordUsageResult,
  UsageEvent,
  UsageSummary,
} from "./billing/types.js";

// ─── x402 adapter (experimental, disabled by default) ───────────────────────
export { X402Adapter } from "./x402/adapter.js";
export type { X402AdapterOptions, X402ResourceQuote } from "./x402/adapter.js";
export type {
  X402PaymentPayload,
  X402PaymentRequired,
  X402PaymentRequirements,
  X402SettlementResponse,
} from "./x402/types.js";

// ─── ABIs ──────────────────────────────────────────────────────────────────
export { VIRIO_ABI, ERC20_ABI } from "./abi.js";
export type { VirioAbi, Erc20Abi } from "./abi.js";

// ─── Errors ─────────────────────────────────────────────────────────────────
export {
  VirioError,
  MissingWalletError,
  MissingTokenError,
  MissingAccountError,
  MissingContractError,
  EventNotFoundError,
} from "./errors.js";
export type { VirioErrorCode } from "./errors.js";

// ─── Webhooks ────────────────────────────────────────────────────────────────
export { signWebhook, verifyWebhook, buildEvent } from "./webhooks.js";

// ─── Indexer ─────────────────────────────────────────────────────────────────
export { scanLogs } from "./indexer.js";
export type { IndexerOptions, DecodedLog } from "./indexer.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
export {
  usdc,
  fromUsdc,
  formatUsdc,
  parseUnits,
  formatUnits,
  PERIOD,
  intervalToPeriod,
  computeSubscriptionId,
} from "./helpers.js";

// ─── Chains ──────────────────────────────────────────────────────────────────
export {
  CHAINS,
  SUPPORTED_CHAINS,
  USDC_ADDRESSES,
  VIRIO_CONTRACT_ADDRESS,
  resolveChain,
  usdcAddressFor,
  mainnet,
  base,
  arbitrum,
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  foundry,
} from "./chains.js";
export type { ChainName, Chain } from "./chains.js";

// ─── Types ───────────────────────────────────────────────────────────────────
export type {
  Plan,
  PlanRecord,
  Subscription,
  SubscriptionRecord,
  SubscriptionRole,
  Charge,
  Fees,
  PreparedTransaction,
  PreparedCheckout,
  ListOptions,
  CreatePlanParams,
  SubscribeParams,
  VirioEvent,
  VirioEventType,
  SubscriptionChargedData,
  SubscriptionCreatedData,
} from "./types.js";
