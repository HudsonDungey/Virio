// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// VirioPayrollManager
//
// Automated, bot-executable ERC-20 payroll protocol.
//
// A business owner (employer) creates a Plan, adds Recipients (employees /
// contractors), and pre-approves the contract's token spend. Keeper bots call
// executePayroll() once each pay period and earn executorFeeBps as incentive.
// Funds flow directly from employer → recipient
// with no intermediate custody.
//
// Key design invariants:
//   1.  executePayroll() is permissionless — any address may call it and
//       earns executorFeeBps of the gross amount.
//   2.  CEI ordering: all state mutations before external token calls.
//   3.  nonReentrant guard (uint256 1/2 pattern) for defense-in-depth.
//   4.  recipientId = keccak256(planId ‖ wallet) — deterministic & unique.
//   5.  Plan stores only shared config (token, period). Per-recipient amounts
//       live in the Recipient struct for full modularity.
//   6.  nextPayAt += period (additive, drift-free).
//   7.  planId includes block.chainid to prevent cross-chain replay.
//   8.  Spend cap exceeded → auto-remove (emit RecipientRemoved), NOT revert.
//   9.  removeRecipient() callable by employer only.
//  10.  Direct transferFrom: employer → recipient / executor / feeRecipient
//       (no intermediate custody — employer must approve this contract).
//  11.  Enumerable recipient list per plan for easy off-chain indexing.
// ─────────────────────────────────────────────────────────────────────────────

import {IVirioPayrollManager} from "./interfaces/IVirioPayrollManager.sol";

/// @dev Minimal ERC-20 interface (only what we call).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract VirioPayrollManager is IVirioPayrollManager {
    // ─── Constants / Config ───────────────────────────────────────────────────

    uint16  public executorFeeBps  = 10;   // 0.1 %
    uint16  public protocolFeeBps  = 25;   // 0.25 %
    uint256 public protocolFlatFee = 1e6;  // 1 USDC (6 decimals)

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;

    uint256 private _planNonce;
    uint256 private _reentrancyStatus;

    mapping(bytes32 => Plan)                          public plans;

    /// @dev planId → recipientId → Recipient
    mapping(bytes32 => mapping(bytes32 => Recipient))  public recipients;

    /// @dev planId → ordered list of recipientIds (for enumeration)
    mapping(bytes32 => bytes32[])                       internal _planRecipientIds;

    /// @dev planId → recipientId → index in _planRecipientIds (for O(1) removal)
    mapping(bytes32 => mapping(bytes32 => uint256))     internal _recipientIndex;

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

    modifier onlyEmployer(bytes32 planId) {
        if (plans[planId].employer != msg.sender) revert UnauthorizedEmployer(planId);
        _;
    }

    // ─── View (interface compliance) ──────────────────────────────────────────

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

    // ═════════════════════════════════════════════════════════════════════════
    //  PLAN MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Create a payroll plan. The caller becomes the employer.
    /// @param token   ERC-20 token used to pay recipients (e.g. USDC).
    /// @param period  Seconds between pay cycles (604_800 = 1 week).
    function createPlan(
        address token,
        uint256 period
    ) external returns (bytes32 planId) {
        if (token  == address(0)) revert ZeroAddress();
        if (period == 0)          revert InvalidPeriod();

        planId = keccak256(
            abi.encodePacked(msg.sender, ++_planNonce, block.chainid)
        );

        plans[planId] = Plan({
            employer: msg.sender,
            token:    token,
            period:   period,
            active:   true
        });

        emit PlanCreated(planId, msg.sender, token, period);
    }

    /// @notice Deactivate a plan. Existing recipients remain queryable but
    ///         executePayroll will revert for this plan.
    function deactivatePlan(bytes32 planId) external onlyEmployer(planId) {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        plan.active = false;
        emit PlanDeactivated(planId, msg.sender);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  RECIPIENT MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Add a single recipient to a plan.
    /// @param planId   The plan to add to.
    /// @param wallet   Recipient's wallet address.
    /// @param amount   Gross amount per pay cycle.
    /// @param spendCap Lifetime spend cap (0 = unlimited).
    function addRecipient(
        bytes32 planId,
        address wallet,
        uint256 amount,
        uint256 spendCap
    ) external onlyEmployer(planId) returns (bytes32 recipientId) {
        if (!plans[planId].active) revert PlanNotActive(planId);
        recipientId = _addRecipient(planId, wallet, amount, spendCap);
    }

    /// @notice Remove a recipient. Only employer can call.
    function removeRecipient(
        bytes32 planId,
        bytes32 recipientId
    ) external onlyEmployer(planId) {
        _removeRecipient(planId, recipientId, msg.sender);
    }

    /// @notice Update a recipient's pay amount and/or spend cap.
    ///         Takes effect on the NEXT pay cycle (doesn't reset nextPayAt).
    function updateRecipient(
        bytes32 planId,
        bytes32 recipientId,
        uint256 newAmount,
        uint256 newSpendCap
    ) external onlyEmployer(planId) {
        if (newAmount == 0) revert InvalidAmount();

        Recipient storage r = recipients[planId][recipientId];
        if (!r.active) revert RecipientNotActive(recipientId);

        r.amount   = newAmount;
        r.spendCap = newSpendCap;

        emit RecipientUpdated(planId, recipientId, newAmount, newSpendCap);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PAYROLL EXECUTION  (permissionless — keeper bots earn executor fee)
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Execute payroll for a single recipient.
    function executePayroll(
        bytes32 planId,
        bytes32 recipientId
    ) external nonReentrant {
        _executePayroll(planId, recipientId);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════════════════

    function getPlan(bytes32 planId)
        external view returns (Plan memory)
    {
        return plans[planId];
    }

    function getRecipient(bytes32 planId, bytes32 recipientId)
        external view returns (Recipient memory)
    {
        return recipients[planId][recipientId];
    }

    /// @notice Return all recipient IDs for a plan (for off-chain enumeration).
    function getPlanRecipientIds(bytes32 planId)
        external view returns (bytes32[] memory)
    {
        return _planRecipientIds[planId];
    }

    /// @notice Return the full roster with data (convenience for frontends).
    function getPlanRecipients(bytes32 planId)
        external view returns (Recipient[] memory roster)
    {
        bytes32[] storage ids = _planRecipientIds[planId];
        uint256 len = ids.length;
        roster = new Recipient[](len);
        for (uint256 i; i < len; ) {
            roster[i] = recipients[planId][ids[i]];
            unchecked { ++i; }
        }
    }

    /// @notice Check which recipients are currently due for payment.
    function getDueRecipients(bytes32 planId)
        external view returns (bytes32[] memory dueIds)
    {
        bytes32[] storage ids = _planRecipientIds[planId];
        uint256 len  = ids.length;

        // First pass: count due
        uint256 count = 0;
        for (uint256 i; i < len; ) {
            Recipient storage r = recipients[planId][ids[i]];
            if (r.active && block.timestamp >= r.nextPayAt) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }

        // Second pass: fill array
        dueIds = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i; i < len; ) {
            Recipient storage r = recipients[planId][ids[i]];
            if (r.active && block.timestamp >= r.nextPayAt) {
                dueIds[idx] = ids[i];
                unchecked { ++idx; }
            }
            unchecked { ++i; }
        }
    }

    function computeRecipientId(bytes32 planId, address wallet)
        external pure returns (bytes32)
    {
        return _recipientId(planId, wallet);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  OWNER ADMIN
    // ═════════════════════════════════════════════════════════════════════════

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

    // ═════════════════════════════════════════════════════════════════════════
    //  INTERNALS
    // ═════════════════════════════════════════════════════════════════════════

    function _recipientId(bytes32 planId, address wallet)
        internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(planId, wallet));
    }

    function _addRecipient(
        bytes32 planId,
        address wallet,
        uint256 amount,
        uint256 spendCap
    ) internal returns (bytes32 recipientId) {
        if (wallet == address(0)) revert ZeroAddress();
        if (amount == 0)          revert InvalidAmount();

        recipientId = _recipientId(planId, wallet);
        if (recipients[planId][recipientId].active)
            revert RecipientAlreadyExists(recipientId);

        recipients[planId][recipientId] = Recipient({
            wallet:    wallet,
            amount:    amount,
            nextPayAt: block.timestamp,   // immediately payable
            totalPaid: 0,
            spendCap:  spendCap,
            active:    true
        });

        // Track in enumerable list
        _recipientIndex[planId][recipientId] = _planRecipientIds[planId].length;
        _planRecipientIds[planId].push(recipientId);

        emit RecipientAdded(planId, recipientId, wallet, amount, spendCap);
    }

    function _removeRecipient(
        bytes32 planId,
        bytes32 recipientId,
        address removedBy
    ) internal {
        Recipient storage r = recipients[planId][recipientId];
        if (!r.active) revert RecipientNotActive(recipientId);

        r.active = false;

        // Swap-and-pop from the enumerable list (O(1) removal)
        uint256 idx  = _recipientIndex[planId][recipientId];
        uint256 last = _planRecipientIds[planId].length - 1;

        if (idx != last) {
            bytes32 lastId = _planRecipientIds[planId][last];
            _planRecipientIds[planId][idx] = lastId;
            _recipientIndex[planId][lastId] = idx;
        }
        _planRecipientIds[planId].pop();
        delete _recipientIndex[planId][recipientId];

        emit RecipientRemoved(planId, recipientId, removedBy);
    }

    /// @dev Core payroll execution. Reverts on failure.
    function _executePayroll(bytes32 planId, bytes32 recipientId) internal {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        Recipient storage r = recipients[planId][recipientId];

        // ── CHECKS ──────────────────────────────────────────────────────────
        if (!r.active) revert RecipientNotActive(recipientId);
        if (block.timestamp < r.nextPayAt)
            revert TooEarlyToPay(recipientId, r.nextPayAt);

        uint256 amount = r.amount;

        // ── EFFECTS (all state before external calls) ───────────────────────
        uint256 nextPayAt = r.nextPayAt + plan.period;
        r.nextPayAt   = nextPayAt;
        r.totalPaid  += amount;

        // Spend cap: auto-remove instead of revert so the bot's tx succeeds
        if (r.spendCap != 0 && r.totalPaid > r.spendCap) {
            _removeRecipient(planId, recipientId, address(this));
            return;
        }

        // Fee math
        address employer = plan.employer;
        address token    = plan.token;
        address executor = msg.sender;

        uint256 execFee     = (amount * executorFeeBps)  / 10_000;
        uint256 protocolFee = (amount * protocolFeeBps)  / 10_000 + protocolFlatFee;

        if (amount < execFee + protocolFee) revert InvalidAmount();
        uint256 recipientAmt = amount - execFee - protocolFee;

        // ── INTERACTIONS ────────────────────────────────────────────────────
        _safeTransferFrom(token, employer, r.wallet,      recipientAmt);
        if (execFee     > 0) _safeTransferFrom(token, employer, executor,     execFee);
        if (protocolFee > 0) _safeTransferFrom(token, employer, feeRecipient, protocolFee);

        emit PayrollExecuted(
            planId,
            recipientId,
            executor,
            r.wallet,
            amount,
            recipientAmt,
            execFee,
            protocolFee,
            nextPayAt
        );
    }

    // ─── Safe Transfer Helpers ────────────────────────────────────────────────

    /// @dev Reverts on failure (used in single executePayroll).
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        require(
            ok && (data.length == 0 || abi.decode(data, (bool))),
            "Virio: transferFrom failed"
        );
    }

}
