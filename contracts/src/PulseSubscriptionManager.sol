// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// PulseSubscriptionManager
//
// Pull-based ERC-20 subscription protocol.
//
// Key design invariants:
//   1. chargeFor() is callable ONLY by the trustedExecutor router contract —
//      this guarantees every charge is scored, recorded, and routed through
//      the same dynamic-fee + penalty logic.
//   2. Checks-Effects-Interactions (CEI) ordering in chargeFor():
//      every state mutation happens before any external token call.
//   3. nonReentrant guard (uint256 1/2 pattern) on every external mutator.
//   4. subscriptionId = keccak256(planId ‖ customer) — deterministic.
//   5. Subscriptions are denormalized at subscribe() time: merchant, token,
//      amount, period are copied from the plan so the subscription remains
//      valid even if the plan is later modified.
//   6. nextChargeAt += period (additive, no timestamp drift).
//   7. planId includes block.chainid to prevent cross-chain replay.
//   8. Spend cap exceeded → auto-cancel (emit Cancelled), NOT revert.
//   9. cancel() callable by customer OR merchant.
//  10. Direct transferFrom: customer → merchant / executorPayee / feeRecipient
//      (no intermediate custody).
//  11. subscribe() and cancel() best-effort callback into the executor router;
//      a reverting callback emits RegistrationFailed and does NOT block the
//      user-facing operation.
// ─────────────────────────────────────────────────────────────────────────────

import {IPulseSubscriptionManager} from "./interfaces/IPulseSubscriptionManager.sol";
import {IPulseExecutor}           from "./interfaces/IPulseExecutor.sol";

/// @dev Minimal ERC-20 interface (only what we call).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract PulseSubscriptionManager is IPulseSubscriptionManager {
    // ─── Constants / Config ───────────────────────────────────────────────────

    /// Hard ceiling on the executor fee bps the router may request — must match
    /// IPulseExecutor.MAX_FEE_BPS. 30 = 0.30%.
    uint16 public constant MAX_EXECUTOR_FEE_BPS = 30;

    /// Legacy storage field — kept for ABI back-compat, no longer used in
    /// chargeFor (the override fully replaces it). Deprecated.
    uint16  public executorFeeBps  = 10;  // 0.1% — historical default
    uint16  public protocolFeeBps  = 25;  // 0.25%
    uint256 public protocolFlatFee = 1e6; // 1 USDC (6 decimals)

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;
    address public trustedExecutor;

    /// @dev Monotonic nonce used to make planIds unique per merchant + chain.
    uint256 private _planNonce;

    /// @dev Re-entrancy lock: 1 = not entered, 2 = entered.
    uint256 private _reentrancyStatus;

    mapping(bytes32 => Plan)         public plans;
    mapping(bytes32 => Subscription) public subscriptions;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Pulse: not owner");
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != trustedExecutor) revert NotTrustedExecutor(msg.sender);
        _;
    }

    // ─── EXECUTOR_FEE_BPS view (interface compliance) ────────────────────────

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
    function createPlan(
        address token,
        uint256 amount,
        uint256 period
    ) external returns (bytes32 planId) {
        if (token  == address(0)) revert ZeroAddress();
        if (amount == 0)          revert InvalidAmount();
        if (period == 0)          revert InvalidPeriod();

        planId = keccak256(abi.encodePacked(msg.sender, ++_planNonce, block.chainid));

        plans[planId] = Plan({
            merchant: msg.sender,
            token:    token,
            amount:   amount,
            period:   period,
            active:   true
        });

        emit PlanCreated(planId, msg.sender, token, amount, period);
    }

    function deactivatePlan(bytes32 planId) external {
        Plan storage plan = plans[planId];
        if (plan.merchant != msg.sender) revert UnauthorizedMerchant(planId);
        if (!plan.active)                revert PlanNotActive(planId);

        plan.active = false;
        emit PlanDeactivated(planId, msg.sender);
    }

    // ─── Subscription lifecycle ───────────────────────────────────────────────

    /// @notice Customer subscribes to a plan. If a trustedExecutor is wired,
    ///         the subscription is registered with it via a try/catch so a
    ///         reverting executor never blocks onboarding.
    function subscribe(
        bytes32 planId,
        uint256 totalSpendCap
    ) external nonReentrant returns (bytes32 subscriptionId) {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        subscriptionId = _subId(planId, msg.sender);
        if (subscriptions[subscriptionId].active) revert AlreadySubscribed(subscriptionId);

        uint256 nextAt = block.timestamp; // immediately chargeable
        uint256 period = plan.period;

        subscriptions[subscriptionId] = Subscription({
            customer:      msg.sender,
            merchant:      plan.merchant,
            token:         plan.token,
            amount:        plan.amount,
            period:        period,
            nextChargeAt:  nextAt,
            totalSpendCap: totalSpendCap,
            totalSpent:    0,
            active:        true
        });

        emit Subscribed(subscriptionId, planId, msg.sender, totalSpendCap);

        // Best-effort callback into the executor router.
        if (trustedExecutor != address(0)) {
            try IPulseExecutor(trustedExecutor).registerPayment(
                IPulseExecutor.ManagerKind.Subscription,
                planId,
                subscriptionId,
                uint64(nextAt),
                uint64(period)
            ) {
                // ok
            } catch (bytes memory reason) {
                emit RegistrationFailed(subscriptionId, _hashReason(reason));
            }
        }
    }

    /// @notice Cancel a subscription. Callable by the customer OR merchant.
    function cancel(bytes32 subscriptionId) external nonReentrant {
        Subscription storage sub = subscriptions[subscriptionId];
        if (!sub.active) revert NotSubscribed(subscriptionId);
        if (msg.sender != sub.customer && msg.sender != sub.merchant)
            revert NotSubscribed(subscriptionId);

        sub.active = false;
        emit Cancelled(subscriptionId, msg.sender);

        if (trustedExecutor != address(0)) {
            try IPulseExecutor(trustedExecutor).deregisterPayment(subscriptionId) {
                // ok
            } catch (bytes memory reason) {
                emit RegistrationFailed(subscriptionId, _hashReason(reason));
            }
        }
    }

    // ─── Charging (executor-only) ────────────────────────────────────────────

    /// @notice Charge a due subscription. Only the PulseExecutor router may
    ///         call. The router supplies a dynamic executor fee bps (capped at
    ///         30 = 0.30%) and a payee address (itself) which then splits the
    ///         fee between the executor and the protocol per its penalty rules.
    function chargeFor(
        bytes32 subscriptionId,
        uint16  executorFeeBpsOverride,
        address executorPayee
    )
        external
        onlyExecutor
        nonReentrant
        returns (uint256 grossAmount, uint256 executorFeePaid, uint256 protocolFeePaid)
    {
        if (executorFeeBpsOverride > MAX_EXECUTOR_FEE_BPS) {
            revert FeeBpsExceedsMax(executorFeeBpsOverride, MAX_EXECUTOR_FEE_BPS);
        }
        if (executorPayee == address(0)) revert ZeroAddress();

        Subscription storage sub = subscriptions[subscriptionId];

        // ── CHECKS ────────────────────────────────────────────────────────────
        if (!sub.active) revert NotSubscribed(subscriptionId);
        if (block.timestamp < sub.nextChargeAt)
            revert TooEarlyToCharge(subscriptionId, sub.nextChargeAt);

        uint256 amount = sub.amount;

        // ── EFFECTS ───────────────────────────────────────────────────────────
        uint256 nextChargeAt = sub.nextChargeAt + sub.period;
        sub.nextChargeAt  = nextChargeAt;
        sub.totalSpent   += amount;

        // Spend cap: auto-cancel instead of revert so the executor's tx
        // succeeds and the subscription is cleaned up gracefully.
        if (sub.totalSpendCap != 0 && sub.totalSpent > sub.totalSpendCap) {
            sub.active = false;
            emit Cancelled(subscriptionId, address(this));
            return (0, 0, 0);
        }

        address customer = sub.customer;
        address merchant = sub.merchant;
        address token    = sub.token;

        uint256 execFee     = (amount * executorFeeBpsOverride) / 10_000;
        uint256 protocolFee = (amount * protocolFeeBps)          / 10_000 + protocolFlatFee;

        if (amount < execFee + protocolFee) revert InvalidAmount();
        uint256 merchantAmt = amount - execFee - protocolFee;

        // ── INTERACTIONS ──────────────────────────────────────────────────────
        _safeTransferFrom(token, customer, merchant, merchantAmt);
        if (execFee     > 0) _safeTransferFrom(token, customer, executorPayee, execFee);
        if (protocolFee > 0) _safeTransferFrom(token, customer, feeRecipient,  protocolFee);

        emit ChargeExecuted(
            subscriptionId,
            executorPayee,
            customer,
            amount,
            merchantAmt,
            execFee,
            protocolFee,
            nextChargeAt
        );

        return (amount, execFee, protocolFee);
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

    function setTrustedExecutor(address newExecutor) external onlyOwner {
        // address(0) is allowed: disables the executor callback path.
        trustedExecutor = newExecutor;
    }

    function setExecutorFeeBps(uint16 _bps) external onlyOwner {
        // Retained for back-compat; only affects the EXECUTOR_FEE_BPS view.
        // chargeFor uses the override from the router, capped at MAX_EXECUTOR_FEE_BPS.
        require(_bps <= 10_000, "Pulse: bps > 10000");
        executorFeeBps = _bps;
    }

    function setProtocolFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 10_000, "Pulse: bps > 10000");
        protocolFeeBps = _bps;
    }

    function setProtocolFlatFee(uint256 _fee) external onlyOwner {
        protocolFlatFee = _fee;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _subId(bytes32 planId, address customer) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(planId, customer));
    }

    function _hashReason(bytes memory reason) internal pure returns (bytes32) {
        // Hash up to the first 32 bytes — revert data is unbounded so we cap.
        if (reason.length == 0) return bytes32(0);
        uint256 n = reason.length > 32 ? 32 : reason.length;
        bytes memory trimmed = new bytes(n);
        for (uint256 i; i < n; ) {
            trimmed[i] = reason[i];
            unchecked { ++i; }
        }
        return keccak256(trimmed);
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
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "Pulse: transferFrom failed");
    }
}
