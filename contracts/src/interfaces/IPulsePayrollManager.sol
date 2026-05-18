// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPulsePayrollManager {
    // ─── Structs ──────────────────────────────────────────────────────────────

    struct Plan {
        address employer;       // who created the plan (business owner)
        address token;          // ERC-20 token used for payroll
        uint256 period;         // seconds between pay cycles (e.g. 604800 = 1 week)
        bool    active;
    }

    struct Recipient {
        address wallet;         // employee/contractor wallet
        uint256 amount;         // gross amount per pay cycle
        uint256 nextPayAt;      // next eligible charge timestamp
        uint256 totalPaid;      // running total paid to this recipient
        uint256 spendCap;       // 0 = unlimited, otherwise auto-remove when exceeded
        bool    active;
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event PlanCreated(
        bytes32 indexed planId,
        address indexed employer,
        address token,
        uint256 period
    );

    event PlanDeactivated(bytes32 indexed planId, address indexed employer);

    event RecipientAdded(
        bytes32 indexed planId,
        bytes32 indexed recipientId,
        address wallet,
        uint256 amount,
        uint256 spendCap
    );

    event RecipientRemoved(
        bytes32 indexed planId,
        bytes32 indexed recipientId,
        address indexed removedBy
    );

    event RecipientUpdated(
        bytes32 indexed planId,
        bytes32 indexed recipientId,
        uint256 newAmount,
        uint256 newSpendCap
    );

    event PayrollExecuted(
        bytes32 indexed planId,
        bytes32 indexed recipientId,
        address indexed executor,
        address recipient,
        uint256 grossAmount,
        uint256 recipientAmount,
        uint256 executorFee,
        uint256 protocolFee,
        uint256 nextPayAt
    );

    event BatchPayrollExecuted(
        bytes32 indexed planId,
        address indexed executor,
        uint256 successCount,
        uint256 failCount
    );

    /// Emitted when the optional executor callback fails. The add / remove
    /// operation still succeeds; an owner can backfill on the executor.
    event RegistrationFailed(bytes32 indexed recipientId, bytes32 reasonHash);

    event Paused(bool paused);
    event MigratedPlans(address indexed sink, uint256 start, uint256 end);
    event MigratedRecipients(address indexed sink, bytes32 indexed planId, uint256 start, uint256 end);
    event MigratedPlanNonce(address indexed sink, uint256 nonce);
    event IngestedPlan(bytes32 indexed planId);
    event IngestedRecipient(bytes32 indexed planId, bytes32 indexed recipientId);
    event IngestedPlanNonce(uint256 nonce);
    event MigrationSourceSet(address indexed source);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidAmount();
    error InvalidPeriod();
    error PlanNotActive(bytes32 planId);
    error UnauthorizedEmployer(bytes32 planId);
    error RecipientAlreadyExists(bytes32 recipientId);
    error RecipientNotActive(bytes32 recipientId);
    error TooEarlyToPay(bytes32 recipientId, uint256 nextPayAt);
    error TransferFailed();
    error ArrayLengthMismatch();
    error NotTrustedExecutor(address caller);
    error FeeBpsExceedsMax(uint16 bps, uint16 max);
    error PausedError();
    error NotPausedError();
    error NotMigrationSource(address caller);

    // ─── Functions ────────────────────────────────────────────────────────────

    function EXECUTOR_FEE_BPS() external view returns (uint16);

    function createPlan(address token, uint256 period)
        external returns (bytes32 planId);

    function deactivatePlan(bytes32 planId) external;

    function addRecipient(
        bytes32 planId,
        address wallet,
        uint256 amount,
        uint256 spendCap
    ) external returns (bytes32 recipientId);

    function addRecipientsBatch(
        bytes32 planId,
        address[] calldata wallets,
        uint256[] calldata amounts,
        uint256[] calldata spendCaps
    ) external returns (bytes32[] memory recipientIds);

    function removeRecipient(bytes32 planId, bytes32 recipientId) external;

    function updateRecipient(
        bytes32 planId,
        bytes32 recipientId,
        uint256 newAmount,
        uint256 newSpendCap
    ) external;

    /// @notice Execute payroll for a single recipient. Only callable by the
    ///         trusted executor router so every charge is scored and recorded.
    /// @param  executorFeeBpsOverride  Dynamic executor fee (capped at 30 bps).
    /// @param  executorPayee  Address that receives the executor fee
    ///                        (the router contract, which then splits it).
    function executePayrollFor(
        bytes32 planId,
        bytes32 recipientId,
        uint16  executorFeeBpsOverride,
        address executorPayee
    ) external returns (uint256 grossAmount, uint256 executorFeePaid, uint256 protocolFeePaid);

    /// @notice Batch variant. Per-recipient failures are absorbed and counted
    ///         in the BatchPayrollExecuted event; the call as a whole does not
    ///         revert. Returns aggregate executor / protocol fees.
    function executePayrollBatchFor(
        bytes32   planId,
        bytes32[] calldata recipientIds,
        uint16    executorFeeBpsOverride,
        address   executorPayee
    ) external returns (uint256 totalExecutorFee, uint256 totalProtocolFee, uint256 successCount, uint256 failCount);

    function getPlan(bytes32 planId) external view returns (Plan memory);

    function getRecipient(bytes32 planId, bytes32 recipientId)
        external view returns (Recipient memory);

    function getPlanRecipientIds(bytes32 planId)
        external view returns (bytes32[] memory);

    function computeRecipientId(bytes32 planId, address wallet)
        external pure returns (bytes32);

    // ─── Migration intake (owner-only, only when paused) ─────────────────────

    function ingestPlan(bytes32 planId, Plan calldata plan) external;
    function ingestRecipient(bytes32 planId, bytes32 recipientId, Recipient calldata r) external;
    function ingestPlanNonce(uint256 nonce) external;
}
