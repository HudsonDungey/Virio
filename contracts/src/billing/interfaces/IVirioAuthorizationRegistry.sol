// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVirioAuthorizationRegistry
/// @notice The payer-owned spending authorization layer of the Virio billing protocol.
///
///         Virio separates three concerns:
///           * Billing        — what the merchant is owed (billing modules).
///           * Authorization  — what the payer has permitted (this contract).
///           * Settlement     — moving the stablecoin (this contract).
///
///         Billing modules never move money. They compute an amount owed and
///         call `settle()`, which re-checks every payer-defined limit before
///         transferring. A module therefore cannot collect more than the payer
///         authorized, regardless of what its own accounting believes.
interface IVirioAuthorizationRegistry {
    // ─── Types ───────────────────────────────────────────────────────────────

    /// Which billing model an authorization is for.
    /// A HYBRID authorization accepts settlements from both module types and
    /// shares one set of spend caps between them.
    enum BillingType {
        RECURRING,
        METERED,
        HYBRID
    }

    /// Lifecycle of a billing module as seen by the registry.
    /// Disabled → never registered, or retired. Paused → registered but
    /// temporarily barred from settling (granular emergency control).
    enum ModuleStatus {
        Disabled,
        Active,
        Paused
    }

    /// @dev Money fields are uint128. USDC has 6 decimals, so uint128 covers
    ///      ~3.4e32 tokens — far beyond any real stablecoin supply. The narrower
    ///      width lets `spentThisPeriod` and `totalSpent` share one storage slot,
    ///      making the settlement hot path a single SSTORE. Executors are paid a
    ///      fraction of a small charge, so settle() gas is the binding economic
    ///      constraint on this protocol.
    struct Authorization {
        // ── slot 0 ──
        address payer;
        BillingType billingType;
        bool active;
        /// Seconds in a spend-cap period. 0 = no period accounting.
        uint64 periodDuration;
        // ── slot 1 ──
        address merchant;
        /// Start of the current spend-cap period. Advances additively, so a
        /// late settlement never shifts the period grid.
        uint64 periodStart;
        // ── slot 2 ──
        address token;
        /// Authorization is not settleable before this timestamp.
        uint64 validAfter;
        // ── slot 3 ──
        /// Authorization is not settleable at/after this timestamp. 0 = no expiry.
        uint64 validUntil;
        /// Largest single settlement. Always > 0 — there is no "unlimited" charge.
        uint128 maxPerCharge;
        // ── slot 4 ──
        /// Spend ceiling per period. 0 = uncapped within the period.
        uint128 periodSpendCap;
        /// Lifetime spend ceiling. 0 = uncapped.
        uint128 totalSpendCap;
        // ── slot 5 (the only slot settle() always writes) ──
        uint128 spentThisPeriod;
        uint128 totalSpent;
    }

    /// Parameters for `authorize()`. Grouped into a struct because the payer is
    /// consenting to all of them at once — the wallet prompt shows this object.
    struct AuthorizationParams {
        address merchant;
        address token;
        BillingType billingType;
        uint128 maxPerCharge;
        uint128 periodSpendCap;
        uint128 totalSpendCap;
        uint64 periodDuration;
        uint64 validAfter;
        uint64 validUntil;
    }

    // ─── Errors ──────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidAmount();
    error InvalidPeriod();
    error InvalidWindow();
    /// Authorization id does not exist or has been revoked.
    error AuthorizationNotActive(bytes32 authorizationId);
    /// Caller is neither the authorization's payer nor its merchant.
    error NotAuthorizationParty(bytes32 authorizationId);
    /// block.timestamp is outside [validAfter, validUntil).
    error AuthorizationNotYetValid(bytes32 authorizationId, uint64 validAfter);
    error AuthorizationExpired(bytes32 authorizationId, uint64 validUntil);
    /// Settlement exceeds the payer's per-charge limit.
    error MaxPerChargeExceeded(bytes32 authorizationId, uint256 amount, uint128 maxPerCharge);
    /// Settlement would push spend past the period cap.
    error PeriodSpendCapExceeded(bytes32 authorizationId, uint256 wouldSpend, uint128 cap);
    /// Settlement would push spend past the lifetime cap.
    error TotalSpendCapExceeded(bytes32 authorizationId, uint256 wouldSpend, uint128 cap);
    /// Settlement token does not match the authorization's token.
    error TokenMismatch(bytes32 authorizationId, address expected, address actual);
    /// Caller is not a registered billing module, or is paused.
    error ModuleNotActive(address module);
    /// The module's billing type cannot settle this authorization's billing type.
    error IncompatibleBillingType(address module, BillingType authorizationType);
    /// Fee configuration would leave the merchant nothing (or is above the cap).
    error InvalidFeeConfiguration();
    /// An amount does not fit the protocol's uint128 money width.
    error AmountOverflow();
    error NotOwner();

    // ─── Events ──────────────────────────────────────────────────────────────

    event AuthorizationCreated(
        bytes32 indexed authorizationId,
        address indexed payer,
        address indexed merchant,
        address token,
        BillingType billingType,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint128 totalSpendCap,
        uint64 periodDuration,
        uint64 validAfter,
        uint64 validUntil
    );

    /// Emitted when the payer tightens limits or shortens the validity window.
    /// Limits can only ever move in the payer's favour — see `restrict()`.
    event AuthorizationUpdated(
        bytes32 indexed authorizationId,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint128 totalSpendCap,
        uint64 validUntil
    );

    event AuthorizationRevoked(bytes32 indexed authorizationId, address indexed caller);

    /// Every movement of money in the protocol emits exactly this event.
    /// @param periodStart Start of the spend period the settlement landed in —
    ///        lets indexers bucket spend without replaying rollover logic.
    event Settled(
        bytes32 indexed authorizationId,
        address indexed module,
        address indexed executor,
        uint256 gross,
        uint256 merchantAmount,
        uint256 executorFee,
        uint256 protocolFee,
        uint64 periodStart
    );

    event ModuleStatusSet(address indexed module, ModuleStatus status);
    event FeeConfigSet(uint16 executorFeeBps, uint16 protocolFeeBps, uint256 protocolFlatFee);
    event FeeRecipientSet(address indexed feeRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ─── Payer surface ───────────────────────────────────────────────────────

    function authorize(AuthorizationParams calldata params)
        external
        returns (bytes32 authorizationId);

    function restrict(
        bytes32 authorizationId,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint128 totalSpendCap,
        uint64 validUntil
    ) external;

    function revoke(bytes32 authorizationId) external;

    // ─── Module surface ──────────────────────────────────────────────────────

    function settle(bytes32 authorizationId, uint256 amount, address executor)
        external
        returns (uint256 merchantAmount);

    // ─── Views ───────────────────────────────────────────────────────────────

    function getAuthorization(bytes32 authorizationId)
        external
        view
        returns (Authorization memory);

    /// @notice Spend remaining under each cap right now, after applying any
    ///         pending period rollover. Returns 0 for a cap that is not set.
    function remaining(bytes32 authorizationId)
        external
        view
        returns (uint256 perCharge, uint256 thisPeriod, uint256 lifetime);

    /// @notice Why `amount` would or would not settle right now. Lets executors
    ///         and UIs check eligibility without simulating a transaction.
    function canSettle(address module, bytes32 authorizationId, uint256 amount)
        external
        view
        returns (bool ok, bytes4 reason);

    function moduleStatus(address module) external view returns (ModuleStatus);

    function computeAuthorizationId(address payer, uint256 nonce)
        external
        view
        returns (bytes32);
}
