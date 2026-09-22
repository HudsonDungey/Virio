// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BillingTestBase} from "./BillingTestBase.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../../src/billing/interfaces/IVirioAuthorizationRegistry.sol";
import {VirioAuthorizationRegistry} from "../../src/billing/VirioAuthorizationRegistry.sol";
import {IVirioBillingModule} from "../../src/billing/interfaces/IVirioBillingModule.sol";

/// A billing module that settles whatever it is told, so registry tests can
/// exercise settle() directly without going through a real billing model.
contract PassthroughModule is IVirioBillingModule {
    IVirioAuthorizationRegistry_ internal immutable REG;
    IReg.BillingType internal immutable TYPE;

    constructor(address registry_, IReg.BillingType type_) {
        REG = IVirioAuthorizationRegistry_(registry_);
        TYPE = type_;
    }

    function BILLING_TYPE() external view returns (IReg.BillingType) {
        return TYPE;
    }

    function registry() external view returns (IReg) {
        return IReg(address(REG));
    }

    function pull(bytes32 authId, uint256 amount) external returns (uint256) {
        return REG.settle(authId, amount, msg.sender);
    }
}

interface IVirioAuthorizationRegistry_ {
    function settle(bytes32 authorizationId, uint256 amount, address executor)
        external
        returns (uint256);
}

/// Unit tests for the authorization layer: creation, limits, period rollover,
/// revocation, module gating and fee bounds.
contract VirioAuthorizationRegistryTest is BillingTestBase {
    PassthroughModule internal mod;

    function setUp() public override {
        super.setUp();
        mod = new PassthroughModule(address(reg), IReg.BillingType.RECURRING);
        vm.prank(OWNER);
        reg.setModuleStatus(address(mod), IReg.ModuleStatus.Active);
    }

    // ─── authorize ────────────────────────────────────────────────────────────

    function test_authorize_storesLimitsAndAnchorsPeriod() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 29e6, 348e6, MONTH);
        IReg.Authorization memory a = reg.getAuthorization(id);

        assertEq(a.payer, PAYER);
        assertEq(a.merchant, MERCHANT);
        assertEq(a.token, address(usdc));
        assertEq(uint8(a.billingType), uint8(IReg.BillingType.RECURRING));
        assertEq(a.maxPerCharge, 29e6);
        assertEq(a.periodSpendCap, 29e6);
        assertEq(a.totalSpendCap, 348e6);
        assertEq(a.periodDuration, MONTH);
        assertEq(a.periodStart, uint64(block.timestamp), "period anchors at validAfter");
        assertEq(a.validAfter, uint64(block.timestamp));
        assertEq(a.validUntil, 0);
        assertTrue(a.active);
        assertEq(a.spentThisPeriod, 0);
        assertEq(a.totalSpent, 0);
    }

    function test_authorize_idIsDeterministicAndChainScoped() public {
        bytes32 expected = reg.computeAuthorizationId(PAYER, 1);
        bytes32 id = _authorize(IReg.BillingType.METERED, 10e6, 0, 0, 0);
        assertEq(id, expected);
        assertEq(id, keccak256(abi.encodePacked(PAYER, uint256(1), block.chainid)));
    }

    function test_authorize_revertsWithoutPerChargeLimit() public {
        vm.expectRevert(IReg.InvalidAmount.selector);
        _authorize(IReg.BillingType.RECURRING, 0, 0, 0, MONTH);
    }

    function test_authorize_revertsOnPeriodCapWithoutPeriod() public {
        vm.expectRevert(IReg.InvalidPeriod.selector);
        _authorize(IReg.BillingType.RECURRING, 10e6, 100e6, 0, 0);
    }

    function test_authorize_revertsOnZeroMerchant() public {
        vm.prank(PAYER);
        vm.expectRevert(IReg.ZeroAddress.selector);
        reg.authorize(
            IReg.AuthorizationParams({
                merchant: address(0),
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: 0
            })
        );
    }

    function test_authorize_revertsOnExpiryInThePast() public {
        vm.prank(PAYER);
        vm.expectRevert(IReg.InvalidWindow.selector);
        reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: uint64(block.timestamp) - 1
            })
        );
    }

    // ─── settle: happy path and fee split ─────────────────────────────────────

    function test_settle_splitsAndMovesMoney() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, 0);
        (uint256 merchantAmt, uint256 execFee, uint256 protoFee) = _split(50e6);

        uint256 payerBefore = usdc.balanceOf(PAYER);

        vm.prank(EXECUTOR);
        mod.pull(id, 50e6);

        assertEq(usdc.balanceOf(PAYER), payerBefore - 50e6, "payer pays gross once");
        assertEq(usdc.balanceOf(MERCHANT), merchantAmt);
        assertEq(usdc.balanceOf(EXECUTOR), execFee);
        assertEq(usdc.balanceOf(FEE_RECIP), protoFee);
        assertEq(merchantAmt + execFee + protoFee, 50e6, "split is exact, nothing stranded");
        assertEq(usdc.balanceOf(address(reg)), 0, "registry never custodies");
    }

    function test_settle_emitsSettledWithPeriodStart() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, MONTH);
        (uint256 merchantAmt, uint256 execFee, uint256 protoFee) = _split(50e6);

        vm.expectEmit(true, true, true, true, address(reg));
        emit IReg.Settled(
            id, address(mod), EXECUTOR, 50e6, merchantAmt, execFee, protoFee, uint64(block.timestamp)
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 50e6);
    }

    function test_settle_accumulatesSpend() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, MONTH);
        vm.startPrank(EXECUTOR);
        mod.pull(id, 10e6);
        mod.pull(id, 15e6);
        vm.stopPrank();

        IReg.Authorization memory a = reg.getAuthorization(id);
        assertEq(a.spentThisPeriod, 25e6);
        assertEq(a.totalSpent, 25e6);
    }

    // ─── Limits ───────────────────────────────────────────────────────────────

    function test_settle_revertsAboveMaxPerCharge() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.expectRevert(
            abi.encodeWithSelector(IReg.MaxPerChargeExceeded.selector, id, 10e6 + 1, uint128(10e6))
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6 + 1);
    }

    function test_settle_allowsExactlyMaxPerCharge() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);
        assertEq(reg.getAuthorization(id).totalSpent, 10e6);
    }

    function test_settle_revertsOnPeriodCapBreach() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 30e6, 0, MONTH);
        vm.prank(EXECUTOR);
        mod.pull(id, 25e6);

        vm.expectRevert(
            abi.encodeWithSelector(IReg.PeriodSpendCapExceeded.selector, id, 31e6, uint128(30e6))
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 6e6);
    }

    function test_settle_allowsExactlyPeriodCap() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 30e6, 0, MONTH);
        vm.startPrank(EXECUTOR);
        mod.pull(id, 25e6);
        mod.pull(id, 5e6);
        vm.stopPrank();
        assertEq(reg.getAuthorization(id).spentThisPeriod, 30e6);
    }

    function test_settle_revertsOnLifetimeCapBreach() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 40e6, 0);
        vm.prank(EXECUTOR);
        mod.pull(id, 30e6);

        vm.expectRevert(
            abi.encodeWithSelector(IReg.TotalSpendCapExceeded.selector, id, 45e6, uint128(40e6))
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 15e6);
    }

    /// The lifetime cap must survive period rollovers — a payer who caps total
    /// spend has not agreed to pay that amount again next month.
    function test_settle_lifetimeCapSurvivesPeriodRollover() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 50e6, 60e6, MONTH);
        vm.prank(EXECUTOR);
        mod.pull(id, 50e6);

        vm.warp(block.timestamp + MONTH);
        vm.expectRevert(
            abi.encodeWithSelector(IReg.TotalSpendCapExceeded.selector, id, 70e6, uint128(60e6))
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 20e6);
    }

    // ─── Period rollover ──────────────────────────────────────────────────────

    function test_periodRollover_resetsSpendAtBoundary() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 30e6, 0, MONTH);
        uint64 t0 = uint64(block.timestamp);

        vm.prank(EXECUTOR);
        mod.pull(id, 30e6);

        // One second before the boundary the cap is still spent.
        vm.warp(t0 + MONTH - 1);
        vm.expectRevert();
        vm.prank(EXECUTOR);
        mod.pull(id, 1e6);

        // Exactly at the boundary the period rolls.
        vm.warp(t0 + MONTH);
        vm.prank(EXECUTOR);
        mod.pull(id, 30e6);

        IReg.Authorization memory a = reg.getAuthorization(id);
        assertEq(a.spentThisPeriod, 30e6, "new period starts from zero");
        assertEq(a.totalSpent, 60e6, "lifetime keeps counting");
        assertEq(a.periodStart, t0 + MONTH);
    }

    /// Rollover is additive and O(1): an authorization dormant for years lands
    /// on the original period grid, not on the time it happened to be used.
    function test_periodRollover_isAdditiveAfterLongGap() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 30e6, 0, MONTH);
        uint64 t0 = uint64(block.timestamp);

        vm.prank(EXECUTOR);
        mod.pull(id, 30e6);

        vm.warp(t0 + 100 * uint256(MONTH) + 12 hours);
        vm.prank(EXECUTOR);
        mod.pull(id, 30e6);

        assertEq(
            reg.getAuthorization(id).periodStart,
            t0 + 100 * MONTH,
            "period grid never drifts off its anchor"
        );
    }

    function test_remaining_reportsHeadroom() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 50e6, 100e6, MONTH);
        vm.prank(EXECUTOR);
        mod.pull(id, 20e6);

        (uint256 perCharge, uint256 thisPeriod, uint256 lifetime) = reg.remaining(id);
        assertEq(perCharge, 29e6);
        assertEq(thisPeriod, 30e6);
        assertEq(lifetime, 80e6);

        // After the boundary the period headroom is full again.
        vm.warp(block.timestamp + MONTH);
        (, thisPeriod, lifetime) = reg.remaining(id);
        assertEq(thisPeriod, 50e6);
        assertEq(lifetime, 80e6);
    }

    function test_remaining_uncappedReportsMax() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 0, 0, 0);
        (, uint256 thisPeriod, uint256 lifetime) = reg.remaining(id);
        assertEq(thisPeriod, type(uint256).max);
        assertEq(lifetime, type(uint256).max);
    }

    // ─── Validity window ──────────────────────────────────────────────────────

    function test_settle_revertsBeforeValidAfter() public {
        uint64 start = uint64(block.timestamp) + 1 days;
        vm.prank(PAYER);
        bytes32 id = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: start,
                validUntil: 0
            })
        );

        vm.expectRevert(
            abi.encodeWithSelector(IReg.AuthorizationNotYetValid.selector, id, start)
        );
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);

        vm.warp(start);
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);
    }

    function test_settle_revertsAtAndAfterExpiry() public {
        uint64 end = uint64(block.timestamp) + 30 days;
        vm.prank(PAYER);
        bytes32 id = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: end
            })
        );

        // Valid right up to the last second.
        vm.warp(end - 1);
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);

        // validUntil is exclusive.
        vm.warp(end);
        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationExpired.selector, id, end));
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);
    }

    // ─── Revocation and restriction ───────────────────────────────────────────

    function test_revoke_byPayerStopsSettlement() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.prank(PAYER);
        reg.revoke(id);

        assertFalse(reg.getAuthorization(id).active);
        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, id));
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);
    }

    function test_revoke_byMerchant() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.prank(MERCHANT);
        reg.revoke(id);
        assertFalse(reg.getAuthorization(id).active);
    }

    function test_revoke_revertsForStranger() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(IReg.NotAuthorizationParty.selector, id));
        vm.prank(STRANGER);
        reg.revoke(id);
    }

    function test_revoke_isNotReversible() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.startPrank(PAYER);
        reg.revoke(id);
        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, id));
        reg.revoke(id);
        vm.stopPrank();
    }

    function test_restrict_tightensLimits() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 100e6, 500e6, MONTH);
        vm.prank(PAYER);
        reg.restrict(id, 10e6, 50e6, 200e6, uint64(block.timestamp) + 10 days);

        IReg.Authorization memory a = reg.getAuthorization(id);
        assertEq(a.maxPerCharge, 10e6);
        assertEq(a.periodSpendCap, 50e6);
        assertEq(a.totalSpendCap, 200e6);
        assertEq(a.validUntil, uint64(block.timestamp) + 10 days);
    }

    function test_restrict_cannotRaiseAnyLimit() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 100e6, 500e6, MONTH);
        vm.startPrank(PAYER);
        vm.expectRevert(IReg.InvalidAmount.selector);
        reg.restrict(id, 30e6, 0, 0, 0);
        vm.expectRevert(IReg.InvalidAmount.selector);
        reg.restrict(id, 0, 101e6, 0, 0);
        vm.expectRevert(IReg.InvalidAmount.selector);
        reg.restrict(id, 0, 0, 501e6, 0);
        vm.stopPrank();
    }

    function test_restrict_cannotExtendExpiry() public {
        uint64 end = uint64(block.timestamp) + 10 days;
        vm.prank(PAYER);
        bytes32 id = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: end
            })
        );

        vm.expectRevert(IReg.InvalidWindow.selector);
        vm.prank(PAYER);
        reg.restrict(id, 0, 0, 0, end + 1 days);
    }

    function test_restrict_revertsForMerchant() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 29e6, 0, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(IReg.NotAuthorizationParty.selector, id));
        vm.prank(MERCHANT);
        reg.restrict(id, 1e6, 0, 0, 0);
    }

    // ─── Module gating ────────────────────────────────────────────────────────

    function test_settle_revertsForUnregisteredModule() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        PassthroughModule rogue = new PassthroughModule(address(reg), IReg.BillingType.RECURRING);

        vm.expectRevert(abi.encodeWithSelector(IReg.ModuleNotActive.selector, address(rogue)));
        vm.prank(EXECUTOR);
        rogue.pull(id, 10e6);
    }

    function test_settle_revertsWhenModulePaused() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.prank(OWNER);
        reg.setModuleStatus(address(mod), IReg.ModuleStatus.Paused);

        vm.expectRevert(abi.encodeWithSelector(IReg.ModuleNotActive.selector, address(mod)));
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);

        // Pausing one module leaves every other module settling normally.
        assertEq(
            uint8(reg.moduleStatus(address(recurring))), uint8(IReg.ModuleStatus.Active)
        );
    }

    function test_settle_revertsOnBillingTypeMismatch() public {
        bytes32 meteredAuth = _authorize(IReg.BillingType.METERED, 10e6, 0, 0, 0);
        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.IncompatibleBillingType.selector, address(mod), IReg.BillingType.METERED
            )
        );
        vm.prank(EXECUTOR);
        mod.pull(meteredAuth, 10e6);
    }

    function test_settle_hybridAuthorizationAcceptsEitherModule() public {
        bytes32 id = _authorize(IReg.BillingType.HYBRID, 10e6, 0, 0, 0);
        PassthroughModule meteredMod =
            new PassthroughModule(address(reg), IReg.BillingType.METERED);
        vm.prank(OWNER);
        reg.setModuleStatus(address(meteredMod), IReg.ModuleStatus.Active);

        vm.startPrank(EXECUTOR);
        mod.pull(id, 5e6);
        meteredMod.pull(id, 5e6);
        vm.stopPrank();

        assertEq(reg.getAuthorization(id).totalSpent, 10e6, "both modules share one budget");
    }

    function test_setModuleStatus_revertsForNonOwner() public {
        vm.expectRevert(IReg.NotOwner.selector);
        vm.prank(STRANGER);
        reg.setModuleStatus(address(mod), IReg.ModuleStatus.Disabled);
    }

    // ─── canSettle ────────────────────────────────────────────────────────────

    function test_canSettle_mirrorsSettleDecisions() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 15e6, 0, MONTH);

        (bool ok, bytes4 reason) = reg.canSettle(address(mod), id, 10e6);
        assertTrue(ok);
        assertEq(reason, bytes4(0));

        (ok, reason) = reg.canSettle(address(mod), id, 11e6);
        assertFalse(ok);
        assertEq(reason, IReg.MaxPerChargeExceeded.selector);

        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);

        (ok, reason) = reg.canSettle(address(mod), id, 10e6);
        assertFalse(ok);
        assertEq(reason, IReg.PeriodSpendCapExceeded.selector);

        vm.prank(PAYER);
        reg.revoke(id);
        (ok, reason) = reg.canSettle(address(mod), id, 1e6);
        assertFalse(ok);
        assertEq(reason, IReg.AuthorizationNotActive.selector);
    }

    function test_canSettle_rejectsAmountBelowFees() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, 0);
        // Flat fee alone is 1 USDC; a 0.5 USDC settlement leaves nothing over.
        (bool ok, bytes4 reason) = reg.canSettle(address(mod), id, 5e5);
        assertFalse(ok);
        assertEq(reason, IReg.InvalidAmount.selector);
    }

    function test_settle_revertsWhenAmountBelowFees() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, 0);
        vm.expectRevert(IReg.InvalidAmount.selector);
        vm.prank(EXECUTOR);
        mod.pull(id, 5e5);
    }

    // ─── Fees: bounded, and never a seizure path ──────────────────────────────

    function test_setFeeConfig_rejectsFeesAboveCap() public {
        vm.startPrank(OWNER);
        vm.expectRevert(IReg.InvalidFeeConfiguration.selector);
        reg.setFeeConfig(400, 200, 0); // 6% total > MAX_TOTAL_FEE_BPS
        vm.expectRevert(IReg.InvalidFeeConfiguration.selector);
        reg.setFeeConfig(10, 25, 11e6); // flat fee above MAX_PROTOCOL_FLAT_FEE
        vm.stopPrank();
    }

    function test_setFeeConfig_atCapSucceeds() public {
        vm.prank(OWNER);
        reg.setFeeConfig(100, 400, 10e6);
        assertEq(reg.executorFeeBps(), 100);
        assertEq(reg.protocolFeeBps(), 400);
        assertEq(reg.protocolFlatFee(), 10e6);
    }

    function test_setFeeConfig_revertsForNonOwner() public {
        vm.expectRevert(IReg.NotOwner.selector);
        vm.prank(STRANGER);
        reg.setFeeConfig(0, 0, 0);
    }

    /// The owner has no function that moves a payer's tokens. Pausing every
    /// module stops settlement; it does not redirect it.
    function test_owner_cannotSettleDirectly() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.expectRevert(abi.encodeWithSelector(IReg.ModuleNotActive.selector, OWNER));
        vm.prank(OWNER);
        reg.settle(id, 10e6, OWNER);
    }

    function test_transferOwnership() public {
        vm.prank(OWNER);
        reg.transferOwnership(STRANGER);
        assertEq(reg.owner(), STRANGER);

        vm.expectRevert(IReg.NotOwner.selector);
        vm.prank(OWNER);
        reg.setFeeRecipient(OWNER);
    }

    // ─── Token failure modes ──────────────────────────────────────────────────

    function test_settle_revertsWhenAllowanceRevoked() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.prank(PAYER);
        usdc.approve(address(reg), 0);

        vm.expectRevert();
        vm.prank(EXECUTOR);
        mod.pull(id, 10e6);
    }

    function test_settle_revertsOnInsufficientBalance() public {
        bytes32 id = _authorize(IReg.BillingType.RECURRING, 100e6, 0, 0, 0);
        uint256 balance = usdc.balanceOf(PAYER);
        vm.prank(PAYER);
        usdc.transfer(STRANGER, balance);

        vm.expectRevert();
        vm.prank(EXECUTOR);
        mod.pull(id, 100e6);
    }

    // ─── Accounting invariant ─────────────────────────────────────────────────

    /// For any sequence of settlements, spend never exceeds the caps the payer
    /// set. Fuzzed over amounts and gaps so period rollovers are exercised too.
    function testFuzz_spendNeverExceedsCaps(uint128[8] memory amounts, uint32[8] memory gaps)
        public
    {
        uint128 perCharge = 25e6;
        uint128 periodCap = 60e6;
        uint128 totalCap = 150e6;
        bytes32 id = _authorize(IReg.BillingType.RECURRING, perCharge, periodCap, totalCap, DAY);

        for (uint256 i = 0; i < amounts.length; i++) {
            vm.warp(block.timestamp + bound(gaps[i], 0, 3 days));
            uint256 amount = bound(amounts[i], 2e6, 40e6);

            vm.prank(EXECUTOR);
            try mod.pull(id, amount) {} catch {}

            IReg.Authorization memory a = reg.getAuthorization(id);
            assertLe(a.spentThisPeriod, periodCap, "periodSettled <= periodSpendCap");
            assertLe(a.totalSpent, totalCap, "totalSettled <= totalSpendCap");
        }
    }
}
