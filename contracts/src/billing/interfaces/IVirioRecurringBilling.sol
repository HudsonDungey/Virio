// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVirioRecurringBilling
/// @notice Fixed-amount, fixed-interval billing. Merchants publish plans;
///         payers bind an authorization to one; anyone charges a due
///         subscription and earns the executor fee.
interface IVirioRecurringBilling {
    // ─── Errors ──────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidAmount();
    error InvalidPeriod();
    error PlanNotActive(bytes32 planId);
    error UnauthorizedMerchant(bytes32 planId);
    error AlreadySubscribed(bytes32 subscriptionId);
    error NotSubscribed(bytes32 subscriptionId);
    error TooEarlyToCharge(bytes32 subscriptionId, uint64 nextChargeAt);
    /// Authorization is revoked, or its payer is not the caller.
    error AuthorizationNotUsable(bytes32 authorizationId);
    error AuthorizationMerchantMismatch(bytes32 authorizationId);
    error AuthorizationTokenMismatch(bytes32 authorizationId);
    /// The authorization's maxPerCharge is below the plan's price.
    error AuthorizationLimitTooLow(bytes32 authorizationId);

    // ─── Events ──────────────────────────────────────────────────────────────

    event PlanCreated(
        bytes32 indexed planId,
        address indexed merchant,
        address token,
        uint128 amount,
        uint64 period
    );

    event PlanDeactivated(bytes32 indexed planId, address indexed merchant);

    event Subscribed(
        bytes32 indexed subscriptionId,
        bytes32 indexed planId,
        bytes32 indexed authorizationId,
        address payer,
        uint128 amount,
        uint64 period
    );

    event SubscriptionCancelled(bytes32 indexed subscriptionId, address indexed caller);

    /// @dev The money detail (fees, recipients) is in the registry's `Settled`
    ///      event for the same transaction. This one carries only what is
    ///      specific to recurring billing, so indexers never double-count.
    event RecurringChargeExecuted(
        bytes32 indexed subscriptionId,
        bytes32 indexed authorizationId,
        address indexed executor,
        uint256 amount,
        uint256 merchantAmount,
        uint64 nextChargeAt
    );

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Plan {
        address merchant;
        uint64 period;
        address token;
        uint128 amount;
        bool active;
    }

    struct Subscription {
        bytes32 authorizationId;
        bytes32 planId;
        address payer;
        uint64 nextChargeAt;
        uint128 amount; // denormalized from the plan at subscribe time
        uint64 period; // denormalized from the plan at subscribe time
        bool active;
    }

    // ─── Functions ───────────────────────────────────────────────────────────

    function createPlan(address token, uint128 amount, uint64 period)
        external
        returns (bytes32 planId);

    function deactivatePlan(bytes32 planId) external;

    function subscribe(bytes32 planId, bytes32 authorizationId)
        external
        returns (bytes32 subscriptionId);

    function cancel(bytes32 subscriptionId) external;

    function charge(bytes32 subscriptionId) external;

    function getPlan(bytes32 planId) external view returns (Plan memory);

    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory);

    function chargeable(bytes32 subscriptionId) external view returns (bool ok, bytes4 reason);

    function computeSubscriptionId(bytes32 planId, address payer) external pure returns (bytes32);
}
