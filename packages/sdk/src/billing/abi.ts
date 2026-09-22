/// ABIs for the Virio programmable billing stack, kept as TypeScript consts so
/// viem infers argument and return types without a codegen step.
///
/// These mirror contracts/src/billing/ exactly. The contracts are the source of
/// truth — when they change, regenerate this file from the forge artifacts.

/// VirioAuthorizationRegistry — the authorization and settlement layer.
export const REGISTRY_ABI = [
  { type: "constructor", inputs: [
      { name: "_feeRecipient", type: "address" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "MAX_PROTOCOL_FLAT_FEE", inputs: [], outputs: [
      { name: "", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "MAX_TOTAL_FEE_BPS", inputs: [], outputs: [
      { name: "", type: "uint16" }
    ], stateMutability: "view" },
  { type: "function", name: "authorizationNonce", inputs: [
      { name: "", type: "address" }
    ], outputs: [
      { name: "", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "authorize", inputs: [
      { name: "params", type: "tuple", components: [
          { name: "merchant", type: "address" },
          { name: "token", type: "address" },
          { name: "billingType", type: "uint8" },
          { name: "maxPerCharge", type: "uint128" },
          { name: "periodSpendCap", type: "uint128" },
          { name: "totalSpendCap", type: "uint128" },
          { name: "periodDuration", type: "uint64" },
          { name: "validAfter", type: "uint64" },
          { name: "validUntil", type: "uint64" }
        ] }
    ], outputs: [
      { name: "authorizationId", type: "bytes32" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "canSettle", inputs: [
      { name: "module", type: "address" },
      { name: "authorizationId", type: "bytes32" },
      { name: "amount", type: "uint256" }
    ], outputs: [
      { name: "ok", type: "bool" },
      { name: "reason", type: "bytes4" }
    ], stateMutability: "view" },
  { type: "function", name: "computeAuthorizationId", inputs: [
      { name: "payer", type: "address" },
      { name: "nonce", type: "uint256" }
    ], outputs: [
      { name: "", type: "bytes32" }
    ], stateMutability: "view" },
  { type: "function", name: "executorFeeBps", inputs: [], outputs: [
      { name: "", type: "uint16" }
    ], stateMutability: "view" },
  { type: "function", name: "feeRecipient", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "getAuthorization", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ], outputs: [
      { name: "", type: "tuple", components: [
          { name: "payer", type: "address" },
          { name: "billingType", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "periodDuration", type: "uint64" },
          { name: "merchant", type: "address" },
          { name: "periodStart", type: "uint64" },
          { name: "token", type: "address" },
          { name: "validAfter", type: "uint64" },
          { name: "validUntil", type: "uint64" },
          { name: "maxPerCharge", type: "uint128" },
          { name: "periodSpendCap", type: "uint128" },
          { name: "totalSpendCap", type: "uint128" },
          { name: "spentThisPeriod", type: "uint128" },
          { name: "totalSpent", type: "uint128" }
        ] }
    ], stateMutability: "view" },
  { type: "function", name: "moduleStatus", inputs: [
      { name: "module", type: "address" }
    ], outputs: [
      { name: "", type: "uint8" }
    ], stateMutability: "view" },
  { type: "function", name: "owner", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "protocolFeeBps", inputs: [], outputs: [
      { name: "", type: "uint16" }
    ], stateMutability: "view" },
  { type: "function", name: "protocolFlatFee", inputs: [], outputs: [
      { name: "", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "remaining", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ], outputs: [
      { name: "perCharge", type: "uint256" },
      { name: "thisPeriod", type: "uint256" },
      { name: "lifetime", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "restrict", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "maxPerCharge", type: "uint128" },
      { name: "periodSpendCap", type: "uint128" },
      { name: "totalSpendCap", type: "uint128" },
      { name: "validUntil", type: "uint64" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "revoke", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setFeeConfig", inputs: [
      { name: "_executorFeeBps", type: "uint16" },
      { name: "_protocolFeeBps", type: "uint16" },
      { name: "_protocolFlatFee", type: "uint256" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setFeeRecipient", inputs: [
      { name: "newRecipient", type: "address" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "setModuleStatus", inputs: [
      { name: "module", type: "address" },
      { name: "status", type: "uint8" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "settle", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "executor", type: "address" }
    ], outputs: [
      { name: "merchantAmount", type: "uint256" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "transferOwnership", inputs: [
      { name: "newOwner", type: "address" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "event", name: "AuthorizationCreated", inputs: [
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "billingType", type: "uint8", indexed: false },
      { name: "maxPerCharge", type: "uint128", indexed: false },
      { name: "periodSpendCap", type: "uint128", indexed: false },
      { name: "totalSpendCap", type: "uint128", indexed: false },
      { name: "periodDuration", type: "uint64", indexed: false },
      { name: "validAfter", type: "uint64", indexed: false },
      { name: "validUntil", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "AuthorizationRevoked", inputs: [
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "caller", type: "address", indexed: true }
    ] },
  { type: "event", name: "AuthorizationUpdated", inputs: [
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "maxPerCharge", type: "uint128", indexed: false },
      { name: "periodSpendCap", type: "uint128", indexed: false },
      { name: "totalSpendCap", type: "uint128", indexed: false },
      { name: "validUntil", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "FeeConfigSet", inputs: [
      { name: "executorFeeBps", type: "uint16", indexed: false },
      { name: "protocolFeeBps", type: "uint16", indexed: false },
      { name: "protocolFlatFee", type: "uint256", indexed: false }
    ] },
  { type: "event", name: "FeeRecipientSet", inputs: [
      { name: "feeRecipient", type: "address", indexed: true }
    ] },
  { type: "event", name: "ModuleStatusSet", inputs: [
      { name: "module", type: "address", indexed: true },
      { name: "status", type: "uint8", indexed: false }
    ] },
  { type: "event", name: "OwnershipTransferred", inputs: [
      { name: "previousOwner", type: "address", indexed: true },
      { name: "newOwner", type: "address", indexed: true }
    ] },
  { type: "event", name: "Settled", inputs: [
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "module", type: "address", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "gross", type: "uint256", indexed: false },
      { name: "merchantAmount", type: "uint256", indexed: false },
      { name: "executorFee", type: "uint256", indexed: false },
      { name: "protocolFee", type: "uint256", indexed: false },
      { name: "periodStart", type: "uint64", indexed: false }
    ] },
  { type: "error", name: "AmountOverflow", inputs: [] },
  { type: "error", name: "AuthorizationExpired", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "validUntil", type: "uint64" }
    ] },
  { type: "error", name: "AuthorizationNotActive", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "AuthorizationNotYetValid", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "validAfter", type: "uint64" }
    ] },
  { type: "error", name: "IncompatibleBillingType", inputs: [
      { name: "module", type: "address" },
      { name: "authorizationType", type: "uint8" }
    ] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidFeeConfiguration", inputs: [] },
  { type: "error", name: "InvalidPeriod", inputs: [] },
  { type: "error", name: "InvalidWindow", inputs: [] },
  { type: "error", name: "MaxPerChargeExceeded", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "maxPerCharge", type: "uint128" }
    ] },
  { type: "error", name: "ModuleNotActive", inputs: [
      { name: "module", type: "address" }
    ] },
  { type: "error", name: "NotAuthorizationParty", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "PeriodSpendCapExceeded", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "wouldSpend", type: "uint256" },
      { name: "cap", type: "uint128" }
    ] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  { type: "error", name: "SafeERC20FailedOperation", inputs: [
      { name: "token", type: "address" }
    ] },
  { type: "error", name: "TokenMismatch", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "expected", type: "address" },
      { name: "actual", type: "address" }
    ] },
  { type: "error", name: "TotalSpendCapExceeded", inputs: [
      { name: "authorizationId", type: "bytes32" },
      { name: "wouldSpend", type: "uint256" },
      { name: "cap", type: "uint128" }
    ] },
  { type: "error", name: "ZeroAddress", inputs: [] }
] as const;
export type REGISTRYAbi = typeof REGISTRY_ABI;

/// VirioRecurringBilling — fixed-amount, fixed-interval billing module.
export const RECURRING_ABI = [
  { type: "constructor", inputs: [
      { name: "registry_", type: "address" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "BILLING_TYPE", inputs: [], outputs: [
      { name: "", type: "uint8" }
    ], stateMutability: "pure" },
  { type: "function", name: "REGISTRY", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "cancel", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "charge", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "chargeable", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ], outputs: [
      { name: "ok", type: "bool" },
      { name: "reason", type: "bytes4" }
    ], stateMutability: "view" },
  { type: "function", name: "computeSubscriptionId", inputs: [
      { name: "planId", type: "bytes32" },
      { name: "payer", type: "address" }
    ], outputs: [
      { name: "", type: "bytes32" }
    ], stateMutability: "pure" },
  { type: "function", name: "createPlan", inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint128" },
      { name: "period", type: "uint64" }
    ], outputs: [
      { name: "planId", type: "bytes32" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "deactivatePlan", inputs: [
      { name: "planId", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "getPlan", inputs: [
      { name: "planId", type: "bytes32" }
    ], outputs: [
      { name: "", type: "tuple", components: [
          { name: "merchant", type: "address" },
          { name: "period", type: "uint64" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint128" },
          { name: "active", type: "bool" }
        ] }
    ], stateMutability: "view" },
  { type: "function", name: "getSubscription", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ], outputs: [
      { name: "", type: "tuple", components: [
          { name: "authorizationId", type: "bytes32" },
          { name: "planId", type: "bytes32" },
          { name: "payer", type: "address" },
          { name: "nextChargeAt", type: "uint64" },
          { name: "amount", type: "uint128" },
          { name: "period", type: "uint64" },
          { name: "active", type: "bool" }
        ] }
    ], stateMutability: "view" },
  { type: "function", name: "planNonce", inputs: [
      { name: "", type: "address" }
    ], outputs: [
      { name: "", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "registry", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "subscribe", inputs: [
      { name: "planId", type: "bytes32" },
      { name: "authorizationId", type: "bytes32" }
    ], outputs: [
      { name: "subscriptionId", type: "bytes32" }
    ], stateMutability: "nonpayable" },
  { type: "event", name: "PlanCreated", inputs: [
      { name: "planId", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint128", indexed: false },
      { name: "period", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "PlanDeactivated", inputs: [
      { name: "planId", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true }
    ] },
  { type: "event", name: "RecurringChargeExecuted", inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "merchantAmount", type: "uint256", indexed: false },
      { name: "nextChargeAt", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "Subscribed", inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "planId", type: "bytes32", indexed: true },
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: false },
      { name: "amount", type: "uint128", indexed: false },
      { name: "period", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "SubscriptionCancelled", inputs: [
      { name: "subscriptionId", type: "bytes32", indexed: true },
      { name: "caller", type: "address", indexed: true }
    ] },
  { type: "error", name: "AlreadySubscribed", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ] },
  { type: "error", name: "AuthorizationLimitTooLow", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "AuthorizationMerchantMismatch", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "AuthorizationNotUsable", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "AuthorizationTokenMismatch", inputs: [
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidPeriod", inputs: [] },
  { type: "error", name: "NotSubscribed", inputs: [
      { name: "subscriptionId", type: "bytes32" }
    ] },
  { type: "error", name: "PlanNotActive", inputs: [
      { name: "planId", type: "bytes32" }
    ] },
  { type: "error", name: "TooEarlyToCharge", inputs: [
      { name: "subscriptionId", type: "bytes32" },
      { name: "nextChargeAt", type: "uint64" }
    ] },
  { type: "error", name: "UnauthorizedMerchant", inputs: [
      { name: "planId", type: "bytes32" }
    ] },
  { type: "error", name: "ZeroAddress", inputs: [] }
] as const;
export type RECURRINGAbi = typeof RECURRING_ABI;

/// VirioMeteredBilling — usage billing from merchant-signed statements.
export const METERED_ABI = [
  { type: "constructor", inputs: [
      { name: "registry_", type: "address" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "BILLING_TYPE", inputs: [], outputs: [
      { name: "", type: "uint8" }
    ], stateMutability: "pure" },
  { type: "function", name: "REGISTRY", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "createMeter", inputs: [
      { name: "token", type: "address" },
      { name: "unit", type: "bytes32" },
      { name: "unitPrice", type: "uint128" },
      { name: "includedUnitsPerPeriod", type: "uint128" },
      { name: "settlementInterval", type: "uint64" }
    ], outputs: [
      { name: "meterId", type: "bytes32" }
    ], stateMutability: "nonpayable" },
  { type: "function", name: "disableMeter", inputs: [
      { name: "meterId", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "eip712Domain", inputs: [], outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" }
    ], stateMutability: "view" },
  { type: "function", name: "getMeter", inputs: [
      { name: "meterId", type: "bytes32" }
    ], outputs: [
      { name: "", type: "tuple", components: [
          { name: "merchant", type: "address" },
          { name: "settlementInterval", type: "uint64" },
          { name: "token", type: "address" },
          { name: "unitPrice", type: "uint128" },
          { name: "includedUnitsPerPeriod", type: "uint128" },
          { name: "unit", type: "bytes32" },
          { name: "active", type: "bool" }
        ] }
    ], stateMutability: "view" },
  { type: "function", name: "hashStatement", inputs: [
      { name: "statement", type: "tuple", components: [
          { name: "meterId", type: "bytes32" },
          { name: "authorizationId", type: "bytes32" },
          { name: "periodStart", type: "uint64" },
          { name: "periodEnd", type: "uint64" },
          { name: "units", type: "uint128" },
          { name: "unitPrice", type: "uint128" },
          { name: "amount", type: "uint128" },
          { name: "nonce", type: "uint256" }
        ] }
    ], outputs: [
      { name: "", type: "bytes32" }
    ], stateMutability: "view" },
  { type: "function", name: "isNonceUsed", inputs: [
      { name: "merchant", type: "address" },
      { name: "nonce", type: "uint256" }
    ], outputs: [
      { name: "", type: "bool" }
    ], stateMutability: "view" },
  { type: "function", name: "lastSettledEnd", inputs: [
      { name: "meterId", type: "bytes32" },
      { name: "authorizationId", type: "bytes32" }
    ], outputs: [
      { name: "", type: "uint64" }
    ], stateMutability: "view" },
  { type: "function", name: "meterNonce", inputs: [
      { name: "", type: "address" }
    ], outputs: [
      { name: "", type: "uint256" }
    ], stateMutability: "view" },
  { type: "function", name: "registry", inputs: [], outputs: [
      { name: "", type: "address" }
    ], stateMutability: "view" },
  { type: "function", name: "settle", inputs: [
      { name: "statement", type: "tuple", components: [
          { name: "meterId", type: "bytes32" },
          { name: "authorizationId", type: "bytes32" },
          { name: "periodStart", type: "uint64" },
          { name: "periodEnd", type: "uint64" },
          { name: "units", type: "uint128" },
          { name: "unitPrice", type: "uint128" },
          { name: "amount", type: "uint128" },
          { name: "nonce", type: "uint256" }
        ] },
      { name: "signature", type: "bytes" }
    ], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "settleable", inputs: [
      { name: "statement", type: "tuple", components: [
          { name: "meterId", type: "bytes32" },
          { name: "authorizationId", type: "bytes32" },
          { name: "periodStart", type: "uint64" },
          { name: "periodEnd", type: "uint64" },
          { name: "units", type: "uint128" },
          { name: "unitPrice", type: "uint128" },
          { name: "amount", type: "uint128" },
          { name: "nonce", type: "uint256" }
        ] }
    ], outputs: [
      { name: "ok", type: "bool" },
      { name: "reason", type: "bytes4" }
    ], stateMutability: "view" },
  { type: "event", name: "EIP712DomainChanged", inputs: [] },
  { type: "event", name: "MeterCreated", inputs: [
      { name: "meterId", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "unit", type: "bytes32", indexed: false },
      { name: "unitPrice", type: "uint128", indexed: false },
      { name: "includedUnitsPerPeriod", type: "uint128", indexed: false },
      { name: "settlementInterval", type: "uint64", indexed: false }
    ] },
  { type: "event", name: "MeterDisabled", inputs: [
      { name: "meterId", type: "bytes32", indexed: true },
      { name: "merchant", type: "address", indexed: true }
    ] },
  { type: "event", name: "MeterSettlementExecuted", inputs: [
      { name: "meterId", type: "bytes32", indexed: true },
      { name: "authorizationId", type: "bytes32", indexed: true },
      { name: "executor", type: "address", indexed: true },
      { name: "units", type: "uint128", indexed: false },
      { name: "unitPrice", type: "uint128", indexed: false },
      { name: "amount", type: "uint128", indexed: false },
      { name: "periodStart", type: "uint64", indexed: false },
      { name: "periodEnd", type: "uint64", indexed: false },
      { name: "nonce", type: "uint256", indexed: false }
    ] },
  { type: "error", name: "AmountMismatch", inputs: [
      { name: "expected", type: "uint256" },
      { name: "actual", type: "uint256" }
    ] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidPeriod", inputs: [] },
  { type: "error", name: "InvalidShortString", inputs: [] },
  { type: "error", name: "InvalidSignature", inputs: [
      { name: "meterId", type: "bytes32" }
    ] },
  { type: "error", name: "InvalidStatementWindow", inputs: [
      { name: "periodStart", type: "uint64" },
      { name: "periodEnd", type: "uint64" }
    ] },
  { type: "error", name: "InvalidUnit", inputs: [] },
  { type: "error", name: "MeterAuthorizationMismatch", inputs: [
      { name: "meterId", type: "bytes32" },
      { name: "authorizationId", type: "bytes32" }
    ] },
  { type: "error", name: "MeterNotActive", inputs: [
      { name: "meterId", type: "bytes32" }
    ] },
  { type: "error", name: "NonceAlreadyUsed", inputs: [
      { name: "merchant", type: "address" },
      { name: "nonce", type: "uint256" }
    ] },
  { type: "error", name: "StatementInFuture", inputs: [
      { name: "periodEnd", type: "uint64" }
    ] },
  { type: "error", name: "StatementWindowOverlap", inputs: [
      { name: "periodStart", type: "uint64" },
      { name: "lastSettledEnd", type: "uint64" }
    ] },
  { type: "error", name: "StringTooLong", inputs: [
      { name: "str", type: "string" }
    ] },
  { type: "error", name: "TokenMismatch", inputs: [
      { name: "meterId", type: "bytes32" }
    ] },
  { type: "error", name: "UnauthorizedMerchant", inputs: [
      { name: "meterId", type: "bytes32" }
    ] },
  { type: "error", name: "UnitPriceMismatch", inputs: [
      { name: "meterId", type: "bytes32" },
      { name: "expected", type: "uint128" },
      { name: "actual", type: "uint128" }
    ] },
  { type: "error", name: "ZeroAddress", inputs: [] }
] as const;
export type METEREDAbi = typeof METERED_ABI;
