// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// VirioSubscriptionManager
//
// Pull-based ERC-20 subscription protocol.
//
// Key design invariants:
//   1. charge() is permissionless — any address may call it and earns
//      executorFeeBps as an incentive to run a keeper bot.
//   2. Checks-Effects-Interactions (CEI) ordering in charge():
//      every state mutation happens before any external token call.
//   3. nonReentrant guard (uint256 1/2 pattern) for defense-in-depth.
//   4. subscriptionId = keccak256(planId ‖ customer) — deterministic.
//   5. Subscriptions are denormalized at subscribe() time: merchant, token,
//      amount, period, feeBps are copied from the plan so the subscription
//      remains valid even if the plan is later modified.
//   6. nextChargeAt += period (additive, no timestamp drift).
//   7. planId includes block.chainid to prevent cross-chain replay.
//   8. Spend cap exceeded → auto-cancel (emit Cancelled), NOT revert.
//   9. cancel() callable by customer OR merchant.
//  10. Direct transferFrom: customer → merchant / executor / feeRecipient
//      (no intermediate custody).
// ─────────────────────────────────────────────────────────────────────────────

import {IVirioSubscriptionManager} from "./interfaces/IVirioSubscriptionManager.sol";

/// @dev Minimal ERC-20 interface (only what we call).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract VirioSubscriptionManager is IVirioSubscriptionManager {
    // ─── Constants ────────────────────────────────────────────────────────────

    uint16  public executorFeeBps  = 10;  // 0.1%
    uint16  public protocolFeeBps  = 25;  // 0.25%
    uint256 public protocolFlatFee = 1e6; // 1 USDC (6 decimals)

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;

    /// @dev Monotonic nonce used to make planIds unique per merchant + chain.
    uint256 private _planNonce;

    /// @dev Re-entrancy lock: 1 = not entered, 2 = entered.
    uint256 private _reentrancyStatus;

    mapping(bytes32 => Plan)         public plans;
    mapping(bytes32 => Subscription) public subscriptions;

    /// @dev Per-merchant aggregate counters. Updated synchronously alongside
    /// the per-plan / per-subscription state so the dashboard can read all
    /// overview numbers in a single eth_call instead of scanning events.
    mapping(address => MerchantStats) private _merchantStats;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Virio: not owner");
        _;
    }

    // ─── EXECUTOR_FEE_BPS view (matches interface, returns same value) ────────

    function EXECUTOR_FEE_BPS() external view returns (uint16) {
        return executorFeeBps;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        owner             = msg.sender;
        feeRecipient      = _feeRecipient;
        _reentrancyStatus = 1;
    }

    // ─── Plan management ─────────────────────────────────────────────────────

    /// @notice Merchant creates a subscription plan.
    /// @param token   ERC-20 token customers will pay in.
    /// @param amount  Gross amount (fee-inclusive) per charge.
    /// @param period  Minimum seconds between consecutive charges.
    function createPlan(
        address token,
        uint256 amount,
        uint256 period
    ) external returns (bytes32 planId) {
        if (token  == address(0)) revert ZeroAddress();
        if (amount == 0)          revert InvalidAmount();
        if (period == 0)          revert InvalidPeriod();

        // planId includes chainid so the same merchant nonce produces different
        // ids across chains, preventing cross-chain subscription replays.
        planId = keccak256(abi.encodePacked(msg.sender, ++_planNonce, block.chainid));

        plans[planId] = Plan({
            merchant: msg.sender,
            token:    token,
            amount:   amount,
            period:   period,
            active:   true
        });

        _merchantStats[msg.sender].activePlans += 1;

        emit PlanCreated(planId, msg.sender, token, amount, period);
    }

    /// @notice Merchant deactivates a plan.  Existing subscriptions are
    ///         unaffected (they hold their own denormalized copy of the params)
    ///         but callers may inspect the plan's active flag before charging.
    function deactivatePlan(bytes32 planId) external {
        Plan storage plan = plans[planId];
        if (plan.merchant != msg.sender) revert UnauthorizedMerchant(planId);
        if (!plan.active)                revert PlanNotActive(planId);

        plan.active = false;
        _merchantStats[msg.sender].activePlans -= 1;
        emit PlanDeactivated(planId, msg.sender);
    }

    // ─── Subscription lifecycle ───────────────────────────────────────────────

    /// @notice Customer subscribes to a plan.
    function subscribe(
        bytes32 planId,
        uint256 totalSpendCap
    ) external returns (bytes32 subscriptionId) {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        subscriptionId = _subId(planId, msg.sender);
        if (subscriptions[subscriptionId].active) revert AlreadySubscribed(subscriptionId);

        subscriptions[subscriptionId] = Subscription({
            customer:      msg.sender,
            merchant:      plan.merchant,
            token:         plan.token,
            amount:        plan.amount,
            period:        plan.period,
            nextChargeAt:  block.timestamp, // immediately chargeable
            totalSpendCap: totalSpendCap,
            totalSpent:    0,
            active:        true
        });

        _merchantStats[plan.merchant].activeSubs += 1;

        emit Subscribed(subscriptionId, planId, msg.sender, totalSpendCap);
    }

    /// @notice Cancel a subscription.  Callable by the customer OR merchant.
    function cancel(bytes32 subscriptionId) external {
        Subscription storage sub = subscriptions[subscriptionId];
        if (!sub.active) revert NotSubscribed(subscriptionId);
        if (msg.sender != sub.customer && msg.sender != sub.merchant)
            revert NotSubscribed(subscriptionId);

        sub.active = false;
        _merchantStats[sub.merchant].activeSubs -= 1;
        emit Cancelled(subscriptionId, msg.sender);
    }

    // ─── Charging ────────────────────────────────────────────────────────────

    /// @notice Charge a due subscription.  Permissionless — any address may
    ///         call and earns executorFeeBps of the gross amount.
    function charge(bytes32 subscriptionId) external nonReentrant {
        Subscription storage sub = subscriptions[subscriptionId];

        // ── CHECKS ────────────────────────────────────────────────────────────
        if (!sub.active) revert NotSubscribed(subscriptionId);

        if (block.timestamp < sub.nextChargeAt)
            revert TooEarlyToCharge(subscriptionId, sub.nextChargeAt);

        uint256 amount = sub.amount;

        // ── EFFECTS (all state mutations before any external call) ────────────

        uint256 nextChargeAt = sub.nextChargeAt + sub.period;
        sub.nextChargeAt  = nextChargeAt;
        sub.totalSpent   += amount;

        // Spend cap: auto-cancel instead of revert so the executor's tx
        // succeeds and the subscription is cleaned up gracefully.
        if (sub.totalSpendCap != 0 && sub.totalSpent > sub.totalSpendCap) {
            sub.active = false;
            _merchantStats[sub.merchant].activeSubs -= 1;
            emit Cancelled(subscriptionId, address(this));
            return;
        }

        address customer  = sub.customer;
        address merchant  = sub.merchant;
        address token     = sub.token;
        address executor  = msg.sender;

        uint256 execFee     = (amount * executorFeeBps) / 10_000;
        uint256 protocolFee = (amount * protocolFeeBps) / 10_000 + protocolFlatFee;

        if (amount < execFee + protocolFee) revert InvalidAmount();
        uint256 merchantAmt = amount - execFee - protocolFee;

        MerchantStats storage stats = _merchantStats[merchant];
        stats.totalEarned   += merchantAmt;
        stats.totalFeesPaid += execFee + protocolFee;
        stats.totalCharges  += 1;

        _safeTransferFrom(token, customer, merchant, merchantAmt);
        if (execFee     > 0) _safeTransferFrom(token, customer, executor,     execFee);
        if (protocolFee > 0) _safeTransferFrom(token, customer, feeRecipient, protocolFee);

        emit ChargeExecuted(
            subscriptionId,
            executor,
            customer,
            amount,
            merchantAmt,
            execFee,
            protocolFee,
            nextChargeAt
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getPlan(bytes32 planId) external view returns (Plan memory) {
        return plans[planId];
    }

    function getSubscription(bytes32 subscriptionId)
        external view returns (Subscription memory)
    {
        return subscriptions[subscriptionId];
    }

    function getMerchantStats(address merchant)
        external view returns (MerchantStats memory)
    {
        return _merchantStats[merchant];
    }

    /// @notice Compute the deterministic subscription id for a (plan, customer) pair.
    function computeSubId(bytes32 planId, address customer)
        external pure returns (bytes32)
    {
        return _subId(planId, customer);
    }

    // ─── Owner ────────────────────────────────────────────────────────────────

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function setExecutorFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 10_000, "Virio: bps > 10000");
        executorFeeBps = _bps;
    }

    function setProtocolFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 10_000, "Virio: bps > 10000");
        protocolFeeBps = _bps;
    }

    function setProtocolFlatFee(uint256 _fee) external onlyOwner {
        protocolFlatFee = _fee;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _subId(bytes32 planId, address customer) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(planId, customer));
    }

    /// @dev Calls transferFrom and reverts if it returns false or reverts.
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "Virio: transferFrom failed");
    }
}
