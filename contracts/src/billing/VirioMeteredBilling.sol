// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// VirioMeteredBilling — billing module #2
//
// Usage is counted off-chain and settled on-chain in batches. The merchant
// signs an EIP-712 statement ("authorization X used N units between T0 and T1");
// anyone may submit it, and the authorization registry enforces the payer's
// caps before any money moves.
//
// See IVirioMeteredBilling for the trust model. Short version: the signature
// proves attestation, not usage. Payer protection is the fixed unit price plus
// the registry's caps, expiry and revocation.
//
// Key design invariants:
//   1. settle() is permissionless; the submitter earns the executor fee.
//   2. A statement is replayable at most once: the merchant's nonce is burned
//      and the meter/authorization watermark advances past periodEnd.
//   3. Windows may not overlap a settled window, and may not reach into the
//      future — both would bill usage the payer has not incurred.
//   4. amount is verified against units × unitPrice on-chain. The merchant
//      cannot sign an amount its own numbers do not produce.
//   5. unitPrice is fixed at meter creation. Repricing means a new meter, which
//      means a payer's existing authorization cannot be silently repriced.
//   6. Checks-Effects-Interactions: nonce and watermark are burned before
//      settle() calls out to the registry.
// ─────────────────────────────────────────────────────────────────────────────

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

import {IVirioAuthorizationRegistry} from "./interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioBillingModule} from "./interfaces/IVirioBillingModule.sol";
import {IVirioMeteredBilling} from "./interfaces/IVirioMeteredBilling.sol";

contract VirioMeteredBilling is IVirioMeteredBilling, IVirioBillingModule, EIP712 {
    // ─── EIP-712 ──────────────────────────────────────────────────────────────

    bytes32 private constant METER_STATEMENT_TYPEHASH = keccak256(
        "MeterStatement(bytes32 meterId,bytes32 authorizationId,uint64 periodStart,uint64 periodEnd,uint128 units,uint128 unitPrice,uint128 amount,uint256 nonce)"
    );

    // ─── Immutables ───────────────────────────────────────────────────────────

    IVirioAuthorizationRegistry public immutable REGISTRY;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @dev Per-merchant nonce counter for meter ids (not the statement nonce).
    mapping(address => uint256) public meterNonce;

    mapping(bytes32 => Meter) private _meters;

    /// @dev Burned statement nonces, scoped per merchant so two merchants can
    ///      number their statements independently.
    mapping(address => mapping(uint256 => bool)) private _usedNonce;

    /// @dev End of the last settled window per (meter, authorization). A new
    ///      statement must start at or after it, which is what makes
    ///      double-settling a window impossible even with a fresh nonce.
    mapping(bytes32 => mapping(bytes32 => uint64)) private _lastSettledEnd;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(IVirioAuthorizationRegistry registry_) EIP712("VirioMeteredBilling", "1") {
        if (address(registry_) == address(0)) revert ZeroAddress();
        REGISTRY = registry_;
    }

    function BILLING_TYPE() external pure returns (IVirioAuthorizationRegistry.BillingType) {
        return IVirioAuthorizationRegistry.BillingType.METERED;
    }

    function registry() external view returns (IVirioAuthorizationRegistry) {
        return REGISTRY;
    }

    // ─── Meters ───────────────────────────────────────────────────────────────

    /// @notice Publish a metered price. `unit` is a hash of the unit label
    ///         (e.g. keccak256("api_request")); the readable label is served
    ///         off-chain by the SDK and indexer.
    /// @param includedUnitsPerPeriod Units granted free each period — the
    ///        allowance half of a hybrid plan. 0 for pure pay-per-use.
    /// @param settlementInterval Cadence the merchant intends to settle on.
    ///        Advisory: executors schedule against it, nothing enforces it.
    function createMeter(
        address token,
        bytes32 unit,
        uint128 unitPrice,
        uint128 includedUnitsPerPeriod,
        uint64 settlementInterval
    ) external returns (bytes32 meterId) {
        if (token == address(0)) revert ZeroAddress();
        if (unit == bytes32(0)) revert InvalidUnit();
        if (unitPrice == 0) revert InvalidAmount();
        if (settlementInterval == 0) revert InvalidPeriod();

        uint256 nonce = ++meterNonce[msg.sender];
        meterId = keccak256(abi.encodePacked(msg.sender, nonce, block.chainid));

        _meters[meterId] = Meter({
            merchant: msg.sender,
            settlementInterval: settlementInterval,
            token: token,
            unitPrice: unitPrice,
            includedUnitsPerPeriod: includedUnitsPerPeriod,
            unit: unit,
            active: true
        });

        emit MeterCreated(
            meterId, msg.sender, token, unit, unitPrice, includedUnitsPerPeriod, settlementInterval
        );
    }

    /// @notice Retire a meter. Outstanding usage can no longer be settled
    ///         against it, so disable only after a final settlement.
    function disableMeter(bytes32 meterId) external {
        Meter storage meter = _meters[meterId];
        if (meter.merchant != msg.sender) revert UnauthorizedMerchant(meterId);
        if (!meter.active) revert MeterNotActive(meterId);

        meter.active = false;
        emit MeterDisabled(meterId, msg.sender);
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /// @notice Settle a merchant-signed usage statement. Permissionless — the
    ///         submitter earns the executor fee.
    function settle(MeterStatement calldata statement, bytes calldata signature) external {
        Meter storage meter = _meters[statement.meterId];

        // ── CHECKS ────────────────────────────────────────────────────────────
        if (!meter.active) revert MeterNotActive(statement.meterId);

        IVirioAuthorizationRegistry.Authorization memory auth =
            REGISTRY.getAuthorization(statement.authorizationId);
        // The registry re-checks the authorization's own state; here we only
        // check that this meter is entitled to bill it at all.
        if (auth.merchant != meter.merchant) {
            revert MeterAuthorizationMismatch(statement.meterId, statement.authorizationId);
        }
        if (auth.token != meter.token) revert TokenMismatch(statement.meterId);

        if (statement.unitPrice != meter.unitPrice) {
            revert UnitPriceMismatch(statement.meterId, meter.unitPrice, statement.unitPrice);
        }
        // Verified in uint256 so a product that would wrap uint128 is caught
        // here rather than silently truncating into a smaller charge.
        uint256 expectedAmount = uint256(statement.units) * uint256(statement.unitPrice);
        if (expectedAmount != statement.amount) {
            revert AmountMismatch(expectedAmount, statement.amount);
        }

        if (statement.periodEnd <= statement.periodStart) {
            revert InvalidStatementWindow(statement.periodStart, statement.periodEnd);
        }
        if (statement.periodEnd > block.timestamp) revert StatementInFuture(statement.periodEnd);

        // Nonce first: a resubmitted statement should say so, rather than report
        // the window overlap that its own earlier settlement created. The two
        // guards are independent — the nonce is per merchant, the watermark is
        // per (meter, authorization) — and both are load-bearing.
        if (_usedNonce[meter.merchant][statement.nonce]) {
            revert NonceAlreadyUsed(meter.merchant, statement.nonce);
        }

        uint64 watermark = _lastSettledEnd[statement.meterId][statement.authorizationId];
        if (statement.periodStart < watermark) {
            revert StatementWindowOverlap(statement.periodStart, watermark);
        }

        // SignatureChecker accepts an EOA signature or an ERC-1271 signature, so
        // a merchant may sign from a multisig. It rejects malleable (high-s)
        // signatures via OpenZeppelin's ECDSA, and we compare the signer to the
        // meter's merchant exactly — never merely "non-zero".
        if (!SignatureChecker.isValidSignatureNow(
            meter.merchant, _hashStatement(statement), signature
        )) {
            revert InvalidSignature(statement.meterId);
        }

        // ── EFFECTS ───────────────────────────────────────────────────────────
        // Burning both before the external call makes a re-entrant resubmission
        // of the same statement fail its own checks.
        _usedNonce[meter.merchant][statement.nonce] = true;
        _lastSettledEnd[statement.meterId][statement.authorizationId] = statement.periodEnd;

        // ── INTERACTIONS ──────────────────────────────────────────────────────
        REGISTRY.settle(statement.authorizationId, statement.amount, msg.sender);

        emit MeterSettlementExecuted(
            statement.meterId,
            statement.authorizationId,
            msg.sender,
            statement.units,
            statement.unitPrice,
            statement.amount,
            statement.periodStart,
            statement.periodEnd,
            statement.nonce
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getMeter(bytes32 meterId) external view returns (Meter memory) {
        return _meters[meterId];
    }

    /// @notice The EIP-712 digest a merchant signs for this statement.
    function hashStatement(MeterStatement calldata statement) external view returns (bytes32) {
        return _hashStatement(statement);
    }

    function lastSettledEnd(bytes32 meterId, bytes32 authorizationId)
        external
        view
        returns (uint64)
    {
        return _lastSettledEnd[meterId][authorizationId];
    }

    function isNonceUsed(address merchant, uint256 nonce) external view returns (bool) {
        return _usedNonce[merchant][nonce];
    }

    /// @notice Whether this statement would settle right now, ignoring the
    ///         signature (which the caller holds anyway). Lets an executor
    ///         filter a batch with eth_calls before spending gas.
    function settleable(MeterStatement calldata statement)
        external
        view
        returns (bool ok, bytes4 reason)
    {
        Meter storage meter = _meters[statement.meterId];
        if (!meter.active) return (false, MeterNotActive.selector);
        if (statement.unitPrice != meter.unitPrice) return (false, UnitPriceMismatch.selector);
        if (uint256(statement.units) * uint256(statement.unitPrice) != statement.amount) {
            return (false, AmountMismatch.selector);
        }
        if (statement.periodEnd <= statement.periodStart) {
            return (false, InvalidStatementWindow.selector);
        }
        if (statement.periodEnd > block.timestamp) return (false, StatementInFuture.selector);
        if (_usedNonce[meter.merchant][statement.nonce]) return (false, NonceAlreadyUsed.selector);
        if (statement.periodStart < _lastSettledEnd[statement.meterId][statement.authorizationId]) {
            return (false, StatementWindowOverlap.selector);
        }

        IVirioAuthorizationRegistry.Authorization memory auth =
            REGISTRY.getAuthorization(statement.authorizationId);
        if (auth.merchant != meter.merchant) return (false, MeterAuthorizationMismatch.selector);
        if (auth.token != meter.token) return (false, TokenMismatch.selector);

        return REGISTRY.canSettle(address(this), statement.authorizationId, statement.amount);
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    function _hashStatement(MeterStatement calldata statement) internal view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    METER_STATEMENT_TYPEHASH,
                    statement.meterId,
                    statement.authorizationId,
                    statement.periodStart,
                    statement.periodEnd,
                    statement.units,
                    statement.unitPrice,
                    statement.amount,
                    statement.nonce
                )
            )
        );
    }
}
