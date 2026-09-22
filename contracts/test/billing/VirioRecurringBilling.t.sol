// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BillingTestBase} from "./BillingTestBase.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../../src/billing/interfaces/IVirioAuthorizationRegistry.sol";
import {IVirioRecurringBilling as IRec} from
    "../../src/billing/interfaces/IVirioRecurringBilling.sol";

/// Regression tests for recurring billing as a module. These deliberately
/// mirror the behaviours the deployed VirioSubscriptionManager guarantees, so a
/// merchant migrating can see the semantics they depend on are still here.
contract VirioRecurringBillingTest is BillingTestBase {
    uint128 internal constant PRICE = 29e6;

    bytes32 internal planId;
    bytes32 internal authId;
    bytes32 internal subId;

    function setUp() public override {
        super.setUp();
        vm.prank(MERCHANT);
        planId = recurring.createPlan(address(usdc), PRICE, MONTH);

        authId = _authorize(IReg.BillingType.RECURRING, PRICE, PRICE, 0, MONTH);

        vm.prank(PAYER);
        subId = recurring.subscribe(planId, authId);
    }

    // ─── Plans ────────────────────────────────────────────────────────────────

    function test_createPlan_storesTerms() public view {
        IRec.Plan memory plan = recurring.getPlan(planId);
        assertEq(plan.merchant, MERCHANT);
        assertEq(plan.token, address(usdc));
        assertEq(plan.amount, PRICE);
        assertEq(plan.period, MONTH);
        assertTrue(plan.active);
    }

    function test_createPlan_rejectsZeroArguments() public {
        vm.startPrank(MERCHANT);
        vm.expectRevert(IRec.ZeroAddress.selector);
        recurring.createPlan(address(0), PRICE, MONTH);
        vm.expectRevert(IRec.InvalidAmount.selector);
        recurring.createPlan(address(usdc), 0, MONTH);
        vm.expectRevert(IRec.InvalidPeriod.selector);
        recurring.createPlan(address(usdc), PRICE, 0);
        vm.stopPrank();
    }

    function test_deactivatePlan_blocksNewSubscribersOnly() public {
        vm.prank(MERCHANT);
        recurring.deactivatePlan(planId);

        // Existing subscription keeps charging on its own denormalized terms.
        vm.prank(EXECUTOR);
        recurring.charge(subId);
        assertEq(reg.getAuthorization(authId).totalSpent, PRICE);

        // New subscribers are turned away.
        address other = makeAddr("other");
        vm.prank(other);
        bytes32 otherAuth = reg.authorize(
            IReg.AuthorizationParams({
                merchant: MERCHANT,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: PRICE,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: MONTH,
                validAfter: 0,
                validUntil: 0
            })
        );
        vm.expectRevert(abi.encodeWithSelector(IRec.PlanNotActive.selector, planId));
        vm.prank(other);
        recurring.subscribe(planId, otherAuth);
    }

    function test_deactivatePlan_revertsForStranger() public {
        vm.expectRevert(abi.encodeWithSelector(IRec.UnauthorizedMerchant.selector, planId));
        vm.prank(STRANGER);
        recurring.deactivatePlan(planId);
    }

    // ─── Subscribe ────────────────────────────────────────────────────────────

    function test_subscribe_denormalizesPlanTerms() public view {
        IRec.Subscription memory sub = recurring.getSubscription(subId);
        assertEq(sub.authorizationId, authId);
        assertEq(sub.planId, planId);
        assertEq(sub.payer, PAYER);
        assertEq(sub.amount, PRICE);
        assertEq(sub.period, MONTH);
        assertEq(sub.nextChargeAt, uint64(block.timestamp), "immediately chargeable");
        assertTrue(sub.active);
    }

    function test_subscriptionId_isDeterministic() public view {
        assertEq(subId, recurring.computeSubscriptionId(planId, PAYER));
        assertEq(subId, keccak256(abi.encodePacked(planId, PAYER)));
    }

    function test_subscribe_revertsIfAlreadySubscribed() public {
        vm.expectRevert(abi.encodeWithSelector(IRec.AlreadySubscribed.selector, subId));
        vm.prank(PAYER);
        recurring.subscribe(planId, authId);
    }

    function test_subscribe_rejectsAuthorizationOfAnotherPayer() public {
        vm.expectRevert(abi.encodeWithSelector(IRec.AuthorizationNotUsable.selector, authId));
        vm.prank(STRANGER);
        recurring.subscribe(planId, authId);
    }

    function test_subscribe_rejectsAuthorizationForAnotherMerchant() public {
        address otherMerchant = makeAddr("otherMerchant");
        vm.prank(PAYER);
        bytes32 wrongAuth = reg.authorize(
            IReg.AuthorizationParams({
                merchant: otherMerchant,
                token: address(usdc),
                billingType: IReg.BillingType.RECURRING,
                maxPerCharge: PRICE,
                periodSpendCap: 0,
                totalSpendCap: 0,
                periodDuration: MONTH,
                validAfter: 0,
                validUntil: 0
            })
        );

        vm.prank(MERCHANT);
        bytes32 plan2 = recurring.createPlan(address(usdc), PRICE, MONTH);

        vm.expectRevert(
            abi.encodeWithSelector(IRec.AuthorizationMerchantMismatch.selector, wrongAuth)
        );
        vm.prank(PAYER);
        recurring.subscribe(plan2, wrongAuth);
    }

    /// A subscription that could never charge is rejected up front rather than
    /// left to fail silently in an executor loop forever.
    function test_subscribe_rejectsAuthorizationBelowPlanPrice() public {
        vm.prank(MERCHANT);
        bytes32 plan2 = recurring.createPlan(address(usdc), 100e6, MONTH);

        vm.expectRevert(abi.encodeWithSelector(IRec.AuthorizationLimitTooLow.selector, authId));
        vm.prank(PAYER);
        recurring.subscribe(plan2, authId);
    }

    function test_subscribe_rejectsRevokedAuthorization() public {
        vm.prank(MERCHANT);
        bytes32 plan2 = recurring.createPlan(address(usdc), PRICE, MONTH);
        vm.prank(PAYER);
        reg.revoke(authId);

        vm.expectRevert(abi.encodeWithSelector(IRec.AuthorizationNotUsable.selector, authId));
        vm.prank(PAYER);
        recurring.subscribe(plan2, authId);
    }

    // ─── Charge ───────────────────────────────────────────────────────────────

    function test_charge_movesMoneyAndAdvancesDueDate() public {
        (uint256 merchantAmt, uint256 execFee, uint256 protoFee) = _split(PRICE);
        uint64 expectedNext = uint64(block.timestamp) + MONTH;

        vm.expectEmit(true, true, true, true, address(recurring));
        emit IRec.RecurringChargeExecuted(
            subId, authId, EXECUTOR, PRICE, merchantAmt, expectedNext
        );
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        assertEq(usdc.balanceOf(MERCHANT), merchantAmt);
        assertEq(usdc.balanceOf(EXECUTOR), execFee);
        assertEq(usdc.balanceOf(FEE_RECIP), protoFee);
        assertEq(recurring.getSubscription(subId).nextChargeAt, expectedNext);
    }

    function test_charge_isPermissionless() public {
        vm.prank(STRANGER);
        recurring.charge(subId);
        (, uint256 execFee,) = _split(PRICE);
        assertEq(usdc.balanceOf(STRANGER), execFee, "any caller earns the executor fee");
    }

    function test_charge_revertsBeforeDue() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        uint64 next = recurring.getSubscription(subId).nextChargeAt;
        vm.expectRevert(abi.encodeWithSelector(IRec.TooEarlyToCharge.selector, subId, next));
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    function test_charge_succeedsExactlyAtDueTime() public {
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        vm.warp(recurring.getSubscription(subId).nextChargeAt);
        vm.prank(EXECUTOR);
        recurring.charge(subId);
        assertEq(reg.getAuthorization(authId).totalSpent, uint256(PRICE) * 2);
    }

    /// nextChargeAt resets from the charge time, so a backlog never produces a
    /// burst of catch-up charges. This is the deployed manager's behaviour.
    function test_charge_lateExecutorDoesNotBackfill() public {
        uint64 t0 = uint64(block.timestamp);
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        vm.warp(t0 + 3 * uint256(MONTH));
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        assertEq(
            recurring.getSubscription(subId).nextChargeAt,
            t0 + 3 * MONTH + MONTH,
            "one charge per period regardless of backlog"
        );
        assertEq(reg.getAuthorization(authId).totalSpent, uint256(PRICE) * 2);
    }

    /// Two executors racing the same due charge: the first wins, the second
    /// reverts. Enforced by the contract, not by executor coordination.
    function test_charge_duplicateExecutorRaceCollectsOnce() public {
        uint64 next = uint64(block.timestamp) + MONTH;
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        vm.expectRevert(abi.encodeWithSelector(IRec.TooEarlyToCharge.selector, subId, next));
        vm.prank(STRANGER);
        recurring.charge(subId);

        assertEq(reg.getAuthorization(authId).totalSpent, PRICE, "charged exactly once");
        assertEq(usdc.balanceOf(STRANGER), 0, "loser earns nothing");
    }

    function test_charge_revertsWhenAuthorizationRevoked() public {
        vm.prank(PAYER);
        reg.revoke(authId);

        vm.expectRevert(abi.encodeWithSelector(IReg.AuthorizationNotActive.selector, authId));
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    function test_charge_revertsWhenPeriodCapAlreadySpent() public {
        // The authorization allows one PRICE charge per month; the subscription
        // is monthly, so a second charge inside the same period must fail even
        // if the due date somehow allowed it.
        vm.prank(EXECUTOR);
        recurring.charge(subId);

        vm.warp(block.timestamp + MONTH - 1);
        vm.expectRevert();
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    function test_charge_revertsWhenModulePaused() public {
        vm.prank(OWNER);
        reg.setModuleStatus(address(recurring), IReg.ModuleStatus.Paused);

        vm.expectRevert(
            abi.encodeWithSelector(IReg.ModuleNotActive.selector, address(recurring))
        );
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    // ─── Cancel ───────────────────────────────────────────────────────────────

    function test_cancel_byPayer() public {
        vm.prank(PAYER);
        recurring.cancel(subId);
        assertFalse(recurring.getSubscription(subId).active);

        vm.expectRevert(abi.encodeWithSelector(IRec.NotSubscribed.selector, subId));
        vm.prank(EXECUTOR);
        recurring.charge(subId);
    }

    function test_cancel_byMerchant() public {
        vm.prank(MERCHANT);
        recurring.cancel(subId);
        assertFalse(recurring.getSubscription(subId).active);
    }

    function test_cancel_revertsForStranger() public {
        vm.expectRevert(abi.encodeWithSelector(IRec.NotSubscribed.selector, subId));
        vm.prank(STRANGER);
        recurring.cancel(subId);
    }

    /// Cancelling a subscription must not revoke the authorization behind it —
    /// a hybrid plan's metered half still needs it.
    function test_cancel_leavesAuthorizationIntact() public {
        vm.prank(PAYER);
        recurring.cancel(subId);
        assertTrue(reg.getAuthorization(authId).active);
    }

    function test_resubscribeAfterCancel() public {
        vm.prank(PAYER);
        recurring.cancel(subId);
        vm.prank(PAYER);
        bytes32 again = recurring.subscribe(planId, authId);
        assertEq(again, subId);
        assertTrue(recurring.getSubscription(subId).active);
    }

    // ─── chargeable ───────────────────────────────────────────────────────────

    function test_chargeable_reportsWhyNot() public {
        (bool ok, bytes4 reason) = recurring.chargeable(subId);
        assertTrue(ok);
        assertEq(reason, bytes4(0));

        vm.prank(EXECUTOR);
        recurring.charge(subId);
        (ok, reason) = recurring.chargeable(subId);
        assertFalse(ok);
        assertEq(reason, IRec.TooEarlyToCharge.selector);

        vm.warp(block.timestamp + MONTH);
        vm.prank(PAYER);
        reg.revoke(authId);
        (ok, reason) = recurring.chargeable(subId);
        assertFalse(ok);
        assertEq(reason, IReg.AuthorizationNotActive.selector);

        vm.prank(PAYER);
        recurring.cancel(subId);
        (ok, reason) = recurring.chargeable(subId);
        assertFalse(ok);
        assertEq(reason, IRec.NotSubscribed.selector);
    }
}
