// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVirioMeteredBilling
/// @notice Usage-based billing settled from merchant-signed statements.
///
///         TRUST MODEL — read this before integrating.
///         Individual usage events (API calls, tokens, compute seconds) are
///         counted off-chain; putting them on-chain would cost more gas than the
///         usage is worth. To settle, the merchant signs an EIP-712 statement
///         asserting "this authorization used N units in this window".
///
///         That signature proves the merchant *attested* to the usage. It does
///         not prove the usage happened. This is not trustless usage
///         verification and must not be described as such. What protects the
///         payer is enforced on-chain, in the authorization registry:
///           * the unit price is fixed when the meter is created and cannot be
///             changed — repricing requires a new meter;
///           * per-settlement, per-period and lifetime spend caps;
///           * an expiry, and revocation at any time;
///           * a public, auditable record of every settlement.
///         A dishonest merchant can overstate usage up to those caps. It cannot
///         exceed them, invent a different price, or bill a revoked payer.
interface IVirioMeteredBilling {
    // ─── Errors ──────────────────────────────────────────────────────────────

    error ZeroAddress();
    error InvalidAmount();
    error InvalidPeriod();
    error InvalidUnit();
    error MeterNotActive(bytes32 meterId);
    error UnauthorizedMerchant(bytes32 meterId);
    /// The statement's meter and the authorization name different merchants.
    error MeterAuthorizationMismatch(bytes32 meterId, bytes32 authorizationId);
    /// The statement's token does not match the meter's token.
    error TokenMismatch(bytes32 meterId);
    /// statement.unitPrice is not the meter's immutable price.
    error UnitPriceMismatch(bytes32 meterId, uint128 expected, uint128 actual);
    /// statement.amount != statement.units * statement.unitPrice.
    error AmountMismatch(uint256 expected, uint256 actual);
    /// periodEnd is not after periodStart.
    error InvalidStatementWindow(uint64 periodStart, uint64 periodEnd);
    /// The statement covers time that has not happened yet.
    error StatementInFuture(uint64 periodEnd);
    /// The window starts before the last settled window ended — an overlap would
    /// bill the same usage twice.
    error StatementWindowOverlap(uint64 periodStart, uint64 lastSettledEnd);
    /// This merchant already used this nonce.
    error NonceAlreadyUsed(address merchant, uint256 nonce);
    /// The recovered signer is not the meter's merchant.
    error InvalidSignature(bytes32 meterId);

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @param unit Hash of the unit label ("api_request", "token", …). The label
    ///        itself is off-chain — storing free-form strings on-chain costs gas
    ///        for data no contract reads.
    event MeterCreated(
        bytes32 indexed meterId,
        address indexed merchant,
        address token,
        bytes32 unit,
        uint128 unitPrice,
        uint128 includedUnitsPerPeriod,
        uint64 settlementInterval
    );

    event MeterDisabled(bytes32 indexed meterId, address indexed merchant);

    /// @dev As with recurring billing, the fee split lives in the registry's
    ///      `Settled` event for the same transaction. This event carries the
    ///      usage arithmetic, so an indexer can show a payer exactly how an
    ///      amount was reached: units × unitPrice over [periodStart, periodEnd).
    event MeterSettlementExecuted(
        bytes32 indexed meterId,
        bytes32 indexed authorizationId,
        address indexed executor,
        uint128 units,
        uint128 unitPrice,
        uint128 amount,
        uint64 periodStart,
        uint64 periodEnd,
        uint256 nonce
    );

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct Meter {
        address merchant;
        uint64 settlementInterval; // advisory cadence; executors use it to schedule
        address token;
        /// @dev Immutable once created. A merchant changes price by creating a
        ///      new meter, so a payer's authorization can never be re-pointed at
        ///      a higher price behind their back.
        uint128 unitPrice;
        /// Units granted free each period — the "included" half of hybrid plans.
        /// Advisory on-chain: the merchant subtracts them before signing, and
        /// the payer can verify the arithmetic against this value.
        uint128 includedUnitsPerPeriod;
        bytes32 unit;
        bool active;
    }

    /// The merchant's signed assertion of usage. Hashed under EIP-712.
    struct MeterStatement {
        bytes32 meterId;
        bytes32 authorizationId;
        uint64 periodStart;
        uint64 periodEnd;
        uint128 units;
        uint128 unitPrice;
        uint128 amount;
        uint256 nonce;
    }

    // ─── Functions ───────────────────────────────────────────────────────────

    function createMeter(
        address token,
        bytes32 unit,
        uint128 unitPrice,
        uint128 includedUnitsPerPeriod,
        uint64 settlementInterval
    ) external returns (bytes32 meterId);

    function disableMeter(bytes32 meterId) external;

    function settle(MeterStatement calldata statement, bytes calldata signature) external;

    function getMeter(bytes32 meterId) external view returns (Meter memory);

    function hashStatement(MeterStatement calldata statement) external view returns (bytes32);

    function lastSettledEnd(bytes32 meterId, bytes32 authorizationId)
        external
        view
        returns (uint64);

    function isNonceUsed(address merchant, uint256 nonce) external view returns (bool);

    function settleable(MeterStatement calldata statement)
        external
        view
        returns (bool ok, bytes4 reason);
}
