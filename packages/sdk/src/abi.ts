/// ABI for VirioSubscriptionManager — kept as a TypeScript const so viem
/// can infer argument and return types without a codegen step.
///
/// This mirrors contracts/src/VirioSubscriptionManager.sol exactly. If the
/// contract changes, update this file (it is the SDK's source of truth for
/// encoding/decoding calls and logs).
export const VIRIO_ABI = [
  // ─── Errors ──────────────────────────────────────────────────────────────
  { type: "error", name: "PlanNotActive",        inputs: [{ name: "planId",         type: "bytes32" }] },
  { type: "error", name: "AlreadySubscribed",    inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "NotSubscribed",        inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "TooEarlyToCharge",     inputs: [{ name: "subscriptionId", type: "bytes32" }, { name: "nextChargeAt", type: "uint256" }] },
  { type: "error", name: "SpendCapExceeded",     inputs: [{ name: "subscriptionId", type: "bytes32" }] },
  { type: "error", name: "UnauthorizedMerchant", inputs: [{ name: "planId",         type: "bytes32" }] },
  { type: "error", name: "ZeroAddress",          inputs: [] },
  { type: "error", name: "InvalidAmount",        inputs: [] },
  { type: "error", name: "InvalidPeriod",        inputs: [] },

  // ─── Events ──────────────────────────────────────────────────────────────
  {
    type: "event", name: "PlanCreated",
    inputs: [
      { name: "planId",   type: "bytes32", indexed: true  },
      { name: "merchant", type: "address", indexed: true  },
      { name: "token",    type: "address", indexed: false },
      { name: "amount",   type: "uint256", indexed: false },
      { name: "period",   type: "uint256", indexed: false },
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
      { name: "subscriptionId", type: "bytes32", indexed: true  },
      { name: "planId",         type: "bytes32", indexed: true  },
      { name: "customer",       type: "address", indexed: true  },
      { name: "totalSpendCap",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "ChargeExecuted",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true  },
      { name: "executor",       type: "address", indexed: true  },
      { name: "customer",       type: "address", indexed: true  },
      { name: "gross",          type: "uint256", indexed: false },
      { name: "merchantAmount", type: "uint256", indexed: false },
      { name: "executorFee",    type: "uint256", indexed: false },
      { name: "protocolFee",    type: "uint256", indexed: false },
      { name: "nextChargeAt",   type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Cancelled",
    inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "caller",         type: "address", indexed: true },
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
      { name: "token",  type: "address" },
      { name: "amount", type: "uint256" },
      { name: "period", type: "uint256" },
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
  {
    type: "function", name: "setExecutorFeeBps",
    stateMutability: "nonpayable",
    inputs: [{ name: "_bps", type: "uint16" }],
    outputs: [],
  },
  {
    type: "function", name: "setProtocolFeeBps",
    stateMutability: "nonpayable",
    inputs: [{ name: "_bps", type: "uint16" }],
    outputs: [],
  },
  {
    type: "function", name: "setProtocolFlatFee",
    stateMutability: "nonpayable",
    inputs: [{ name: "_fee", type: "uint256" }],
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
          { name: "merchant", type: "address" },
          { name: "token",    type: "address" },
          { name: "amount",   type: "uint256" },
          { name: "period",   type: "uint256" },
          { name: "active",   type: "bool"    },
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
          { name: "customer",      type: "address" },
          { name: "merchant",      type: "address" },
          { name: "token",         type: "address" },
          { name: "amount",        type: "uint256" },
          { name: "period",        type: "uint256" },
          { name: "nextChargeAt",  type: "uint256" },
          { name: "totalSpendCap", type: "uint256" },
          { name: "totalSpent",    type: "uint256" },
          { name: "active",        type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function", name: "computeSubId",
    stateMutability: "pure",
    inputs: [
      { name: "planId",   type: "bytes32" },
      { name: "customer", type: "address" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function", name: "EXECUTOR_FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function", name: "executorFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function", name: "protocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function", name: "protocolFlatFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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

export type VirioAbi = typeof VIRIO_ABI;

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
  {
    type: "function", name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export type Erc20Abi = typeof ERC20_ABI;
