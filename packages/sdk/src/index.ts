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

// ─── Config loading ──────────────────────────────────────────────────────────
export { loadConfig, resolveFileConfig, findConfigFile } from "./config.js";
export type {
  VirioFileConfig,
  ChainFileConfig,
  LoadConfigOptions,
} from "./config.js";

// ─── ABIs ──────────────────────────────────────────────────────────────────
export { VIRIO_ABI, ERC20_ABI } from "./abi.js";
export type { VirioAbi, Erc20Abi } from "./abi.js";

// ─── Webhooks ────────────────────────────────────────────────────────────────
export { signWebhook, verifyWebhook, buildEvent } from "./webhooks.js";

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
  CreatePlanParams,
  SubscribeParams,
  VirioEvent,
  VirioEventType,
  SubscriptionChargedData,
  SubscriptionCreatedData,
} from "./types.js";
