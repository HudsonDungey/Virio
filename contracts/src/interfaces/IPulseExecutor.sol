// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPulseExecutor
/// @notice Executor router for the Pulse protocol. Maps executors by address,
///         dispatches by paymentId, applies a time-decayed reward (linear ramp
///         to 0.3% over 2 days overdue) and a failure-rate penalty ladder.
interface IPulseExecutor {
    // ─── Enums ────────────────────────────────────────────────────────────────

    enum ManagerKind { Subscription, Payroll }

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Payment {
        ManagerKind kind;
        address     manager;        // contract address that owns innerId
        bytes32     planId;         // payroll: the plan id; subscription: unused (0)
        bytes32     innerId;        // subscriptionId or recipientId
        uint64      scheduledAt;    // next eligible execution timestamp
        uint64      period;         // seconds between executions
        bool        registered;
    }

    struct ExecutorStats {
        uint128 totalExecutions;
        uint128 successfulExecutions;
        uint128 failedExecutions;
        uint128 totalVolumeProcessed;   // sum of gross amounts on success
        uint128 totalFeesEarned;        // executor's net fee (after penalty)
        uint64  averageExecutionDelay;  // EMA, seconds
        uint64  lastExecutionTimestamp;
    }

    struct ExecutionRecord {
        bytes32 paymentId;
        address executor;
        address manager;
        address merchant;          // payer-side party (merchant or employer)
        address payer;             // customer or employer (best-effort)
        uint64  executionTimestamp;
        uint64  scheduledTimestamp;
        uint64  delaySeconds;
        uint16  bpsApplied;
        uint8   executionTier;     // 0..3 penalty tier index
        uint8   retryCount;        // (executor, paymentId) retry count at time of execution
        bool    success;
        uint128 executorFeePaid;   // net to executor (after penalty)
        uint128 protocolFeePaid;
        uint128 grossAmount;
        uint128 withheld;          // penalty portion routed to protocol
        uint64  gasUsed;
        uint64  gasPrice;
        bytes32 failureReasonHash;
    }

    // ─── Errors ───────────────────────────────────────────────────────────────

    error PaymentNotRegistered(bytes32 paymentId);
    error PaymentNotDue(bytes32 paymentId, uint256 scheduledAt);
    error ExecutorRestricted(address executor);
    error UnknownManager(address manager);
    error NotTrustedManager(address sender);
    error FeeBpsExceedsMax(uint16 bps, uint16 max);
    error PausedError();
    error NotPausedError();
    error ZeroAddress();
    error NotOwner();
    error BatchEmpty();
    error InvalidRampParams();
    error AlreadyHealMaxedOut(address executor);
    error NotMigrationSource(address caller);

    // ─── Events ───────────────────────────────────────────────────────────────

    event ManagerRegistered(address indexed manager, ManagerKind kind);
    event ManagerUnregistered(address indexed manager);

    event PaymentRegistered(
        bytes32 indexed paymentId,
        address indexed manager,
        ManagerKind     kind,
        bytes32         planId,
        bytes32         innerId,
        uint64          scheduledAt,
        uint64          period
    );

    event PaymentDeregistered(bytes32 indexed paymentId, address indexed manager);

    event ExecutionSucceeded(
        bytes32 indexed paymentId,
        address indexed executor,
        uint256         grossAmount,
        uint256         executorReward,
        uint256         withheld,
        uint16          bpsApplied,
        uint64          delaySeconds,
        uint64          nextScheduledAt
    );

    event ExecutionFailed(
        bytes32 indexed paymentId,
        address indexed executor,
        bytes32         reasonHash
    );

    event BatchExecuted(
        address indexed executor,
        uint256         successCount,
        uint256         failCount
    );

    event ExecutorRestrictedSet(address indexed executor, bool restricted);
    event ExecutorHealed(address indexed executor, uint8 healCount);
    event PenaltyApplied(address indexed executor, uint256 withheldAmount, uint8 tier);

    event RampParamsUpdated(uint16 minFeeBps, uint16 maxFeeBps, uint64 rampDuration);
    event FeeRecipientUpdated(address indexed newRecipient);
    event Paused(bool paused);

    event MigratedPayments(address indexed sink, uint256 start, uint256 end);
    event MigratedExecutors(address indexed sink, uint256 start, uint256 end);
    event MigratedManagers(address indexed sink, uint256 start, uint256 end);
    event MigratedConfig(address indexed sink);

    event IngestedPayment(bytes32 indexed paymentId);
    event IngestedExecutorState(address indexed executor);
    event IngestedManager(address indexed manager);
    event IngestedConfig();
    event MigrationSourceSet(address indexed source);

    // ─── Functions (Manager → Executor) ──────────────────────────────────────

    /// @notice Called by a trusted manager when a new chargeable item is created
    ///         (subscribe / addRecipient). Idempotent: re-registering the same
    ///         paymentId is a no-op so re-subscribe after cancel works.
    function registerPayment(
        ManagerKind kind,
        bytes32     planId,
        bytes32     innerId,
        uint64      scheduledAt,
        uint64      period
    ) external returns (bytes32 paymentId);

    /// @notice Called by a trusted manager when an item is cancelled / removed.
    function deregisterPayment(bytes32 innerId) external;

    // ─── Functions (Keeper bots) ──────────────────────────────────────────────

    function execute(bytes32 paymentId) external;
    function executeBatch(bytes32[] calldata paymentIds) external;

    // ─── Views ────────────────────────────────────────────────────────────────

    function computePaymentId(address manager, bytes32 innerId)
        external view returns (bytes32);

    function getPayment(bytes32 paymentId)
        external view returns (Payment memory);

    function getStats(address executor)
        external view returns (ExecutorStats memory);

    function getExecution(uint256 nonce)
        external view returns (ExecutionRecord memory);

    function failureRateBps(address executor) external view returns (uint256);

    function isRestricted(address executor) external view returns (bool);

    function dynamicFeeBps(uint256 delaySeconds) external view returns (uint16);

    // ─── Migration intake (owner-only, only when paused) ─────────────────────

    function ingestPayment(bytes32 paymentId, Payment calldata p) external;
    function ingestExecutorState(
        address executor,
        ExecutorStats calldata s,
        uint256 bitmap,
        uint8   head,
        uint8   fill,
        uint8   heals,
        bool    isRestricted_,
        uint64  restrictedAtTs
    ) external;
    function ingestManager(address manager, ManagerKind kind, bool isTrusted) external;
    function ingestConfig(
        uint16 minBps,
        uint16 maxBps,
        uint64 rampDuration,
        uint64 healCooldown,
        uint256 newExecutionCount
    ) external;
}
