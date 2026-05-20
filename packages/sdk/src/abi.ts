/// ABI for VirioSubscriptionManager — kept as a TypeScript const so viem
/// can infer argument and return types without a codegen step.
export const VIRIO_ABI = [
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
] as const;
