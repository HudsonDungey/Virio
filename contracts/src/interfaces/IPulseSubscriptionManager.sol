// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPulseSubscriptionManager
/// @notice Pull-based ERC-20 subscription protocol.
///         Merchants create Plans; customers subscribe; anyone calls charge()
///         and earns EXECUTOR_FEE_BPS — all timing and cap enforcement
///         happens on-chain, Pulse never custodies funds.
interface IPulseSubscriptionManager {
    // ─── Errors ──────────────────────────────────────────────────────────────

    /// Plan does not exist or has been deactivated.
    error PlanNotActive(bytes32 planId);

    /// Customer already has an active subscription to this plan.
    error AlreadySubscribed(bytes32 subscriptionId);

    /// No active subscription found for this id.
    error NotSubscribed(bytes32 subscriptionId);

    /// charge() called before the subscription's next-charge timestamp.
    error TooEarlyToCharge(bytes32 subscriptionId, uint256 nextChargeAt);

    /// Charging would exceed the customer's optional total spend cap.
    error SpendCapExceeded(bytes32 subscriptionId);

    /// Caller is not the plan's merchant.
    error UnauthorizedMerchant(bytes32 planId);

    /// A required address argument was the zero address.
    error ZeroAddress();

    /// amount must be > 0.
    error InvalidAmount();

    /// period must be > 0.
    error InvalidPeriod();

    // ─── Events ──────────────────────────────────────────────────────────────

    event PlanCreated(
        bytes32 indexed planId,
        address indexed merchant,
        address token,
        uint256 amount,
        uint256 period
    );

    event PlanDeactivated(bytes32 indexed planId, address indexed merchant);

    event Subscribed(
        bytes32 indexed subscriptionId,
        bytes32 indexed planId,
        address indexed customer,
        uint256 totalSpendCap
    );

    /// Emitted on every successful charge.
    /// @param executor       Address that called charge() and received executorFee.
    /// @param customer       Customer who was charged.
    /// @param gross          Total amount pulled from customer.
    /// @param merchantAmount Net amount transferred to merchant.
    /// @param executorFee    Amount transferred to the executor (EXECUTOR_FEE_BPS).
    /// @param protocolFee    Amount transferred to feeRecipient (plan.feeBps).
    /// @param nextChargeAt   Unix timestamp of the next allowed charge.
    event ChargeExecuted(
        bytes32 indexed subscriptionId,
        address indexed executor,
        address indexed customer,
        uint256 gross,
        uint256 merchantAmount,
        uint256 executorFee,
        uint256 protocolFee,
        uint256 nextChargeAt
    );

    event Cancelled(bytes32 indexed subscriptionId, address indexed caller);

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Plan {
        address merchant;
        address token;
        uint256 amount;   // gross amount (includes fees) per charge
        uint256 period;   // min seconds between charges
        bool    active;
    }

    struct Subscription {
        address customer;
        address merchant;
        address token;
        uint256 amount;         // denormalized from plan at subscribe time
        uint256 period;         // denormalized from plan at subscribe time
        uint256 nextChargeAt;   // unix timestamp of next allowed charge
        uint256 totalSpendCap;  // 0 = unlimited; set by customer at subscribe time
        uint256 totalSpent;     // cumulative gross amount charged so far
        bool    active;
    }

    // ─── Functions ───────────────────────────────────────────────────────────

    /// @notice Permissionless executor fee in basis points (0.1%).
    function EXECUTOR_FEE_BPS() external view returns (uint16);

    function createPlan(
        address token,
        uint256 amount,
        uint256 period
    ) external returns (bytes32 planId);

    function subscribe(
        bytes32 planId,
        uint256 totalSpendCap
    ) external returns (bytes32 subscriptionId);

    function charge(bytes32 subscriptionId) external;

    /// @notice Cancel a subscription. Callable by customer OR merchant.
    function cancel(bytes32 subscriptionId) external;

    function deactivatePlan(bytes32 planId) external;

    function getPlan(bytes32 planId)
        external view returns (Plan memory);

    function getSubscription(bytes32 subscriptionId)
        external view returns (Subscription memory);

    /// @notice Compute the deterministic subscription id for a (plan, customer) pair.
    function computeSubId(bytes32 planId, address customer)
        external pure returns (bytes32);
}
