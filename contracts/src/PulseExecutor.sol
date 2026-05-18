// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// PulseExecutor
//
// Executor router for the Pulse protocol. Sole caller of chargeFor() on
// PulseSubscriptionManager and executePayrollFor() on PulsePayrollManager.
//
// Responsibilities:
//   - Map executors by address and record per-execution stats (totalExecutions,
//     successful/failed, volume, fees, EMA delay, lastTimestamp).
//   - Dispatch by paymentId (one ID per subscription / payroll recipient).
//   - Pay a time-decayed reward: linear ramp from MIN_FEE_BPS (10 = 0.10%) to
//     MAX_FEE_BPS (30 = 0.30%) over RAMP_DURATION (2 days) of overdue delay.
//   - Apply a failure-rate penalty over the rolling last 50 executions:
//       <5% → keep 100%
//       5–<15% → keep 80%
//       15–<30% → keep 50%
//       ≥30% → revert ExecutorRestricted (auto-heals after HEAL_COOLDOWN idle)
//   - Withheld reward routes to feeRecipient.
//   - Batch execution with partial-failure tolerance.
//
// Design notes:
//   - The 50-entry ring buffer is packed into a single uint256 storage slot
//     (one bit per outcome; 1 = failure). Popcount uses SWAR. Single SSTORE
//     per execution.
//   - The router NEVER custodies funds: the manager transfers the executor
//     fee directly to address(this), then the router immediately forwards the
//     net reward to the executor and the withheld remainder to feeRecipient
//     in the same tx.
//   - paymentId = keccak256(manager, innerId, chainid). Multi-manager safe.
// ─────────────────────────────────────────────────────────────────────────────

import {IPulseExecutor}            from "./interfaces/IPulseExecutor.sol";
import {IPulseSubscriptionManager} from "./interfaces/IPulseSubscriptionManager.sol";
import {IPulsePayrollManager}      from "./interfaces/IPulsePayrollManager.sol";

contract PulseExecutor is IPulseExecutor {
    // ─── Constants ────────────────────────────────────────────────────────────

    uint16 public constant BUFFER_SIZE             = 50;
    uint16 public constant MIN_SAMPLES_FOR_PENALTY = 50;
    uint8  public constant MAX_HEAL_COUNT          = 3;

    // ─── Tunables (owner-settable) ───────────────────────────────────────────

    uint16 public MIN_FEE_BPS   = 10;       // 0.10%
    uint16 public MAX_FEE_BPS   = 30;       // 0.30% — must equal manager MAX_EXECUTOR_FEE_BPS
    uint64 public RAMP_DURATION = 2 days;   // overdue delay to reach MAX_FEE_BPS
    uint64 public HEAL_COOLDOWN = 7 days;   // idle time before restricted executor auto-heals

    // EMA smoothing factor (alpha = 1/8). avg = avg * 7/8 + newDelay * 1/8.
    uint64 public constant EMA_NUM   = 1;
    uint64 public constant EMA_DENOM = 8;

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;
    bool    public paused;

    /// @dev Address whitelisted to call ingest*() during a migration. Set by
    ///      owner on the SINK before the source pushes state.
    address public migrationSource;

    uint256 private _reentrancyStatus;
    uint256 public executionCount;

    mapping(bytes32 => Payment)         public payments;
    mapping(address => ExecutorStats)   public stats;
    mapping(uint256 => ExecutionRecord) public executionRecords;

    /// Last 50 outcomes per executor, packed into one uint256 (1 = failure).
    mapping(address => uint256) public outcomeBitmap;
    mapping(address => uint8)   public bufferHead;
    mapping(address => uint8)   public bufferFill;
    mapping(address => uint8)   public healCount;
    mapping(address => bool)    public restricted;
    mapping(address => uint64)  public restrictedAt;

    /// (executor, paymentId) → consecutive retry count; reset on success.
    mapping(address => mapping(bytes32 => uint8)) public retryCount;

    /// manager => is trusted (allowed to call registerPayment / deregisterPayment)
    mapping(address => bool)        public trustedManager;
    mapping(address => ManagerKind) public managerKind;

    /// @dev Enumeration arrays so a migration script can snapshot full state.
    bytes32[] internal _allPaymentIds;
    address[] internal _allExecutors;
    address[] internal _allManagers;
    mapping(bytes32 => bool) internal _paymentSeen;
    mapping(address => bool) internal _executorSeen;
    mapping(address => bool) internal _managerSeen;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    modifier whenPaused() {
        if (!paused) revert NotPausedError();
        _;
    }

    modifier onlyOwnerOrMigrationSource() {
        if (msg.sender != owner && msg.sender != migrationSource) {
            revert NotMigrationSource(msg.sender);
        }
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        owner             = msg.sender;
        feeRecipient      = _feeRecipient;
        _reentrancyStatus = 1;
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  MANAGER → EXECUTOR (registration callbacks)
    // ═════════════════════════════════════════════════════════════════════════

    function registerPayment(
        ManagerKind kind,
        bytes32     planId,
        bytes32     innerId,
        uint64      scheduledAt,
        uint64      period
    ) external returns (bytes32 paymentId) {
        if (!trustedManager[msg.sender]) revert NotTrustedManager(msg.sender);
        if (managerKind[msg.sender] != kind) revert UnknownManager(msg.sender);

        paymentId = _paymentId(msg.sender, innerId);

        // Idempotent: re-registering an existing paymentId refreshes scheduling.
        payments[paymentId] = Payment({
            kind:        kind,
            manager:     msg.sender,
            planId:      planId,
            innerId:     innerId,
            scheduledAt: scheduledAt,
            period:      period,
            registered:  true
        });
        if (!_paymentSeen[paymentId]) {
            _paymentSeen[paymentId] = true;
            _allPaymentIds.push(paymentId);
        }

        emit PaymentRegistered(paymentId, msg.sender, kind, planId, innerId, scheduledAt, period);
    }

    function deregisterPayment(bytes32 innerId) external {
        if (!trustedManager[msg.sender]) revert NotTrustedManager(msg.sender);
        bytes32 paymentId = _paymentId(msg.sender, innerId);
        Payment storage p = payments[paymentId];
        if (!p.registered) return; // idempotent
        p.registered = false;
        emit PaymentDeregistered(paymentId, msg.sender);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  KEEPER ENTRYPOINTS
    // ═════════════════════════════════════════════════════════════════════════

    function execute(bytes32 paymentId) external nonReentrant whenNotPaused {
        _checkAndHeal(msg.sender);
        if (restricted[msg.sender]) revert ExecutorRestricted(msg.sender);

        bool ok = _executeOne(paymentId, msg.sender);

        if (!ok) {
            // After a failure, recompute restriction. _executeOne already
            // recorded the outcome and emitted ExecutionFailed.
            if (_shouldRestrict(msg.sender)) {
                restricted[msg.sender]   = true;
                restrictedAt[msg.sender] = uint64(block.timestamp);
                emit ExecutorRestrictedSet(msg.sender, true);
            }
        }
    }

    function executeBatch(bytes32[] calldata paymentIds) external nonReentrant whenNotPaused {
        uint256 len = paymentIds.length;
        if (len == 0) revert BatchEmpty();

        _checkAndHeal(msg.sender);
        if (restricted[msg.sender]) revert ExecutorRestricted(msg.sender);

        uint256 successCnt;
        uint256 failCnt;

        for (uint256 i; i < len; ) {
            bool ok = _executeOne(paymentIds[i], msg.sender);
            if (ok) {
                unchecked { ++successCnt; }
            } else {
                unchecked { ++failCnt; }
                if (_shouldRestrict(msg.sender)) {
                    restricted[msg.sender]   = true;
                    restrictedAt[msg.sender] = uint64(block.timestamp);
                    emit ExecutorRestrictedSet(msg.sender, true);
                    // Don't process further payments once restricted.
                    failCnt += (len - i - 1);
                    break;
                }
            }
            unchecked { ++i; }
        }

        emit BatchExecuted(msg.sender, successCnt, failCnt);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  CORE
    // ═════════════════════════════════════════════════════════════════════════

    /// @dev Executes one payment. Records the outcome (success or failure) in
    ///      stats and the bitmap. Returns true on success, false on failure.
    ///      Never reverts — even on manager-side reverts we capture the reason
    ///      and persist a failed ExecutionRecord.
    function _executeOne(bytes32 paymentId, address executor) internal returns (bool) {
        Payment memory p = payments[paymentId];
        if (!p.registered) {
            _recordFailure(paymentId, executor, p, 0, 0, 0, keccak256("PaymentNotRegistered"));
            return false;
        }
        if (block.timestamp < p.scheduledAt) {
            _recordFailure(paymentId, executor, p, 0, 0, 0, keccak256("PaymentNotDue"));
            return false;
        }

        uint256 delay = block.timestamp - p.scheduledAt;
        uint16  bps   = _dynamicFeeBpsInternal(delay);

        // Penalty tier only applies once the buffer has enough samples to be
        // statistically meaningful (≥ MIN_SAMPLES_FOR_PENALTY). Below that
        // threshold, every execution is tier 0 (full reward).
        uint8   tier    = _effectiveTier(executor);
        uint256 keepPct = _keepPctFor(tier);

        uint256 gasStart = gasleft();
        bool    callOk;
        uint256 gross;
        uint256 execFeeReceived;
        uint256 protoPaid;
        bytes32 reasonHash;
        address merchant;
        address payer;
        address token;

        if (p.kind == ManagerKind.Subscription) {
            try IPulseSubscriptionManager(p.manager).chargeFor(
                p.innerId, bps, address(this)
            ) returns (uint256 g, uint256 e, uint256 pp) {
                callOk = true;
                gross = g; execFeeReceived = e; protoPaid = pp;
                IPulseSubscriptionManager.Subscription memory s =
                    IPulseSubscriptionManager(p.manager).getSubscription(p.innerId);
                merchant = s.merchant;
                payer    = s.customer;
                token    = s.token;
            } catch (bytes memory reason) {
                reasonHash = _hashReason(reason);
            }
        } else {
            try IPulsePayrollManager(p.manager).executePayrollFor(
                p.planId, p.innerId, bps, address(this)
            ) returns (uint256 g, uint256 e, uint256 pp) {
                callOk = true;
                gross = g; execFeeReceived = e; protoPaid = pp;
                IPulsePayrollManager.Plan memory plan =
                    IPulsePayrollManager(p.manager).getPlan(p.planId);
                merchant = plan.employer;
                payer    = plan.employer;
                token    = plan.token;
            } catch (bytes memory reason) {
                reasonHash = _hashReason(reason);
            }
        }

        uint64 gasUsed = uint64(gasStart - gasleft());

        if (!callOk) {
            _recordFailure(paymentId, executor, p, delay, bps, gasUsed, reasonHash);
            return false;
        }

        // gross == 0 means the manager auto-cancelled (spend cap) — count it
        // as a success in stats (state advanced) but no fee was paid.
        uint256 executorReward = (execFeeReceived * keepPct) / 100;
        uint256 withheld       = execFeeReceived - executorReward;

        // ── EFFECTS (all state updates before external transfers) ────────────
        if (gross > 0) {
            payments[paymentId].scheduledAt = p.scheduledAt + p.period;
        } else if (payments[paymentId].registered) {
            // gross==0 = auto-cancel/auto-remove. Skip if the manager already
            // called deregisterPayment back into us (payroll spend-cap path).
            payments[paymentId].registered = false;
            emit PaymentDeregistered(paymentId, p.manager);
        }

        _pushOutcome(executor, false);
        _updateStatsSuccess(executor, gross, executorReward, delay);
        retryCount[executor][paymentId] = 0;

        uint256 newScheduled = payments[paymentId].scheduledAt;

        executionCount += 1;
        executionRecords[executionCount] = ExecutionRecord({
            paymentId:          paymentId,
            executor:           executor,
            manager:            p.manager,
            merchant:           merchant,
            payer:              payer,
            executionTimestamp: uint64(block.timestamp),
            scheduledTimestamp: p.scheduledAt,
            delaySeconds:       uint64(delay),
            bpsApplied:         bps,
            executionTier:      tier,
            retryCount:         0,
            success:            true,
            executorFeePaid:    uint128(executorReward),
            protocolFeePaid:    uint128(protoPaid + withheld),
            grossAmount:        uint128(gross),
            withheld:           uint128(withheld),
            gasUsed:            gasUsed,
            gasPrice:           uint64(tx.gasprice),
            failureReasonHash:  bytes32(0)
        });

        // ── INTERACTIONS ──────────────────────────────────────────────────────
        if (executorReward > 0) _safeTransfer(token, executor,     executorReward);
        if (withheld       > 0) _safeTransfer(token, feeRecipient, withheld);

        emit ExecutionSucceeded(
            paymentId,
            executor,
            gross,
            executorReward,
            withheld,
            bps,
            uint64(delay),
            uint64(newScheduled)
        );
        if (withheld > 0) emit PenaltyApplied(executor, withheld, tier);

        return true;
    }

    function _recordFailure(
        bytes32 paymentId,
        address executor,
        Payment memory p,
        uint256 delay,
        uint16  bps,
        uint64  gasUsed,
        bytes32 reasonHash
    ) internal {
        // Bump retry count for this (executor, paymentId).
        uint8 nextRetry = retryCount[executor][paymentId];
        unchecked { nextRetry = nextRetry < 255 ? nextRetry + 1 : 255; }
        retryCount[executor][paymentId] = nextRetry;

        _pushOutcome(executor, true /* failure */);
        _updateStatsFailure(executor);

        executionCount += 1;
        executionRecords[executionCount] = ExecutionRecord({
            paymentId:          paymentId,
            executor:           executor,
            manager:            p.manager,
            merchant:           address(0),
            payer:              address(0),
            executionTimestamp: uint64(block.timestamp),
            scheduledTimestamp: p.scheduledAt,
            delaySeconds:       uint64(delay),
            bpsApplied:         bps,
            executionTier:      _effectiveTier(executor),
            retryCount:         nextRetry,
            success:            false,
            executorFeePaid:    0,
            protocolFeePaid:    0,
            grossAmount:        0,
            withheld:           0,
            gasUsed:            gasUsed,
            gasPrice:           uint64(tx.gasprice),
            failureReasonHash:  reasonHash
        });

        emit ExecutionFailed(paymentId, executor, reasonHash);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  STATS / BITMAP
    // ═════════════════════════════════════════════════════════════════════════

    function _pushOutcome(address e, bool failure) internal {
        uint8 head = bufferHead[e];
        uint256 bm = outcomeBitmap[e];
        // Clear bit at head, set if failure.
        bm &= ~(uint256(1) << head);
        if (failure) bm |= (uint256(1) << head);
        outcomeBitmap[e] = bm;

        unchecked {
            uint8 nextHead = head + 1;
            if (nextHead >= BUFFER_SIZE) nextHead = 0;
            bufferHead[e] = nextHead;
            if (bufferFill[e] < BUFFER_SIZE) bufferFill[e] += 1;
        }
    }

    function _updateStatsSuccess(
        address e,
        uint256 gross,
        uint256 reward,
        uint256 delay
    ) internal {
        _seeExecutor(e);
        ExecutorStats storage s = stats[e];
        unchecked {
            s.totalExecutions      += 1;
            s.successfulExecutions += 1;
            s.totalVolumeProcessed += uint128(gross);
            s.totalFeesEarned      += uint128(reward);
        }
        s.averageExecutionDelay  = _emaUpdate(s.averageExecutionDelay, uint64(delay));
        s.lastExecutionTimestamp = uint64(block.timestamp);
    }

    function _updateStatsFailure(address e) internal {
        _seeExecutor(e);
        ExecutorStats storage s = stats[e];
        unchecked {
            s.totalExecutions  += 1;
            s.failedExecutions += 1;
        }
        s.lastExecutionTimestamp = uint64(block.timestamp);
    }

    function _seeExecutor(address e) internal {
        if (!_executorSeen[e]) {
            _executorSeen[e] = true;
            _allExecutors.push(e);
        }
    }

    function _emaUpdate(uint64 prev, uint64 sample) internal pure returns (uint64) {
        if (prev == 0) return sample;
        // prev * (DENOM - NUM) / DENOM + sample * NUM / DENOM
        unchecked {
            return uint64((uint256(prev) * (EMA_DENOM - EMA_NUM) + uint256(sample) * EMA_NUM) / EMA_DENOM);
        }
    }

    function _failureRateBps(address e) internal view returns (uint256) {
        uint8 fill = bufferFill[e];
        if (fill == 0) return 0;
        return (_popcount(outcomeBitmap[e]) * 10_000) / fill;
    }

    function _shouldRestrict(address e) internal view returns (bool) {
        if (bufferFill[e] < MIN_SAMPLES_FOR_PENALTY) return false;
        return _failureRateBps(e) >= 3_000; // ≥ 30%
    }

    function _checkAndHeal(address e) internal {
        if (!restricted[e]) return;
        if (healCount[e] >= MAX_HEAL_COUNT) revert AlreadyHealMaxedOut(e);
        uint64 last = stats[e].lastExecutionTimestamp;
        if (block.timestamp < uint256(last) + HEAL_COOLDOWN) return;
        restricted[e]    = false;
        outcomeBitmap[e] = 0;
        bufferHead[e]    = 0;
        bufferFill[e]    = 0;
        unchecked { healCount[e] += 1; }
        emit ExecutorHealed(e, healCount[e]);
    }

    function _tierFor(uint256 frBps) internal pure returns (uint8) {
        if (frBps <  500)  return 0; // <5%      keep 100%
        if (frBps < 1500)  return 1; // 5–<15%   keep 80%
        if (frBps < 3000)  return 2; // 15–<30%  keep 50%
        return 3;                    // ≥30%     restricted
    }

    /// @dev Tier with sample-size guard. Tier 0 (no penalty) until enough
    ///      samples have accumulated to make the rate statistically reliable.
    function _effectiveTier(address e) internal view returns (uint8) {
        if (bufferFill[e] < MIN_SAMPLES_FOR_PENALTY) return 0;
        return _tierFor(_failureRateBps(e));
    }

    function _keepPctFor(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return 100;
        if (tier == 1) return 80;
        if (tier == 2) return 50;
        return 0; // unreachable in normal flow — restricted executors revert earlier
    }

    /// @dev SWAR popcount over a uint256 (50 useful bits, top 206 are zero).
    function _popcount(uint256 x) internal pure returns (uint256) {
        unchecked {
            x = x - ((x >> 1) & 0x5555555555555555555555555555555555555555555555555555555555555555);
            x = (x & 0x3333333333333333333333333333333333333333333333333333333333333333)
              + ((x >> 2) & 0x3333333333333333333333333333333333333333333333333333333333333333);
            x = (x + (x >> 4)) & 0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f;
            return (x * 0x0101010101010101010101010101010101010101010101010101010101010101) >> 248;
        }
    }

    function _dynamicFeeBpsInternal(uint256 delay) internal view returns (uint16) {
        if (delay >= RAMP_DURATION) return MAX_FEE_BPS;
        uint256 span = MAX_FEE_BPS - MIN_FEE_BPS;
        return uint16(uint256(MIN_FEE_BPS) + (span * delay) / RAMP_DURATION);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  TOKEN / PAYOUT
    // ═════════════════════════════════════════════════════════════════════════

    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSelector(0xa9059cbb, to, amount)
        );
        require(
            ok && (data.length == 0 || abi.decode(data, (bool))),
            "Pulse: transfer failed"
        );
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

    function _paymentId(address manager, bytes32 innerId) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(manager, innerId, block.chainid));
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  VIEWS
    // ═════════════════════════════════════════════════════════════════════════

    function computePaymentId(address manager, bytes32 innerId)
        external view returns (bytes32)
    {
        return _paymentId(manager, innerId);
    }

    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    function getStats(address executor) external view returns (ExecutorStats memory) {
        return stats[executor];
    }

    function getExecution(uint256 nonce) external view returns (ExecutionRecord memory) {
        return executionRecords[nonce];
    }

    function failureRateBps(address executor) external view returns (uint256) {
        return _failureRateBps(executor);
    }

    function isRestricted(address executor) external view returns (bool) {
        return restricted[executor];
    }

    function dynamicFeeBps(uint256 delaySeconds) external view returns (uint16) {
        return _dynamicFeeBpsInternal(delaySeconds);
    }

    // ─── Enumeration (for migration snapshots) ────────────────────────────────

    function paymentCount() external view returns (uint256) {
        return _allPaymentIds.length;
    }
    function executorCount() external view returns (uint256) {
        return _allExecutors.length;
    }
    function managerCount() external view returns (uint256) {
        return _allManagers.length;
    }

    function paymentIdsSlice(uint256 start, uint256 end)
        external view returns (bytes32[] memory ids)
    {
        if (end > _allPaymentIds.length) end = _allPaymentIds.length;
        if (start >= end) return new bytes32[](0);
        ids = new bytes32[](end - start);
        for (uint256 i = start; i < end; ) {
            ids[i - start] = _allPaymentIds[i];
            unchecked { ++i; }
        }
    }

    function executorsSlice(uint256 start, uint256 end)
        external view returns (address[] memory addrs)
    {
        if (end > _allExecutors.length) end = _allExecutors.length;
        if (start >= end) return new address[](0);
        addrs = new address[](end - start);
        for (uint256 i = start; i < end; ) {
            addrs[i - start] = _allExecutors[i];
            unchecked { ++i; }
        }
    }

    function managersSlice(uint256 start, uint256 end)
        external view returns (address[] memory addrs)
    {
        if (end > _allManagers.length) end = _allManagers.length;
        if (start >= end) return new address[](0);
        addrs = new address[](end - start);
        for (uint256 i = start; i < end; ) {
            addrs[i - start] = _allManagers[i];
            unchecked { ++i; }
        }
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  MIGRATION — push state to a new deployment of the same code.
    //
    //  Every push function reads from THIS contract's storage and calls the
    //  matching ingest*() on `sink`. Sink must be paused; this contract should
    //  also be paused to prevent state shifting mid-migration.
    // ═════════════════════════════════════════════════════════════════════════

    function migratePaymentsTo(address sink, uint256 start, uint256 end)
        external onlyOwner whenPaused
    {
        if (sink == address(0)) revert ZeroAddress();
        if (end > _allPaymentIds.length) end = _allPaymentIds.length;
        for (uint256 i = start; i < end; ) {
            bytes32 pid = _allPaymentIds[i];
            IPulseExecutor(sink).ingestPayment(pid, payments[pid]);
            unchecked { ++i; }
        }
        emit MigratedPayments(sink, start, end);
    }

    function migrateExecutorStateTo(address sink, uint256 start, uint256 end)
        external onlyOwner whenPaused
    {
        if (sink == address(0)) revert ZeroAddress();
        if (end > _allExecutors.length) end = _allExecutors.length;
        for (uint256 i = start; i < end; ) {
            address e = _allExecutors[i];
            IPulseExecutor(sink).ingestExecutorState(
                e,
                stats[e],
                outcomeBitmap[e],
                bufferHead[e],
                bufferFill[e],
                healCount[e],
                restricted[e],
                restrictedAt[e]
            );
            unchecked { ++i; }
        }
        emit MigratedExecutors(sink, start, end);
    }

    function migrateManagersTo(address sink, uint256 start, uint256 end)
        external onlyOwner whenPaused
    {
        if (sink == address(0)) revert ZeroAddress();
        if (end > _allManagers.length) end = _allManagers.length;
        for (uint256 i = start; i < end; ) {
            address m = _allManagers[i];
            IPulseExecutor(sink).ingestManager(m, managerKind[m], trustedManager[m]);
            unchecked { ++i; }
        }
        emit MigratedManagers(sink, start, end);
    }

    function migrateConfigTo(address sink) external onlyOwner whenPaused {
        if (sink == address(0)) revert ZeroAddress();
        IPulseExecutor(sink).ingestConfig(
            MIN_FEE_BPS,
            MAX_FEE_BPS,
            RAMP_DURATION,
            HEAL_COOLDOWN,
            executionCount
        );
        emit MigratedConfig(sink);
    }

    // ─── Ingest (sink) ────────────────────────────────────────────────────────

    function ingestPayment(bytes32 paymentId, Payment calldata p)
        external onlyOwnerOrMigrationSource whenPaused
    {
        payments[paymentId] = p;
        if (!_paymentSeen[paymentId]) {
            _paymentSeen[paymentId] = true;
            _allPaymentIds.push(paymentId);
        }
        emit IngestedPayment(paymentId);
    }

    function ingestExecutorState(
        address executor,
        ExecutorStats calldata s,
        uint256 bitmap,
        uint8   head,
        uint8   fill,
        uint8   heals,
        bool    isRestricted_,
        uint64  restrictedAtTs
    ) external onlyOwnerOrMigrationSource whenPaused {
        stats[executor]         = s;
        outcomeBitmap[executor] = bitmap;
        bufferHead[executor]    = head;
        bufferFill[executor]    = fill;
        healCount[executor]     = heals;
        restricted[executor]    = isRestricted_;
        restrictedAt[executor]  = restrictedAtTs;
        _seeExecutor(executor);
        emit IngestedExecutorState(executor);
    }

    function ingestManager(address manager, ManagerKind kind, bool isTrusted)
        external onlyOwnerOrMigrationSource whenPaused
    {
        trustedManager[manager] = isTrusted;
        managerKind[manager]    = kind;
        if (!_managerSeen[manager]) {
            _managerSeen[manager] = true;
            _allManagers.push(manager);
        }
        emit IngestedManager(manager);
    }

    function ingestConfig(
        uint16 minBps,
        uint16 maxBps,
        uint64 rampDuration,
        uint64 healCooldown,
        uint256 newExecutionCount
    ) external onlyOwnerOrMigrationSource whenPaused {
        MIN_FEE_BPS   = minBps;
        MAX_FEE_BPS   = maxBps;
        RAMP_DURATION = rampDuration;
        HEAL_COOLDOWN = healCooldown;
        if (newExecutionCount > executionCount) executionCount = newExecutionCount;
        emit IngestedConfig();
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  OWNER ADMIN
    // ═════════════════════════════════════════════════════════════════════════

    function registerManager(address manager, ManagerKind kind) external onlyOwner {
        if (manager == address(0)) revert ZeroAddress();
        trustedManager[manager] = true;
        managerKind[manager]    = kind;
        if (!_managerSeen[manager]) {
            _managerSeen[manager] = true;
            _allManagers.push(manager);
        }
        emit ManagerRegistered(manager, kind);
    }

    function unregisterManager(address manager) external onlyOwner {
        trustedManager[manager] = false;
        emit ManagerUnregistered(manager);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function setMigrationSource(address newSource) external onlyOwner {
        migrationSource = newSource;
        emit MigrationSourceSet(newSource);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }

    function setRampParams(uint16 minBps, uint16 maxBps, uint64 rampDuration) external onlyOwner {
        if (minBps > maxBps)    revert InvalidRampParams();
        if (maxBps > 30)        revert InvalidRampParams(); // hard ceiling matches manager
        if (rampDuration == 0)  revert InvalidRampParams();
        MIN_FEE_BPS   = minBps;
        MAX_FEE_BPS   = maxBps;
        RAMP_DURATION = rampDuration;
        emit RampParamsUpdated(minBps, maxBps, rampDuration);
    }

    function setRestricted(address executor, bool isRestricted_) external onlyOwner {
        restricted[executor] = isRestricted_;
        if (isRestricted_) {
            restrictedAt[executor] = uint64(block.timestamp);
            _seeExecutor(executor);
        }
        emit ExecutorRestrictedSet(executor, isRestricted_);
    }

    function setHealCount(address executor, uint8 newCount) external onlyOwner {
        healCount[executor] = newCount;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Paused(false);
    }

    /// @notice Owner-only manual registration for cases where the manager's
    ///         try/catch callback failed at subscribe/addRecipient time.
    function backfillRegister(
        ManagerKind kind,
        address     manager,
        bytes32     planId,
        bytes32     innerId,
        uint64      scheduledAt,
        uint64      period
    ) external onlyOwner returns (bytes32 paymentId) {
        if (!trustedManager[manager]) revert NotTrustedManager(manager);
        paymentId = _paymentId(manager, innerId);
        payments[paymentId] = Payment({
            kind:        kind,
            manager:     manager,
            planId:      planId,
            innerId:     innerId,
            scheduledAt: scheduledAt,
            period:      period,
            registered:  true
        });
        emit PaymentRegistered(paymentId, manager, kind, planId, innerId, scheduledAt, period);
    }
}
