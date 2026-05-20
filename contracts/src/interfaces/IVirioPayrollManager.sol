// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IVirioPayrollManager {
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

    function executePayroll(bytes32 planId, bytes32 recipientId) external;

    function executePayrollBatch(bytes32 planId, bytes32[] calldata recipientIds) external;

    function getPlan(bytes32 planId) external view returns (Plan memory);

    function getRecipient(bytes32 planId, bytes32 recipientId)
        external view returns (Recipient memory);

    function getPlanRecipientIds(bytes32 planId)
        external view returns (bytes32[] memory);

    function computeRecipientId(bytes32 planId, address wallet)
        external pure returns (bytes32);
}
