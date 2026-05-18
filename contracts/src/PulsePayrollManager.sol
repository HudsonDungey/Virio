// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// PulsePayrollManager
//
// Automated, executor-routed ERC-20 payroll protocol.
//
// A business owner (employer) creates a Plan, adds Recipients (employees /
// contractors), and pre-approves the contract's token spend. The PulseExecutor
// router is the sole caller of executePayrollFor() — every payment is scored,
// recorded, and routed through the same dynamic-fee + penalty logic.
//
// Key design invariants:
//   1.  executePayrollFor / executePayrollBatchFor are callable ONLY by the
//       trusted executor router.
//   2.  CEI ordering: all state mutations before external token calls.
//   3.  nonReentrant guard (uint256 1/2 pattern) on every external mutator.
//   4.  recipientId = keccak256(planId ‖ wallet) — deterministic & unique.
//   5.  Plan stores only shared config (token, period). Per-recipient amounts
//       live in the Recipient struct.
//   6.  nextPayAt += period (additive, drift-free).
//   7.  planId includes block.chainid to prevent cross-chain replay.
//   8.  Spend cap exceeded → auto-remove (emit RecipientRemoved), NOT revert.
//   9.  removeRecipient() callable by employer only.
//  10.  Direct transferFrom: employer → recipient / executorPayee / feeRecipient
//       (no intermediate custody).
//  11.  addRecipient / removeRecipient best-effort callback into the executor
//       router via try/catch; a reverting executor never blocks onboarding.
// ─────────────────────────────────────────────────────────────────────────────

import {IPulsePayrollManager} from "./interfaces/IPulsePayrollManager.sol";
import {IPulseExecutor}       from "./interfaces/IPulseExecutor.sol";

/// @dev Minimal ERC-20 interface (only what we call).
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract PulsePayrollManager is IPulsePayrollManager {
    // ─── Constants / Config ───────────────────────────────────────────────────

    uint16 public constant MAX_EXECUTOR_FEE_BPS = 30;

    uint16  public executorFeeBps  = 10;   // 0.1 % (legacy; view-only)
    uint16  public protocolFeeBps  = 25;   // 0.25 %
    uint256 public protocolFlatFee = 1e6;  // 1 USDC (6 decimals)

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;
    address public trustedExecutor;

    uint256 private _planNonce;
    uint256 private _reentrancyStatus;

    mapping(bytes32 => Plan)                          public plans;

    /// @dev planId → recipientId → Recipient
    mapping(bytes32 => mapping(bytes32 => Recipient))  public recipients;

    /// @dev planId → ordered list of recipientIds (for enumeration / batch ops)
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
        require(msg.sender == owner, "Pulse: not owner");
        _;
    }

    modifier onlyEmployer(bytes32 planId) {
        if (plans[planId].employer != msg.sender) revert UnauthorizedEmployer(planId);
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != trustedExecutor) revert NotTrustedExecutor(msg.sender);
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

    function deactivatePlan(bytes32 planId) external onlyEmployer(planId) {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        plan.active = false;
        emit PlanDeactivated(planId, msg.sender);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  RECIPIENT MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    function addRecipient(
        bytes32 planId,
        address wallet,
        uint256 amount,
        uint256 spendCap
    ) external nonReentrant onlyEmployer(planId) returns (bytes32 recipientId) {
        if (!plans[planId].active) revert PlanNotActive(planId);
        recipientId = _addRecipient(planId, wallet, amount, spendCap);
    }

    function addRecipientsBatch(
        bytes32   planId,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256[] calldata spendCaps
    ) external nonReentrant onlyEmployer(planId) returns (bytes32[] memory recipientIds) {
        if (!plans[planId].active) revert PlanNotActive(planId);

        uint256 len = wallets.length;
        if (len != amounts.length || len != spendCaps.length)
            revert ArrayLengthMismatch();

        recipientIds = new bytes32[](len);
        for (uint256 i; i < len; ) {
            recipientIds[i] = _addRecipient(
                planId, wallets[i], amounts[i], spendCaps[i]
            );
            unchecked { ++i; }
        }
    }

    function removeRecipient(
        bytes32 planId,
        bytes32 recipientId
    ) external nonReentrant onlyEmployer(planId) {
        _removeRecipient(planId, recipientId, msg.sender);
    }

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
    //  PAYROLL EXECUTION  (executor-only)
    // ═════════════════════════════════════════════════════════════════════════

    /// @notice Execute payroll for a single recipient. Only callable by the
    ///         trusted PulseExecutor router.
    function executePayrollFor(
        bytes32 planId,
        bytes32 recipientId,
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

        return _executePayroll(planId, recipientId, executorFeeBpsOverride, executorPayee);
    }

    /// @notice Batch variant. Individual failures are absorbed (counted in the
    ///         BatchPayrollExecuted event) so a bad recipient cannot revert the
    ///         entire roster's payment.
    function executePayrollBatchFor(
        bytes32   planId,
        bytes32[] calldata recipientIds,
        uint16    executorFeeBpsOverride,
        address   executorPayee
    )
        external
        onlyExecutor
        nonReentrant
        returns (
            uint256 totalExecutorFee,
            uint256 totalProtocolFee,
            uint256 successCount,
            uint256 failCount
        )
    {
        if (executorFeeBpsOverride > MAX_EXECUTOR_FEE_BPS) {
            revert FeeBpsExceedsMax(executorFeeBpsOverride, MAX_EXECUTOR_FEE_BPS);
        }
        if (executorPayee == address(0)) revert ZeroAddress();
        if (!plans[planId].active)       revert PlanNotActive(planId);

        uint256 len = recipientIds.length;
        for (uint256 i; i < len; ) {
            (bool ok, uint256 exec, uint256 proto) = _tryExecutePayroll(
                planId, recipientIds[i], executorFeeBpsOverride, executorPayee
            );
            if (ok) {
                unchecked { ++successCount; }
                totalExecutorFee += exec;
                totalProtocolFee += proto;
            } else {
                unchecked { ++failCount; }
            }
            unchecked { ++i; }
        }

        emit BatchPayrollExecuted(planId, executorPayee, successCount, failCount);
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

    function getPlanRecipientIds(bytes32 planId)
        external view returns (bytes32[] memory)
    {
        return _planRecipientIds[planId];
    }

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

    function getDueRecipients(bytes32 planId)
        external view returns (bytes32[] memory dueIds)
    {
        bytes32[] storage ids = _planRecipientIds[planId];
        uint256 len  = ids.length;

        uint256 count = 0;
        for (uint256 i; i < len; ) {
            Recipient storage r = recipients[planId][ids[i]];
            if (r.active && block.timestamp >= r.nextPayAt) {
                unchecked { ++count; }
            }
            unchecked { ++i; }
        }

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

    function setTrustedExecutor(address newExecutor) external onlyOwner {
        trustedExecutor = newExecutor;
    }

    function setExecutorFeeBps(uint16 _bps) external onlyOwner {
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

        uint256 nextAt = block.timestamp;
        uint256 period = plans[planId].period;

        recipients[planId][recipientId] = Recipient({
            wallet:    wallet,
            amount:    amount,
            nextPayAt: nextAt,
            totalPaid: 0,
            spendCap:  spendCap,
            active:    true
        });

        _recipientIndex[planId][recipientId] = _planRecipientIds[planId].length;
        _planRecipientIds[planId].push(recipientId);

        emit RecipientAdded(planId, recipientId, wallet, amount, spendCap);

        // Best-effort callback into the executor router.
        if (trustedExecutor != address(0)) {
            try IPulseExecutor(trustedExecutor).registerPayment(
                IPulseExecutor.ManagerKind.Payroll,
                planId,
                recipientId,
                uint64(nextAt),
                uint64(period)
            ) {
                // ok
            } catch (bytes memory reason) {
                emit RegistrationFailed(recipientId, _hashReason(reason));
            }
        }
    }

    function _removeRecipient(
        bytes32 planId,
        bytes32 recipientId,
        address removedBy
    ) internal {
        Recipient storage r = recipients[planId][recipientId];
        if (!r.active) revert RecipientNotActive(recipientId);

        r.active = false;

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

        if (trustedExecutor != address(0)) {
            try IPulseExecutor(trustedExecutor).deregisterPayment(recipientId) {
                // ok
            } catch (bytes memory reason) {
                emit RegistrationFailed(recipientId, _hashReason(reason));
            }
        }
    }

    /// @dev Core payroll execution. Reverts on failure (used by single exec path).
    function _executePayroll(
        bytes32 planId,
        bytes32 recipientId,
        uint16  bpsOverride,
        address executorPayee
    ) internal returns (uint256 grossAmount, uint256 executorFeePaid, uint256 protocolFeePaid) {
        Plan storage plan = plans[planId];
        if (!plan.active) revert PlanNotActive(planId);

        Recipient storage r = recipients[planId][recipientId];

        if (!r.active) revert RecipientNotActive(recipientId);
        if (block.timestamp < r.nextPayAt)
            revert TooEarlyToPay(recipientId, r.nextPayAt);

        uint256 amount = r.amount;

        uint256 nextPayAt = r.nextPayAt + plan.period;
        r.nextPayAt   = nextPayAt;
        r.totalPaid  += amount;

        // Spend cap: auto-remove instead of revert.
        if (r.spendCap != 0 && r.totalPaid > r.spendCap) {
            _removeRecipient(planId, recipientId, address(this));
            return (0, 0, 0);
        }

        address employer = plan.employer;
        address token    = plan.token;

        uint256 execFee     = (amount * bpsOverride)    / 10_000;
        uint256 protocolFee = (amount * protocolFeeBps) / 10_000 + protocolFlatFee;

        if (amount < execFee + protocolFee) revert InvalidAmount();
        uint256 recipientAmt = amount - execFee - protocolFee;

        _safeTransferFrom(token, employer, r.wallet,      recipientAmt);
        if (execFee     > 0) _safeTransferFrom(token, employer, executorPayee, execFee);
        if (protocolFee > 0) _safeTransferFrom(token, employer, feeRecipient,  protocolFee);

        emit PayrollExecuted(
            planId,
            recipientId,
            executorPayee,
            r.wallet,
            amount,
            recipientAmt,
            execFee,
            protocolFee,
            nextPayAt
        );

        return (amount, execFee, protocolFee);
    }

    /// @dev Try-style wrapper for batch execution. Returns false on failure
    ///      instead of reverting, so one bad recipient doesn't block the rest.
    function _tryExecutePayroll(
        bytes32 planId,
        bytes32 recipientId,
        uint16  bpsOverride,
        address executorPayee
    ) internal returns (bool ok, uint256 execFee, uint256 protocolFee) {
        Plan storage plan   = plans[planId];
        Recipient storage r = recipients[planId][recipientId];

        if (!r.active)                     return (false, 0, 0);
        if (block.timestamp < r.nextPayAt) return (false, 0, 0);

        uint256 amount = r.amount;
        uint256 period = plan.period;

        uint256 nextPayAt = r.nextPayAt + period;
        r.nextPayAt   = nextPayAt;
        r.totalPaid  += amount;

        if (r.spendCap != 0 && r.totalPaid > r.spendCap) {
            _removeRecipient(planId, recipientId, address(this));
            return (true, 0, 0);
        }

        address employer = plan.employer;
        address token    = plan.token;

        execFee     = (amount * bpsOverride)    / 10_000;
        protocolFee = (amount * protocolFeeBps) / 10_000 + protocolFlatFee;

        if (amount < execFee + protocolFee) return (false, 0, 0);
        uint256 recipientAmt = amount - execFee - protocolFee;

        bool ok1 = _tryTransferFrom(token, employer, r.wallet, recipientAmt);
        if (!ok1) {
            // Rollback effects — recipient transfer failed.
            r.nextPayAt  = nextPayAt - period;
            r.totalPaid -= amount;
            return (false, 0, 0);
        }

        if (execFee     > 0) _tryTransferFrom(token, employer, executorPayee, execFee);
        if (protocolFee > 0) _tryTransferFrom(token, employer, feeRecipient,  protocolFee);

        emit PayrollExecuted(
            planId,
            recipientId,
            executorPayee,
            r.wallet,
            amount,
            recipientAmt,
            execFee,
            protocolFee,
            nextPayAt
        );

        return (true, execFee, protocolFee);
    }

    // ─── Safe Transfer Helpers ────────────────────────────────────────────────

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
            "Pulse: transferFrom failed"
        );
    }

    function _tryTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0x23b872dd, from, to, amount)
        );
        return ok && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _hashReason(bytes memory reason) internal pure returns (bytes32) {
        if (reason.length == 0) return bytes32(0);
        uint256 n = reason.length > 32 ? 32 : reason.length;
        bytes memory trimmed = new bytes(n);
        for (uint256 i; i < n; ) {
            trimmed[i] = reason[i];
            unchecked { ++i; }
        }
        return keccak256(trimmed);
    }
}
