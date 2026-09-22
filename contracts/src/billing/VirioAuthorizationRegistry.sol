// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// VirioAuthorizationRegistry
//
// The single point where Virio money moves.
//
// Billing modules (recurring, metered) decide *what is owed*. This contract
// decides *what may be charged* and performs the transfer. Every settlement in
// the protocol — whatever the billing model — funnels through settle().
//
// Key design invariants:
//   1. A module can never collect more than the payer authorized. Caps are
//      re-checked here, from this contract's own storage, on every settlement.
//   2. Checks-Effects-Interactions: all authorization state is written before
//      any token call, behind a nonReentrant guard.
//   3. periodStart advances additively (periodStart += n * periodDuration), so
//      a late settlement never shifts the payer's spend-period grid.
//   4. Limits set by the payer only ever move in the payer's favour after
//      creation — restrict() cannot raise a cap or extend an expiry.
//   5. Only the payer or the merchant may revoke; neither may raise limits.
//   6. Protocol fees are bounded by MAX_TOTAL_FEE_BPS and the owner has no
//      path to move a payer's funds. Emergency control is limited to pausing
//      modules, which stops settlement rather than redirecting it.
//   7. authorizationId = keccak256(payer ‖ nonce ‖ chainid) — deterministic and
//      not replayable across chains.
//   8. Money is uint128 so the settlement hot path writes a single slot.
// ─────────────────────────────────────────────────────────────────────────────

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IVirioAuthorizationRegistry} from "./interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioBillingModule} from "./interfaces/IVirioBillingModule.sol";

contract VirioAuthorizationRegistry is IVirioAuthorizationRegistry, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @dev Hard ceiling on executorFeeBps + protocolFeeBps. The legacy
    ///      VirioSubscriptionManager let the owner set either fee to 100%, which
    ///      made "the owner cannot take user funds" false in the limit. 5% is
    ///      well above the protocol's 0.35% default and bounds the damage an
    ///      owner-key compromise can do to a payer who has already authorized.
    uint16 public constant MAX_TOTAL_FEE_BPS = 500;

    /// @dev Ceiling on the flat per-settlement fee, in the token's smallest
    ///      unit. 10 USDC at 6 decimals. Bounds the same attack for the flat leg.
    uint256 public constant MAX_PROTOCOL_FLAT_FEE = 10e6;

    // ─── Fee configuration ────────────────────────────────────────────────────
    // Defaults match the deployed VirioSubscriptionManager so recurring billing
    // costs the same before and after migration.

    uint16 public executorFeeBps = 10; // 0.1% — paid to whoever submits the tx
    uint16 public protocolFeeBps = 25; // 0.25%
    uint256 public protocolFlatFee = 1e6; // 1 USDC (6 decimals)

    // ─── State ────────────────────────────────────────────────────────────────

    address public owner;
    address public feeRecipient;

    /// @dev Per-payer nonce; makes authorization ids unique without a global counter.
    mapping(address => uint256) public authorizationNonce;

    mapping(bytes32 => Authorization) private _authorizations;
    mapping(address => ModuleStatus) private _moduleStatus;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _feeRecipient) {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        emit OwnershipTransferred(address(0), msg.sender);
        emit FeeRecipientSet(_feeRecipient);
    }

    // ─── Payer surface ────────────────────────────────────────────────────────

    /// @notice Grant a merchant permission to pull payments within fixed limits.
    ///         Creating an authorization moves no money and grants no allowance —
    ///         the payer must also approve this contract on the ERC-20.
    function authorize(AuthorizationParams calldata params)
        external
        returns (bytes32 authorizationId)
    {
        if (params.merchant == address(0) || params.token == address(0)) revert ZeroAddress();
        // maxPerCharge is mandatory: there is no such thing as an unbounded charge.
        if (params.maxPerCharge == 0) revert InvalidAmount();
        // A period cap is meaningless without a period to measure it over.
        if (params.periodSpendCap != 0 && params.periodDuration == 0) revert InvalidPeriod();
        if (params.validUntil != 0 && params.validUntil <= params.validAfter) revert InvalidWindow();

        uint64 validAfter = params.validAfter == 0 ? uint64(block.timestamp) : params.validAfter;
        if (params.validUntil != 0 && params.validUntil <= block.timestamp) revert InvalidWindow();

        uint256 nonce = ++authorizationNonce[msg.sender];
        authorizationId = _computeId(msg.sender, nonce);

        _authorizations[authorizationId] = Authorization({
            payer: msg.sender,
            billingType: params.billingType,
            active: true,
            periodDuration: params.periodDuration,
            merchant: params.merchant,
            periodStart: validAfter,
            token: params.token,
            validAfter: validAfter,
            validUntil: params.validUntil,
            maxPerCharge: params.maxPerCharge,
            periodSpendCap: params.periodSpendCap,
            totalSpendCap: params.totalSpendCap,
            spentThisPeriod: 0,
            totalSpent: 0
        });

        emit AuthorizationCreated(
            authorizationId,
            msg.sender,
            params.merchant,
            params.token,
            params.billingType,
            params.maxPerCharge,
            params.periodSpendCap,
            params.totalSpendCap,
            params.periodDuration,
            validAfter,
            params.validUntil
        );
    }

    /// @notice Tighten an authorization. Only the payer may call, and every
    ///         argument must be at least as restrictive as the current value —
    ///         a merchant can never end up with more room than it started with.
    ///         Pass 0 for a cap to leave it unchanged.
    function restrict(
        bytes32 authorizationId,
        uint128 maxPerCharge,
        uint128 periodSpendCap,
        uint128 totalSpendCap,
        uint64 validUntil
    ) external {
        Authorization storage auth = _authorizations[authorizationId];
        if (!auth.active) revert AuthorizationNotActive(authorizationId);
        if (msg.sender != auth.payer) revert NotAuthorizationParty(authorizationId);

        if (maxPerCharge != 0) {
            if (maxPerCharge > auth.maxPerCharge) revert InvalidAmount();
            auth.maxPerCharge = maxPerCharge;
        }
        if (periodSpendCap != 0) {
            // An existing cap of 0 means "uncapped", so any finite cap tightens it.
            if (auth.periodSpendCap != 0 && periodSpendCap > auth.periodSpendCap) {
                revert InvalidAmount();
            }
            if (auth.periodDuration == 0) revert InvalidPeriod();
            auth.periodSpendCap = periodSpendCap;
        }
        if (totalSpendCap != 0) {
            if (auth.totalSpendCap != 0 && totalSpendCap > auth.totalSpendCap) {
                revert InvalidAmount();
            }
            auth.totalSpendCap = totalSpendCap;
        }
        if (validUntil != 0) {
            if (auth.validUntil != 0 && validUntil > auth.validUntil) revert InvalidWindow();
            if (validUntil <= block.timestamp) revert InvalidWindow();
            auth.validUntil = validUntil;
        }

        emit AuthorizationUpdated(
            authorizationId,
            auth.maxPerCharge,
            auth.periodSpendCap,
            auth.totalSpendCap,
            auth.validUntil
        );
    }

    /// @notice Permanently revoke an authorization. Callable by the payer or the
    ///         merchant, mirroring the legacy manager's cancel(). Irreversible:
    ///         resuming requires a fresh authorize(), which re-prompts the payer.
    function revoke(bytes32 authorizationId) external {
        Authorization storage auth = _authorizations[authorizationId];
        if (!auth.active) revert AuthorizationNotActive(authorizationId);
        if (msg.sender != auth.payer && msg.sender != auth.merchant) {
            revert NotAuthorizationParty(authorizationId);
        }

        auth.active = false;
        emit AuthorizationRevoked(authorizationId, msg.sender);
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /// @notice Move `amount` of the authorization's token from payer to merchant,
    ///         minus protocol and executor fees. Callable only by an active
    ///         billing module whose billing type the authorization accepts.
    /// @param executor Address credited with the executor fee — the module passes
    ///        through its own caller. Modules are owner-registered, so this is a
    ///        trusted hand-off; an untrusted module is never Active.
    /// @return merchantAmount Net amount delivered to the merchant.
    function settle(bytes32 authorizationId, uint256 amount, address executor)
        external
        nonReentrant
        returns (uint256 merchantAmount)
    {
        // ── CHECKS ────────────────────────────────────────────────────────────
        if (_moduleStatus[msg.sender] != ModuleStatus.Active) revert ModuleNotActive(msg.sender);

        Authorization storage auth = _authorizations[authorizationId];
        if (!auth.active) revert AuthorizationNotActive(authorizationId);
        if (!_compatible(auth.billingType, IVirioBillingModule(msg.sender).BILLING_TYPE())) {
            revert IncompatibleBillingType(msg.sender, auth.billingType);
        }

        if (block.timestamp < auth.validAfter) {
            revert AuthorizationNotYetValid(authorizationId, auth.validAfter);
        }
        if (auth.validUntil != 0 && block.timestamp >= auth.validUntil) {
            revert AuthorizationExpired(authorizationId, auth.validUntil);
        }
        if (amount == 0) revert InvalidAmount();
        if (amount > auth.maxPerCharge) {
            revert MaxPerChargeExceeded(authorizationId, amount, auth.maxPerCharge);
        }

        // Roll the spend period forward before measuring against the period cap.
        uint64 periodStart = _rolledPeriodStart(auth);
        uint128 spentThisPeriod = periodStart == auth.periodStart ? auth.spentThisPeriod : 0;

        uint256 periodSpend = uint256(spentThisPeriod) + amount;
        if (auth.periodSpendCap != 0 && periodSpend > auth.periodSpendCap) {
            revert PeriodSpendCapExceeded(authorizationId, periodSpend, auth.periodSpendCap);
        }
        uint256 lifetimeSpend = uint256(auth.totalSpent) + amount;
        if (auth.totalSpendCap != 0 && lifetimeSpend > auth.totalSpendCap) {
            revert TotalSpendCapExceeded(authorizationId, lifetimeSpend, auth.totalSpendCap);
        }

        // ── EFFECTS (every write lands before the first token call) ────────────
        if (periodStart != auth.periodStart) auth.periodStart = periodStart;
        auth.spentThisPeriod = uint128(periodSpend);
        auth.totalSpent = uint128(lifetimeSpend);

        address payer = auth.payer;
        address merchant = auth.merchant;
        address token = auth.token;

        uint256 executorFee = (amount * executorFeeBps) / 10_000;
        uint256 protocolFee = (amount * protocolFeeBps) / 10_000 + protocolFlatFee;
        // A settlement that cannot pay the merchant anything is not a settlement.
        if (amount <= executorFee + protocolFee) revert InvalidAmount();
        merchantAmount = amount - executorFee - protocolFee;

        // ── INTERACTIONS ──────────────────────────────────────────────────────
        // Direct payer → recipient transfers; the registry never holds a balance.
        IERC20(token).safeTransferFrom(payer, merchant, merchantAmount);
        if (executorFee > 0) IERC20(token).safeTransferFrom(payer, executor, executorFee);
        if (protocolFee > 0) IERC20(token).safeTransferFrom(payer, feeRecipient, protocolFee);

        emit Settled(
            authorizationId,
            msg.sender,
            executor,
            amount,
            merchantAmount,
            executorFee,
            protocolFee,
            periodStart
        );
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function getAuthorization(bytes32 authorizationId)
        external
        view
        returns (Authorization memory)
    {
        return _authorizations[authorizationId];
    }

    /// @notice Headroom under each cap as of now. A cap that is not set reports
    ///         type(uint256).max rather than 0, so callers can `min()` the three.
    function remaining(bytes32 authorizationId)
        external
        view
        returns (uint256 perCharge, uint256 thisPeriod, uint256 lifetime)
    {
        Authorization storage auth = _authorizations[authorizationId];
        perCharge = auth.maxPerCharge;

        uint128 spent = _rolledPeriodStart(auth) == auth.periodStart ? auth.spentThisPeriod : 0;
        thisPeriod = auth.periodSpendCap == 0
            ? type(uint256).max
            : auth.periodSpendCap - _min(spent, auth.periodSpendCap);
        lifetime = auth.totalSpendCap == 0
            ? type(uint256).max
            : auth.totalSpendCap - _min(auth.totalSpent, auth.totalSpendCap);
    }

    /// @notice Non-reverting eligibility check mirroring settle()'s CHECKS block.
    ///         `reason` is the selector of the error settle() would revert with,
    ///         so an executor can log exactly why it skipped a candidate.
    function canSettle(address module, bytes32 authorizationId, uint256 amount)
        external
        view
        returns (bool ok, bytes4 reason)
    {
        if (_moduleStatus[module] != ModuleStatus.Active) {
            return (false, ModuleNotActive.selector);
        }

        Authorization storage auth = _authorizations[authorizationId];
        if (!auth.active) return (false, AuthorizationNotActive.selector);
        if (!_compatible(auth.billingType, IVirioBillingModule(module).BILLING_TYPE())) {
            return (false, IncompatibleBillingType.selector);
        }
        if (block.timestamp < auth.validAfter) {
            return (false, AuthorizationNotYetValid.selector);
        }
        if (auth.validUntil != 0 && block.timestamp >= auth.validUntil) {
            return (false, AuthorizationExpired.selector);
        }
        if (amount == 0) return (false, InvalidAmount.selector);
        if (amount > auth.maxPerCharge) return (false, MaxPerChargeExceeded.selector);

        uint128 spent = _rolledPeriodStart(auth) == auth.periodStart ? auth.spentThisPeriod : 0;
        if (auth.periodSpendCap != 0 && uint256(spent) + amount > auth.periodSpendCap) {
            return (false, PeriodSpendCapExceeded.selector);
        }
        if (auth.totalSpendCap != 0 && uint256(auth.totalSpent) + amount > auth.totalSpendCap) {
            return (false, TotalSpendCapExceeded.selector);
        }

        uint256 fees = (amount * executorFeeBps) / 10_000
            + (amount * protocolFeeBps) / 10_000
            + protocolFlatFee;
        if (amount <= fees) return (false, InvalidAmount.selector);

        return (true, bytes4(0));
    }

    function moduleStatus(address module) external view returns (ModuleStatus) {
        return _moduleStatus[module];
    }

    /// @notice The id `authorize()` would produce for a (payer, nonce) pair.
    function computeAuthorizationId(address payer, uint256 nonce)
        external
        view
        returns (bytes32)
    {
        return _computeId(payer, nonce);
    }

    // ─── Owner: module registry and fees ──────────────────────────────────────

    /// @notice Register, pause, or retire a billing module.
    ///         Pausing a module stops it settling without touching any payer's
    ///         authorization — the granular emergency control. There is no global
    ///         switch, and no owner action can redirect or seize payer funds.
    function setModuleStatus(address module, ModuleStatus status) external onlyOwner {
        if (module == address(0)) revert ZeroAddress();
        _moduleStatus[module] = status;
        emit ModuleStatusSet(module, status);
    }

    function setFeeConfig(uint16 _executorFeeBps, uint16 _protocolFeeBps, uint256 _protocolFlatFee)
        external
        onlyOwner
    {
        if (uint256(_executorFeeBps) + _protocolFeeBps > MAX_TOTAL_FEE_BPS) {
            revert InvalidFeeConfiguration();
        }
        if (_protocolFlatFee > MAX_PROTOCOL_FLAT_FEE) revert InvalidFeeConfiguration();
        executorFeeBps = _executorFeeBps;
        protocolFeeBps = _protocolFeeBps;
        protocolFlatFee = _protocolFlatFee;
        emit FeeConfigSet(_executorFeeBps, _protocolFeeBps, _protocolFlatFee);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert ZeroAddress();
        feeRecipient = newRecipient;
        emit FeeRecipientSet(newRecipient);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    /// @dev A HYBRID authorization shares one set of caps between a recurring
    ///      base charge and metered usage, so it accepts either module. A
    ///      single-model authorization accepts only its own module type.
    function _compatible(BillingType authType, BillingType moduleType)
        internal
        pure
        returns (bool)
    {
        return authType == BillingType.HYBRID || authType == moduleType;
    }

    /// @dev Where the current spend period starts, advancing by whole periods
    ///      only. Additive so the grid never drifts, and O(1) rather than a loop
    ///      so an authorization dormant for years still settles in constant gas.
    function _rolledPeriodStart(Authorization storage auth) internal view returns (uint64) {
        uint64 duration = auth.periodDuration;
        uint64 start = auth.periodStart;
        // uint256 arithmetic: a payer-supplied duration near uint64 max must not
        // make this view revert.
        if (duration == 0 || block.timestamp < uint256(start) + duration) return start;
        uint64 elapsed = uint64(block.timestamp) - start;
        return start + (elapsed / duration) * duration;
    }

    function _computeId(address payer, uint256 nonce) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(payer, nonce, block.chainid));
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
}
