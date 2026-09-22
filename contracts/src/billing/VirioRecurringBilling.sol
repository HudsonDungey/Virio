// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// VirioRecurringBilling — billing module #1
//
// The subscription model Virio started with, re-expressed as a billing module.
// Plans and due-dates live here; spend limits and the transfer live in the
// authorization registry. The split is the point: the same caps that bound a
// metered settlement bound a recurring charge, because both go through settle().
//
// Differences from the deployed VirioSubscriptionManager (see docs/migration):
//   * The customer's spend limits move from the subscription to a reusable
//     Authorization, so one authorization can back both a base subscription and
//     metered usage (hybrid billing).
//   * Exceeding a cap reverts with a typed error instead of silently
//     auto-cancelling the subscription. A cap hit is a condition the payer
//     should see and decide about, not a state the executor destroys.
//   * Per-merchant aggregate counters are gone. They cost an SSTORE on every
//     charge and the registry's Settled event already carries the same numbers.
//
// Key design invariants:
//   1. charge() is permissionless; the caller earns the executor fee.
//   2. Checks-Effects-Interactions: nextChargeAt advances before settle().
//   3. nextChargeAt = block.timestamp + period — one charge per period,
//      regardless of backlog. Matches the deployed manager's behaviour.
//   4. subscriptionId = keccak256(planId ‖ payer) — deterministic, unchanged.
//   5. amount and period are denormalized at subscribe() time, so editing a
//      plan never changes what an existing subscriber already agreed to.
// ─────────────────────────────────────────────────────────────────────────────

import {IVirioAuthorizationRegistry} from "./interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioBillingModule} from "./interfaces/IVirioBillingModule.sol";
import {IVirioRecurringBilling} from "./interfaces/IVirioRecurringBilling.sol";

contract VirioRecurringBilling is IVirioRecurringBilling, IVirioBillingModule {
    // ─── Immutables ───────────────────────────────────────────────────────────

    IVirioAuthorizationRegistry public immutable REGISTRY;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev Per-merchant nonce; makes plan ids unique without a global counter.
    mapping(address => uint256) public planNonce;

    mapping(bytes32 => Plan) private _plans;
    mapping(bytes32 => Subscription) private _subscriptions;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(IVirioAuthorizationRegistry registry_) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        REGISTRY = registry_;
    }

    function BILLING_TYPE() external pure returns (IVirioAuthorizationRegistry.BillingType) {
        return IVirioAuthorizationRegistry.BillingType.RECURRING;
    }

    function registry() external view returns (IVirioAuthorizationRegistry) {
        return REGISTRY;
    }

    // ─── Plans ────────────────────────────────────────────────────────────────

    /// @notice Merchant publishes a recurring price. Creating a plan grants
    ///         nothing — a plan is an offer until a payer authorizes it.
    function createPlan(address token, uint128 amount, uint64 period)
        external
        returns (bytes32 planId)
    {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (period == 0) revert InvalidPeriod();

        uint256 nonce = ++planNonce[msg.sender];
        planId = keccak256(abi.encodePacked(msg.sender, nonce, block.chainid));

        _plans[planId] =
            Plan({merchant: msg.sender, token: token, amount: amount, period: period, active: true});

        emit PlanCreated(planId, msg.sender, token, amount, period);
    }

    /// @notice Stop accepting new subscribers. Existing subscriptions keep their
    ///         own denormalized terms and continue charging until cancelled.
    function deactivatePlan(bytes32 planId) external {
        Plan storage plan = _plans[planId];
        if (plan.merchant != msg.sender) revert UnauthorizedMerchant(planId);
        if (!plan.active) revert PlanNotActive(planId);

        plan.active = false;
        emit PlanDeactivated(planId, msg.sender);
    }

    // ─── Subscriptions ────────────────────────────────────────────────────────

    /// @notice Bind an authorization the caller already created to a plan.
    ///         The caller must be that authorization's payer, and the
    ///         authorization must name the same merchant and token as the plan
    ///         and allow at least one charge of the plan's amount.
    function subscribe(bytes32 planId, bytes32 authorizationId)
        external
        returns (bytes32 subscriptionId)
    {
        Plan storage plan = _plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        IVirioAuthorizationRegistry.Authorization memory auth =
            REGISTRY.getAuthorization(authorizationId);

        if (!auth.active) revert AuthorizationNotUsable(authorizationId);
        if (auth.payer != msg.sender) revert AuthorizationNotUsable(authorizationId);
        if (auth.merchant != plan.merchant) revert AuthorizationMerchantMismatch(authorizationId);
        if (auth.token != plan.token) revert AuthorizationTokenMismatch(authorizationId);
        // Fail at subscribe time rather than leaving a subscription that can
        // never charge: the payer's per-charge limit must cover the plan price.
        if (auth.maxPerCharge < plan.amount) revert AuthorizationLimitTooLow(authorizationId);

        subscriptionId = _subId(planId, msg.sender);
        if (_subscriptions[subscriptionId].active) revert AlreadySubscribed(subscriptionId);

        _subscriptions[subscriptionId] = Subscription({
            authorizationId: authorizationId,
            planId: planId,
            payer: msg.sender,
            amount: plan.amount,
            period: plan.period,
            nextChargeAt: uint64(block.timestamp), // immediately chargeable
            active: true
        });

        emit Subscribed(subscriptionId, planId, authorizationId, msg.sender, plan.amount, plan.period);
    }

    /// @notice Stop a subscription. Callable by the payer or the merchant.
    ///         Leaves the underlying authorization intact — a payer cancelling
    ///         one subscription does not revoke a hybrid plan's metered half.
    function cancel(bytes32 subscriptionId) external {
        Subscription storage sub = _subscriptions[subscriptionId];
        if (!sub.active) revert NotSubscribed(subscriptionId);
        if (msg.sender != sub.payer && msg.sender != _plans[sub.planId].merchant) {
            revert NotSubscribed(subscriptionId);
        }

        sub.active = false;
        emit SubscriptionCancelled(subscriptionId, msg.sender);
    }

    // ─── Charging ─────────────────────────────────────────────────────────────

    /// @notice Charge a due subscription. Permissionless — the caller earns the
    ///         executor fee. Reverts if the payer's limits no longer allow it.
    function charge(bytes32 subscriptionId) external {
        Subscription storage sub = _subscriptions[subscriptionId];

        // ── CHECKS ────────────────────────────────────────────────────────────
        if (!sub.active) revert NotSubscribed(subscriptionId);
        if (block.timestamp < sub.nextChargeAt) {
            revert TooEarlyToCharge(subscriptionId, sub.nextChargeAt);
        }

        // ── EFFECTS ───────────────────────────────────────────────────────────
        // Advancing first is what makes two executors racing the same charge
        // safe: the loser re-reads nextChargeAt in the future and reverts.
        uint64 nextChargeAt = uint64(block.timestamp) + sub.period;
        sub.nextChargeAt = nextChargeAt;

        uint256 amount = sub.amount;
        bytes32 authorizationId = sub.authorizationId;

        // ── INTERACTIONS ──────────────────────────────────────────────────────
        // The registry re-checks every payer limit and moves the money.
        uint256 merchantAmount = REGISTRY.settle(authorizationId, amount, msg.sender);

        emit RecurringChargeExecuted(
            subscriptionId, authorizationId, msg.sender, amount, merchantAmount, nextChargeAt
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getPlan(bytes32 planId) external view returns (Plan memory) {
        return _plans[planId];
    }

    function getSubscription(bytes32 subscriptionId) external view returns (Subscription memory) {
        return _subscriptions[subscriptionId];
    }

    /// @notice Whether a charge would succeed right now, and why not if it would
    ///         not. Lets an executor filter candidates with one eth_call.
    function chargeable(bytes32 subscriptionId) external view returns (bool ok, bytes4 reason) {
        Subscription storage sub = _subscriptions[subscriptionId];
        if (!sub.active) return (false, NotSubscribed.selector);
        if (block.timestamp < sub.nextChargeAt) return (false, TooEarlyToCharge.selector);
        return REGISTRY.canSettle(address(this), sub.authorizationId, sub.amount);
    }

    function computeSubscriptionId(bytes32 planId, address payer) external pure returns (bytes32) {
        return _subId(planId, payer);
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    function _subId(bytes32 planId, address payer) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(planId, payer));
    }
}
