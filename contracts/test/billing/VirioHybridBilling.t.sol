// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BillingTestBase} from "./BillingTestBase.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../../src/billing/interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioRecurringBilling as IRec} from
    "../../src/billing/interfaces/IVirioRecurringBilling.sol";
import {IVirioMeteredBilling as IMet} from
    "../../src/billing/interfaces/IVirioMeteredBilling.sol";

/// Hybrid billing has no contract of its own. It is one HYBRID authorization
/// that both the recurring and metered modules settle against, so the payer's
/// caps are shared automatically and there is no third copy of payment logic.
///
/// The plan under test is the one from the product spec:
///   $20/month base, 10,000 requests included, $0.001/request overage,
///   $50/month absolute maximum.
contract VirioHybridBillingTest is BillingTestBase {
    uint64 internal constant T0 = 1_800_000_000;

    uint128 internal constant BASE = 20e6; // $20/month
    uint128 internal constant OVERAGE_PRICE = 1000; // $0.001 per request
    uint128 internal constant INCLUDED = 10_000;
    uint128 internal constant MONTHLY_MAX = 50e6; // absolute ceiling

    bytes32 internal constant UNIT = keccak256("api_request");

    bytes32 internal planId;
    bytes32 internal meterId;
    bytes32 internal authId;
    bytes32 internal subId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(MERCHANT);
        planId = recurring.createPlan(address(usdc), BASE, MONTH);
        meterId = metered.createMeter(address(usdc), UNIT, OVERAGE_PRICE, INCLUDED, DAY);
        vm.stopPrank();

        // ONE authorization backs both halves. maxPerCharge covers the base
        // charge; the monthly cap is the absolute ceiling across both modules.
        authId = _authorize(IReg.BillingType.HYBRID, 30e6, MONTHLY_MAX, 0, MONTH);

        vm.prank(PAYER);
        subId = recurring.subscribe(planId, authId);
    }

    /// Units the merchant may bill after the included allowance — the
    /// arithmetic the off-chain meter performs before signing.
    function _billable(uint128 used) internal pure returns (uint128) {
        return used > INCLUDED ? used - INCLUDED : 0;
    }

    function _settleOverage(uint128 used, uint64 start, uint64 end, uint256 nonce) internal {
        IMet.MeterStatement memory st =
            _statement(meterId, authId, start, end, _billable(used), OVERAGE_PRICE, nonce);
        bytes memory sig = _sign(st);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    // ─── Base only ────────────────────────────────────────────────────────────

    function test_baseChargeOnly() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        IReg.Authorization memory a = reg.getAuthorization(authId);
        assertEq(a.spentThisPeriod, BASE);
        assertEq(a.totalSpent, BASE);
    }

    /// Usage inside the included allowance produces no settlement at all: the
    /// merchant has nothing to bill, so no transaction is submitted.
    function test_usageWithinIncludedAllowanceSettlesNothing() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        assertEq(_billable(9_500), 0, "9,500 of 10,000 included is not billable");

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 0, OVERAGE_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(IReg.InvalidAmount.selector);
        vm.prank(EXECUTOR);
        metered.settle(st, sig);

        assertEq(reg.getAuthorization(authId).totalSpent, BASE, "base charge only");
    }

    // ─── Base + overage ───────────────────────────────────────────────────────

    function test_baseAndOverageShareOneAuthorization() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        // 14,000 requests → 4,000 billable → $4.00
        vm.warp(T0 + DAY);
        _settleOverage(14_000, T0, T0 + DAY, 1);

        IReg.Authorization memory a = reg.getAuthorization(authId);
        assertEq(a.spentThisPeriod, BASE + 4e6, "base and usage draw on one budget");
        assertEq(a.totalSpent, BASE + 4e6);

        (, uint256 thisPeriod,) = reg.remaining(authId);
        assertEq(thisPeriod, MONTHLY_MAX - (BASE + 4e6));
    }

    function test_overageAccruesAcrossDailySettlements() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        // Day 1: 12,000 used → 2,000 billable → $2.00
        vm.warp(T0 + DAY);
        _settleOverage(12_000, T0, T0 + DAY, 1);
        // Day 2: allowance already consumed, so every request is billable.
        vm.warp(T0 + 2 * DAY);
        _settleOverage(INCLUDED + 3_000, T0 + DAY, T0 + 2 * DAY, 2);

        assertEq(reg.getAuthorization(authId).spentThisPeriod, BASE + 2e6 + 3e6);
    }

    // ─── The absolute monthly maximum ─────────────────────────────────────────

    /// The headline promise of a hybrid plan: whatever the usage, the payer
    /// cannot be charged more than the monthly maximum. Enforced by the
    /// registry, so neither module can talk its way past it.
    function test_monthlyMaximumCapsCombinedSpend() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId); // $20

        // $25 of overage lands fine: $45 total, under the $50 ceiling.
        vm.warp(T0 + DAY);
        _settleOverage(INCLUDED + 25_000, T0, T0 + DAY, 1);
        assertEq(reg.getAuthorization(authId).spentThisPeriod, 45e6);

        // The next $10 of usage would reach $55. The registry refuses.
        vm.warp(T0 + 2 * DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0 + DAY, T0 + 2 * DAY, 10_000, OVERAGE_PRICE, 2);
        bytes memory sig = _sign(st);
        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.PeriodSpendCapExceeded.selector, authId, 55e6, MONTHLY_MAX
            )
        );
        vm.prank(EXECUTOR);
        metered.settle(st, sig);

        assertEq(reg.getAuthorization(authId).spentThisPeriod, 45e6, "unchanged after refusal");
    }

    /// Overage that fills the month must not let the base charge through either.
    /// A cap is a cap regardless of which module gets there first.
    function test_usageSpendBlocksTheBaseCharge() public {
        // Two settlements of $25 fill the month; a single $50 one would be
        // stopped earlier, by the per-settlement limit.
        vm.warp(T0 + DAY);
        _settleOverage(INCLUDED + 25_000, T0, T0 + DAY, 1);
        vm.warp(T0 + 2 * DAY);
        _settleOverage(INCLUDED + 25_000, T0 + DAY, T0 + 2 * DAY, 2);
        assertEq(reg.getAuthorization(authId).spentThisPeriod, MONTHLY_MAX);

        vm.expectRevert(
            abi.encodeWithSelector(
                IReg.PeriodSpendCapExceeded.selector, authId, 70e6, MONTHLY_MAX
            )
        );
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    function test_bothHalvesResumeNextPeriod() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);
        vm.warp(T0 + DAY);
        _settleOverage(INCLUDED + 25_000, T0, T0 + DAY, 1);
        assertEq(reg.getAuthorization(authId).spentThisPeriod, 45e6);

        vm.warp(T0 + MONTH);
        vm.prank(EXECUTOR);
        recurring.charge(subId);
        _settleOverage(INCLUDED + 10_000, T0 + DAY, T0 + MONTH, 2);

        IReg.Authorization memory a = reg.getAuthorization(authId);
        assertEq(a.spentThisPeriod, 30e6, "new month starts fresh");
        assertEq(a.totalSpent, 75e6, "lifetime keeps counting across periods");
        assertEq(a.periodStart, T0 + MONTH);
    }

    // ─── Revocation ───────────────────────────────────────────────────────────

    /// Revoking the authorization stops both halves at once — the single lever
    /// a payer expects from a single consent.
    function test_revokeStopsBaseAndUsageTogether() public {
        vm.prank(PAYER);
        reg.revoke(authId);

        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, authId));
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 5_000, OVERAGE_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, authId));
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    /// Pausing metered billing leaves the recurring half running. This is why
    /// module status is granular rather than one global switch.
    function test_pausingMeteredLeavesRecurringRunning() public {
        vm.prank(OWNER);
        reg.setModuleStatus(address(metered), IReg.ModuleStatus.Paused);

        vm.prank(EXECUTOR);
        recurring.charge(subId);
        assertEq(reg.getAuthorization(authId).totalSpent, BASE);

        vm.warp(T0 + DAY);
        IMet.MeterStatement memory st =
            _statement(meterId, authId, T0, T0 + DAY, 5_000, OVERAGE_PRICE, 1);
        bytes memory sig = _sign(st);
        vm.expectRevert(
            abi.encodeWithSelector(IReg.ModuleNotActive.selector, address(metered))
        );
        vm.prank(EXECUTOR);
        metered.settle(st, sig);
    }

    // ─── Accounting invariant ─────────────────────────────────────────────────

    /// Across any interleaving of base charges and usage settlements, combined
    /// spend never exceeds the monthly maximum the payer agreed to.
    function testFuzz_combinedSpendNeverExceedsMonthlyMaximum(uint128[6] memory used) public {
        uint64 cursor = T0;
        for (uint256 i = 0; i < used.length; i++) {
            vm.warp(cursor + DAY);

            vm.prank(EXECUTOR);
            try recurring.charge(subId) {} catch {}

            uint128 billable = uint128(bound(used[i], 1, 60_000));
            IMet.MeterStatement memory st =
                _statement(meterId, authId, cursor, cursor + DAY, billable, OVERAGE_PRICE, i + 1);
            bytes memory sig = _sign(st);
            vm.prank(EXECUTOR);
            try metered.settle(st, sig) {
                cursor += DAY;
            } catch {
                cursor += DAY;
            }

            assertLe(
                reg.getAuthorization(authId).spentThisPeriod,
                MONTHLY_MAX,
                "combined spend never exceeds the monthly maximum"
            );
        }
    }
}
