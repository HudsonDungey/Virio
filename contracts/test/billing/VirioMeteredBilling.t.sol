// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BillingTestBase} from "./BillingTestBase.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../../src/billing/interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioMeteredBilling as IMet} from
    "../../src/billing/interfaces/IVirioMeteredBilling.sol";

/// Metered billing tests. The attack surface here is the merchant-signed
/// statement, so most of this file is about what a forged, replayed, or
/// re-shaped statement must not be able to do.
contract VirioMeteredBillingTest is BillingTestBase {
    bytes32 internal constant UNIT = keccak256("api_request");
    uint128 internal constant UNIT_PRICE = 2000; // $0.002 at 6 decimals

    bytes32 internal meterId;
    bytes32 internal authId;

    /// @dev Tests carry an explicit time cursor rather than re-reading
    ///      block.timestamp after vm.warp: solc treats TIMESTAMP as invariant
    ///      within a call frame and may cache it across the cheatcode, which
    ///      silently produces statements for the wrong window.
    uint64 internal constant T0 = 1_800_000_000;
    uint64 internal windowStart;

    function setUp() public override {
        super.setUp();
        vm.prank(MERCHANT);
        meterId = metered.createMeter(address(usdc), UNIT, UNIT_PRICE, 0, DAY);

        // $10 per settlement, $100 per month, as in the product example.
        authId = _authorize(IReg.BillingType.METERED, 10e6, 100e6, 0, MONTH);
        windowStart = T0;
    }

    function _settleUsage(uint128 units, uint64 start, uint64 end, uint256 nonce) internal {
        IMet.MeterStatement memory st =
            _statement(meterId, authId, start, end, units, UNIT_PRICE, nonce);
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    // ─── Meters ───────────────────────────────────────────────────────────────

    function test_createMeter_storesPricing() public view {
        IMet.Meter memory m = metered.getMeter(meterId);
        assertEq(m.merchant, MERCHANT);
        assertEq(m.token, address(usdc));
        assertEq(m.unit, UNIT);
        assertEq(m.unitPrice, UNIT_PRICE);
        assertEq(m.settlementInterval, DAY);
        assertTrue(m.active);
    }

    function test_createMeter_rejectsInvalidArguments() public {
        vm.startPrank(MERCHANT);
        vm.expectRevert(IMet.ZeroAddress.selector);
        metered.createMeter(address(0), UNIT, UNIT_PRICE, 0, DAY);
        vm.expectRevert(IMet.InvalidUnit.selector);
        metered.createMeter(address(usdc), bytes32(0), UNIT_PRICE, 0, DAY);
        vm.expectRevert(IMet.InvalidAmount.selector);
        metered.createMeter(address(usdc), UNIT, 0, 0, DAY);
        vm.expectRevert(IMet.InvalidPeriod.selector);
        metered.createMeter(address(usdc), UNIT, UNIT_PRICE, 0, 0);
        vm.stopPrank();
    }

    function test_disableMeter_blocksSettlement() public {
        vm.prank(MERCHANT);
        metered.disableMeter(meterId);

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(abi.encodeWithSelector(IMet.MeterNotActive.selector, meterId));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_disableMeter_revertsForStranger() public {
        vm.expectRevert(abi.encodeWithSelector(IMet.UnauthorizedMerchant.selector, meterId));
        vm.prank(STRANGER);
        metered.disableMeter(meterId);
    }

    // ─── Happy path ───────────────────────────────────────────────────────────

    /// The worked example from the product spec: 1,827 requests at $0.002 is
    /// $3.654, and the payer can verify that arithmetic from the event alone.
    function test_settle_billsUnitsTimesPrice() public {
        vm.warp(T0 + DAY);
        uint64 end = T0 + DAY;
        uint128 amount = 1827 * UNIT_PRICE;
        assertEq(amount, 3_654_000, "1,827 x $0.002 = $3.654");

        (uint256 merchantAmt, uint256 execFee, uint256 protoFee) = _split(amount);

        vm.expectEmit(true, true, true, true, address(metered));
        emit IMet.MeterSettlementExecuted(
            meterId, authId, EXECUTOR, 1827, UNIT_PRICE, amount, windowStart, end, 1
        );
        _settleUsage(1827, windowStart, end, 1);

        assertEq(usdc.balanceOf(MERCHANT), merchantAmt);
        assertEq(usdc.balanceOf(EXECUTOR), execFee);
        assertEq(usdc.balanceOf(FEE_RECIP), protoFee);
        assertEq(reg.getAuthorization(authId).totalSpent, amount);
    }

    function test_settle_multipleWindowsAccumulate() public {
        uint64 cursor = T0;
        for (uint256 i = 1; i <= 3; i++) {
            vm.warp(cursor + DAY);
            _settleUsage(1000, cursor, cursor + DAY, i);
            cursor += DAY;
        }
        assertEq(reg.getAuthorization(authId).totalSpent, 3 * 1000 * uint256(UNIT_PRICE));
        assertEq(metered.lastSettledEnd(meterId, authId), cursor);
    }

    /// A period with no usage settles nothing — there is no statement to submit,
    /// and a zero-unit statement is rejected because it cannot cover its fees.
    function test_settle_zeroUsageIsRejected() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st = _statement(meterId, authId, T0, T0 + DAY, 0, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(IReg.InvalidAmount.selector);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_isPermissionless() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.prank(STRANGER);
        metered.settle(st, sig);

        (, uint256 execFee,) = _split(1000 * uint256(UNIT_PRICE));
        assertEq(usdc.balanceOf(STRANGER), execFee);
    }

    // ─── Signature integrity ──────────────────────────────────────────────────

    function test_settle_rejectsSignatureFromNonMerchant() public {
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        vm.warp(T0 + DAY);

        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory forged = _signAs(attackerPk, st);

        vm.expectRevert(abi.encodeWithSelector(IMet.InvalidSignature.selector, meterId));
        vm.prank(EXECUTOR);
        metered.settle(st, forged);
    }

    /// Every signed field is bound into the digest: changing any of them after
    /// signing invalidates the signature.
    function test_settle_rejectsModifiedQuantity() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);

        st.units = 5000;
        st.amount = 5000 * UNIT_PRICE;

        vm.expectRevert(abi.encodeWithSelector(IMet.InvalidSignature.selector, meterId));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsModifiedAmount() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        st.amount = st.amount * 2; // inconsistent with units x price

        vm.expectRevert(
            abi.encodeWithSelector(
                IMet.AmountMismatch.selector, 1000 * uint256(UNIT_PRICE), st.amount
            )
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// The meter's price is immutable, so a merchant cannot sign a statement at
    /// a price the payer never saw.
    function test_settle_rejectsModifiedUnitPrice() public {
        vm.warp(T0 + DAY);
        uint128 inflated = UNIT_PRICE * 10;
        IMet.MeterStatement memory st = _statement(meterId, authId, T0, T0 + DAY, 100, inflated, 1);

        vm.expectRevert(
            abi.encodeWithSelector(IMet.UnitPriceMismatch.selector, meterId, UNIT_PRICE, inflated)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// A statement signed for one authorization cannot be pointed at another
    /// payer's authorization, even by that statement's own merchant.
    function test_settle_rejectsStatementRetargetedToAnotherAuthorization() public {
        address payer2 = makeAddr("payer2");
        usdc.mint(payer2, 1_000e6);
        vm.startPrank(payer2);
        usdc.approve(address(reg), type(uint256).max);
        bytes32 auth2 = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.METERED,
                maxPerCharge: 10e6,
                periodSpendCap: 100e6,
                totalSpendCap: 0,
                periodDuration: MONTH,
                validAfter: 0,
                validUntil: 0
            })
        );
        vm.stopPrank();

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        st.authorizationId = auth2;

        vm.expectRevert(abi.encodeWithSelector(IMet.InvalidSignature.selector, meterId));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// A merchant cannot bill a meter of its own against an authorization the
    /// payer granted to someone else.
    function test_settle_rejectsMeterAuthorizationMerchantMismatch() public {
        address otherMerchant = makeAddr("otherMerchant");
        vm.prank(PAYER);
        bytes32 otherAuth = reg.authorize(
            IReg.AuthorizationParams({
                merchant: otherMerchant,
                token: address(usdc),
                billingType: IReg.BillingType.METERED,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: 0
            })
        );

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, otherAuth, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        vm.expectRevert(
            abi.encodeWithSelector(IMet.MeterAuthorizationMismatch.selector, meterId, otherAuth)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    // ─── Replay and window integrity ──────────────────────────────────────────

    function test_settle_rejectsExactReplay() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);

        vm.prank(EXECUTOR);
        metered.settle(st, sig);

        vm.expectRevert(abi.encodeWithSelector(IMet.NonceAlreadyUsed.selector, MERCHANT, 1));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// Two executors racing the same statement: exactly one settlement lands.
    function test_settle_duplicateExecutorRaceCollectsOnce() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);

        vm.prank(EXECUTOR);
        metered.settle(st, sig);
        vm.expectRevert(abi.encodeWithSelector(IMet.NonceAlreadyUsed.selector, MERCHANT, 1));
        vm.prank(STRANGER);
        metered.settle(st, sig);

        assertEq(reg.getAuthorization(authId).totalSpent, 1000 * uint256(UNIT_PRICE));
        assertEq(usdc.balanceOf(STRANGER), 0);
    }

    /// A fresh nonce does not let a merchant re-bill a window that already
    /// settled — the watermark closes that door independently.
    /// The nonce guard is load-bearing on its own: a statement for a fresh,
    /// non-overlapping window is still rejected if its nonce was already spent.
    function test_settle_rejectsReusedNonceOnFreshWindow() public {
        vm.warp(T0 + DAY);
        _settleUsage(1000, T0, T0 + DAY, 1);

        vm.warp(T0 + 2 * DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0 + DAY, T0 + 2 * DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(abi.encodeWithSelector(IMet.NonceAlreadyUsed.selector, MERCHANT, 1));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsOverlappingWindowWithFreshNonce() public {
        vm.warp(T0 + DAY);
        uint64 end = T0 + DAY;
        _settleUsage(1000, T0, end, 1);

        IMet.MeterStatement memory st = _statement(meterId, authId, T0, end, 1000, UNIT_PRICE, 2);
        vm.expectRevert(
            abi.encodeWithSelector(IMet.StatementWindowOverlap.selector, windowStart, end)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsPartiallyOverlappingWindow() public {
        vm.warp(T0 + 2 * uint256(DAY));
        uint64 end = windowStart + 2 * DAY;
        _settleUsage(1000, windowStart, end, 1);

        // Starts one second inside the settled window.
        IMet.MeterStatement memory st =
            _statement(meterId, authId, end - 1, end + 1, 1000, UNIT_PRICE, 2);
        vm.warp(uint256(end) + 1);
        vm.expectRevert(
            abi.encodeWithSelector(IMet.StatementWindowOverlap.selector, end - 1, end)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsFutureWindow() public {
        uint64 end = T0 + DAY;
        IMet.MeterStatement memory st = _statement(meterId, authId, T0, end, 1000, UNIT_PRICE, 1);

        bytes memory sig = _sign(st);
        vm.expectRevert(abi.encodeWithSelector(IMet.StatementInFuture.selector, end));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsInvertedWindow() public {
        vm.warp(T0 + DAY);
        uint64 end = T0 + DAY;
        IMet.MeterStatement memory st = _statement(meterId, authId, end, T0, 1000, UNIT_PRICE, 1);

        vm.expectRevert(
            abi.encodeWithSelector(IMet.InvalidStatementWindow.selector, end, windowStart)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// A stale statement signed long ago stays valid only while it does not
    /// overlap a settled window — once a later window settles, it is dead.
    function test_settle_staleStatementRejectedAfterLaterWindowSettles() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory stale =
            _statement(meterId, authId, T0, T0 + DAY, 500, UNIT_PRICE, 1);
        bytes memory staleSig = _sign(stale);

        vm.warp(T0 + 2 * DAY);
        _settleUsage(1000, T0 + DAY, T0 + 2 * DAY, 2);

        vm.expectRevert(
            abi.encodeWithSelector(IMet.StatementWindowOverlap.selector, T0, T0 + 2 * DAY)
        );
        vm.prank(EXECUTOR);
        metered.settle(stale, staleSig);
    }

    // ─── Caps ─────────────────────────────────────────────────────────────────

    function test_settle_rejectsAboveMaxPerSettlement() public {
        vm.warp(T0 + DAY);
        // 6,000 requests is $12 — above the $10 per-settlement limit.
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 6000, UNIT_PRICE, 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.MaxPerChargeExceeded.selector, authId, 12e6, uint128(10e6)
            )
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsOnceMonthlyCapIsSpent() public {
        // Ten $10 settlements exhaust the $100 monthly cap.
        uint64 cursor = T0;
        for (uint256 i = 1; i <= 10; i++) {
            vm.warp(cursor + DAY);
            _settleUsage(5000, cursor, cursor + DAY, i);
            cursor += DAY;
        }
        assertEq(reg.getAuthorization(authId).spentThisPeriod, 100e6);

        vm.warp(cursor + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, cursor, cursor + DAY, 5000, UNIT_PRICE, 11);
        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.PeriodSpendCapExceeded.selector, authId, 110e6, uint128(100e6)
            )
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_resumesAfterPeriodRollover() public {
        uint64 cursor = T0;
        for (uint256 i = 1; i <= 10; i++) {
            vm.warp(cursor + DAY);
            _settleUsage(5000, cursor, cursor + DAY, i);
            cursor += DAY;
        }

        vm.warp(T0 + uint256(MONTH));
        _settleUsage(5000, cursor, T0 + MONTH, 11);
        assertEq(reg.getAuthorization(authId).spentThisPeriod, 10e6, "new month, fresh budget");
        assertEq(reg.getAuthorization(authId).totalSpent, 110e6);
    }

    function test_settle_rejectsExpiredAuthorization() public {
        uint64 end = T0 + 7 days;
        vm.prank(PAYER);
        bytes32 expiring = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.METERED,
                maxPerCharge: 10e6,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: 0,
                validAfter: 0,
                validUntil: end
            })
        );

        vm.warp(uint256(end) + 1);
        IMet.MeterStatement memory st = _statement(meterId, expiring, T0, end, 1000, UNIT_PRICE, 1);
        vm.expectRevert(
            abi.encodeWithSelector(IReg.AuthorizationExpired.selector, expiring, end)
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsRevokedAuthorization() public {
        vm.warp(T0 + DAY);
        vm.prank(PAYER);
        reg.revoke(authId);

        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, authId));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    function test_settle_rejectsRecurringOnlyAuthorization() public {
        bytes32 recurringAuth = _authorize(IReg.BillingType.RECURRING, 10e6, 0, 0, 0);
        vm.warp(T0 + DAY);

        IMet.MeterStatement memory st =
            _statement(meterId, recurringAuth, T0, T0 + DAY, 1000, UNIT_PRICE, 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.IncompatibleBillingType.selector,
                address(metered),
                IReg.BillingType.RECURRING
            )
        );
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    // ─── settleable ───────────────────────────────────────────────────────────

    function test_settleable_mirrorsSettleDecisions() public {
        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 1000, UNIT_PRICE, 1);

        (bool ok, bytes4 reason) = metered.settleable(st);
        assertTrue(ok);
        assertEq(reason, bytes4(0));

        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);

        (ok, reason) = metered.settleable(st);
        assertFalse(ok);
        assertEq(reason, IMet.NonceAlreadyUsed.selector);
    }

    // ─── Accounting invariant ─────────────────────────────────────────────────

    /// However a merchant shapes its statements, the payer's caps hold and no
    /// window is ever billed twice.
    function testFuzz_meteredSpendNeverExceedsCaps(uint128[6] memory unitCounts) public {
        uint64 cursor = T0;
        for (uint256 i = 0; i < unitCounts.length; i++) {
            uint128 units = uint128(bound(unitCounts[i], 1, 20_000));
            vm.warp(cursor + DAY);

            IMet.MeterStatement memory st =
                _statement(meterId, authId, cursor, cursor + DAY, units, UNIT_PRICE, i + 1);
            bytes memory sig = _sign(st);
            vm.prank(EXECUTOR);
            try metered.settle(st, sig) {
                cursor += DAY;
            } catch {}

            IReg.Authorization memory a = reg.getAuthorization(authId);
            assertLe(a.spentThisPeriod, 100e6, "periodSettled <= periodSpendCap");
            assertLe(uint256(a.maxPerCharge), 10e6, "per-charge limit is immutable upward");
        }
    }
}
