/// ABI for PulseSubscriptionManager — kept as a TypeScript const so viem
/// can infer argument and return types without a codegen step.
export const PULSE_ABI = [
  // ─── Errors ──────────────────────────────────────────────────────────────
  { type: "error", name: "PlanNotActive",         inputs: [{ name: "planId",         type: "bytes32" }] },
  { type: "error", name: "AlreadySubscribed",     inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "NotSubscribed",         inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "TooEarlyToCharge",      inputs: [{ name: "subscriptionId", type: "bytes32" }, { name: "nextChargeAt", type: "uint256" }] },
  { type: "error", name: "SpendCapExceeded",      inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "PerChargeCapExceeded",  inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "UnauthorizedMerchant",  inputs: [{ name: "planId",         type: "bytes32" }] },
  { type: "error", name: "ZeroAddress",           inputs: [] },
  { type: "error", name: "InvalidAmount",         inputs: [] },
  { type: "error", name: "InvalidPeriod",         inputs: [] },
  { type: "error", name: "InvalidFeeBps",         inputs: [] },

  // ─── Events ──────────────────────────────────────────────────────────────
  {
    type: "event", name: "PlanCreated",
    inputs: [
      { name: "planId",             type: "bytes32", indexed: true },
      { name: "merchant",           type: "address", indexed: true },
      { name: "token",              type: "address", indexed: false },
      { name: "amount",             type: "uint256", indexed: false },
      { name: "period",             type: "uint256", indexed: false },
      { name: "maxAmountPerCharge", type: "uint256", indexed: false },
      { name: "feeBps",             type: "uint16",  indexed: false },
    ],
  },
  {
    type: "event", name: "PlanDeactivated",
    inputs: [
      { name: "planId",   type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true },
    ],
  },
  {
    type: "event", name: "Subscribed",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "planId",         type: "bytes32", indexed: true },
      { name: "customer",       type: "address", indexed: true },
      { name: "totalSpendCap",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Charged",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "customer",       type: "address", indexed: true },
      { name: "merchant",       type: "address", indexed: true },
      { name: "amount",         type: "uint256", indexed: false },
      { name: "fee",            type: "uint256", indexed: false },
      { name: "nextChargeAt",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Cancelled",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "customer",       type: "address", indexed: true },
    ],
  },

  // ─── Constructor ─────────────────────────────────────────────────────────
  {
    type: "constructor",
    inputs: [{ name: "_feeRecipient", type: "address" }],
    stateMutability: "nonpayable",
  },

  // ─── Write functions ─────────────────────────────────────────────────────
  {
    type: "function", name: "createPlan",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token",              type: "address" },
      { name: "amount",             type: "uint256" },
      { name: "period",             type: "uint256" },
      { name: "maxAmountPerCharge", type: "uint256" },
      { name: "feeBps",             type: "uint16"  },
    ],
    outputs: [{ name: "planId", type: "bytes32" }],
  },
  {
    type: "function", name: "subscribe",
    stateMutability: "nonpayable",
    inputs: [
      { name: "planId",        type: "bytes32" },
      { name: "totalSpendCap", type: "uint256" },
    ],
    outputs: [{ name: "subscriptionId", type: "bytes32" }],
  },
  {
    type: "function", name: "charge",
    stateMutability: "nonpayable",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function", name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function", name: "deactivatePlan",
    stateMutability: "nonpayable",
    inputs: [{ name: "planId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function", name: "setFeeRecipient",
    stateMutability: "nonpayable",
    inputs: [{ name: "newRecipient", type: "address" }],
    outputs: [],
  },
  {
    type: "function", name: "transferOwnership",
    stateMutability: "nonpayable",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
  },

  // ─── View functions ───────────────────────────────────────────────────────
  {
    type: "function", name: "getPlan",
    stateMutability: "view",
    inputs: [{ name: "planId", type: "bytes32" }],
    outputs: [
      {
        name: "", type: "tuple",
        components: [
          { name: "merchant",           type: "address" },
          { name: "token",              type: "address" },
          { name: "amount",             type: "uint256" },
          { name: "period",             type: "uint256" },
          { name: "maxAmountPerCharge", type: "uint256" },
          { name: "feeBps",             type: "uint16"  },
          { name: "active",             type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function", name: "getSubscription",
    stateMutability: "view",
    inputs: [{ name: "subscriptionId", type: "bytes32" }],
    outputs: [
      {
        name: "", type: "tuple",
        components: [
          { name: "planId",        type: "bytes32" },
          { name: "customer",      type: "address" },
          { name: "nextChargeAt",  type: "uint256" },
          { name: "totalSpent",    type: "uint256" },
          { name: "totalSpendCap", type: "uint256" },
          { name: "active",        type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function", name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "feeRecipient",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export type PulseAbi = typeof PULSE_ABI;

// ─── PulseExecutor ABI ───────────────────────────────────────────────────────
// Keep this in lockstep with /contracts/src/PulseExecutor.sol. Only the
// surface the off-chain bot uses — keeper entrypoints + key views/events.

export const EXECUTOR_ABI = [
  // Keeper entrypoints
  {
    type: "function", name: "execute",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function", name: "executeBatch",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentIds", type: "bytes32[]" }],
    outputs: [],
  },

  // Views the bot uses to inspect state
  {
    type: "function", name: "computePaymentId",
    stateMutability: "view",
    inputs: [{ name: "manager", type: "address" }, { name: "innerId", type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function", name: "getPayment",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "kind",        type: "uint8"   },
          { name: "manager",     type: "address" },
          { name: "planId",      type: "bytes32" },
          { name: "innerId",     type: "bytes32" },
          { name: "scheduledAt", type: "uint64"  },
          { name: "period",      type: "uint64"  },
          { name: "registered",  type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function", name: "dynamicFeeBps",
    stateMutability: "view",
    inputs: [{ name: "delaySeconds", type: "uint256" }],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "function", name: "isRestricted",
    stateMutability: "view",
    inputs: [{ name: "executor", type: "address" }],
    outputs: [{ type: "bool" }],
  },

  // Events the bot subscribes to
  {
    type: "event", name: "PaymentRegistered",
    inputs: [
      { name: "paymentId",   type: "bytes32", indexed: true },
      { name: "manager",     type: "address", indexed: true },
      { name: "kind",        type: "uint8",   indexed: false },
      { name: "planId",      type: "bytes32", indexed: false },
      { name: "innerId",     type: "bytes32", indexed: false },
      { name: "scheduledAt", type: "uint64",  indexed: false },
      { name: "period",      type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event", name: "PaymentDeregistered",
    inputs: [
      { name: "paymentId", type: "bytes32", indexed: true },
      { name: "manager",   type: "address", indexed: true },
    ],
  },
  {
    type: "event", name: "ExecutionSucceeded",
    inputs: [
      { name: "paymentId",       type: "bytes32", indexed: true },
      { name: "executor",        type: "address", indexed: true },
      { name: "grossAmount",     type: "uint256", indexed: false },
      { name: "executorReward",  type: "uint256", indexed: false },
      { name: "withheld",        type: "uint256", indexed: false },
      { name: "bpsApplied",      type: "uint16",  indexed: false },
      { name: "delaySeconds",    type: "uint64",  indexed: false },
      { name: "nextScheduledAt", type: "uint64",  indexed: false },
    ],
  },
  {
    type: "event", name: "ExecutionFailed",
    inputs: [
      { name: "paymentId",  type: "bytes32", indexed: true },
      { name: "executor",   type: "address", indexed: true },
      { name: "reasonHash", type: "bytes32", indexed: false },
    ],
  },
] as const;

export type ExecutorAbi = typeof EXECUTOR_ABI;

// ─── Minimal ERC-20 ABI ───────────────────────────────────────────────────────

export const ERC20_ABI = [
  {
    type: "function", name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;
