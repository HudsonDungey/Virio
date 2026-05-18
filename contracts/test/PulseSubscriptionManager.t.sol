// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PulseSubscriptionManager} from "../src/PulseSubscriptionManager.sol";
import {IPulseSubscriptionManager} from "../src/interfaces/IPulseSubscriptionManager.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";

/// Unit tests for the core PulseSubscriptionManager surface.
/// Run with:  forge test -vv
contract PulseSubscriptionManagerTest is Test {
    PulseSubscriptionManager internal mgr;
    MockUSDC                 internal usdc;

    address internal OWNER     = makeAddr("owner");
    address internal FEE_RECIP = makeAddr("feeRecipient");
    address internal MERCHANT  = makeAddr("merchant");
    address internal CUSTOMER  = makeAddr("customer");
    address internal EXECUTOR  = makeAddr("executor");
    address internal STRANGER  = makeAddr("stranger");

    uint256 internal constant AMOUNT = 10e6;     // 10 USDC
    uint256 internal constant PERIOD = 30 days;

    bytes32 internal planId;
    bytes32 internal subId;

    // Helpers replicating contract fee math (globals: executor 10 bps, protocol 25 bps + 1 USDC flat).
    uint256 internal constant EXEC_FEE     = (AMOUNT * 10) / 10_000;            // executorFeeBps = 10
    uint256 internal constant PROTOCOL_FEE = (AMOUNT * 25) / 10_000 + 1e6;       // protocolFeeBps = 25, flat 1 USDC
    uint256 internal constant MERCHANT_AMT = AMOUNT - EXEC_FEE - PROTOCOL_FEE;

    function setUp() public {
        vm.startPrank(OWNER);
        usdc = new MockUSDC();
        mgr  = new PulseSubscriptionManager(FEE_RECIP);
        vm.stopPrank();

        vm.prank(MERCHANT);
        planId = mgr.createPlan(address(usdc), AMOUNT, PERIOD);
        subId  = mgr.computeSubId(planId, CUSTOMER);

        usdc.mint(CUSTOMER, 10_000e6);
        vm.prank(CUSTOMER);
        usdc.approve(address(mgr), type(uint256).max);
    }

    // ─── createPlan ───────────────────────────────────────────────────────────

    function test_createPlan_emitsEvent() public {
        // The next plan created by MERCHANT will use nonce=2 (nonce=1 used in setUp).
        bytes32 expected = keccak256(abi.encodePacked(MERCHANT, uint256(2), block.chainid));

        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulseSubscriptionManager.PlanCreated(
            expected, MERCHANT, address(usdc), AMOUNT, PERIOD
        );
        vm.prank(MERCHANT);
        mgr.createPlan(address(usdc), AMOUNT, PERIOD);
    }

    function test_createPlan_revertsZeroToken() public {
        vm.prank(MERCHANT);
        vm.expectRevert(IPulseSubscriptionManager.ZeroAddress.selector);
        mgr.createPlan(address(0), AMOUNT, PERIOD);
    }

    function test_createPlan_revertsZeroAmount() public {
        vm.prank(MERCHANT);
        vm.expectRevert(IPulseSubscriptionManager.InvalidAmount.selector);
        mgr.createPlan(address(usdc), 0, PERIOD);
    }

    function test_createPlan_revertsZeroPeriod() public {
        vm.prank(MERCHANT);
        vm.expectRevert(IPulseSubscriptionManager.InvalidPeriod.selector);
        mgr.createPlan(address(usdc), AMOUNT, 0);
    }

    // ─── owner-only fee setters ───────────────────────────────────────────────

    function test_setProtocolFeeBps_byOwner() public {
        vm.prank(OWNER);
        mgr.setProtocolFeeBps(42);
        assertEq(mgr.protocolFeeBps(), 42);
    }

    function test_setProtocolFeeBps_revertsForNonOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setProtocolFeeBps(42);
    }

    function test_setProtocolFeeBps_revertsAboveCap() public {
        vm.prank(OWNER);
        vm.expectRevert("Pulse: bps > 10000");
        mgr.setProtocolFeeBps(10_001);
    }

    function test_setProtocolFlatFee_byOwner() public {
        vm.prank(OWNER);
        mgr.setProtocolFlatFee(5e6);
        assertEq(mgr.protocolFlatFee(), 5e6);
    }

    function test_setProtocolFlatFee_revertsForNonOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setProtocolFlatFee(5e6);
    }

    function test_setExecutorFeeBps_byOwner() public {
        vm.prank(OWNER);
        mgr.setExecutorFeeBps(15);
        assertEq(mgr.executorFeeBps(), 15);
    }

    function test_setExecutorFeeBps_revertsForNonOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setExecutorFeeBps(15);
    }

    // ─── subscribe ────────────────────────────────────────────────────────────

    function test_subscribe_setsDenormalizedState() public {
        vm.prank(CUSTOMER);
        bytes32 returnedId = mgr.subscribe(planId, 0);
        assertEq(returnedId, subId, "subscriptionId mismatch");

        IPulseSubscriptionManager.Subscription memory sub = mgr.getSubscription(subId);
        assertEq(sub.customer,      CUSTOMER);
        assertEq(sub.merchant,      MERCHANT);
        assertEq(sub.token,         address(usdc));
        assertEq(sub.amount,        AMOUNT);
        assertEq(sub.period,        PERIOD);
        assertEq(sub.totalSpent,    0);
        assertEq(sub.totalSpendCap, 0);
        assertTrue(sub.active);
    }

    function test_subscribe_revertsIfPlanInactive() public {
        vm.prank(MERCHANT);
        mgr.deactivatePlan(planId);

        vm.prank(CUSTOMER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.PlanNotActive.selector, planId)
        );
        mgr.subscribe(planId, 0);
    }

    function test_subscribe_revertsIfAlreadySubscribed() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.prank(CUSTOMER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.AlreadySubscribed.selector, subId)
        );
        mgr.subscribe(planId, 0);
    }

    function test_subscribe_canResubscribeAfterCancel() public {
        vm.startPrank(CUSTOMER);
        mgr.subscribe(planId, 0);
        mgr.cancel(subId);
        mgr.subscribe(planId, 0);
        vm.stopPrank();

        assertTrue(mgr.getSubscription(subId).active);
    }

    // ─── charge — happy path ──────────────────────────────────────────────────

    function test_charge_balanceDeltasAndEvent() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        uint256 mBefore = usdc.balanceOf(MERCHANT);
        uint256 fBefore = usdc.balanceOf(FEE_RECIP);
        uint256 cBefore = usdc.balanceOf(CUSTOMER);
        uint256 eBefore = usdc.balanceOf(EXECUTOR);

        vm.expectEmit(true, true, true, true, address(mgr));
        emit IPulseSubscriptionManager.ChargeExecuted(
            subId, EXECUTOR, CUSTOMER, AMOUNT, MERCHANT_AMT, EXEC_FEE, PROTOCOL_FEE,
            block.timestamp + PERIOD
        );
        vm.prank(EXECUTOR);
        mgr.charge(subId);

        assertEq(usdc.balanceOf(MERCHANT),  mBefore + MERCHANT_AMT, "merchant delta");
        assertEq(usdc.balanceOf(FEE_RECIP), fBefore + PROTOCOL_FEE, "feeRecipient delta");
        assertEq(usdc.balanceOf(EXECUTOR), eBefore + EXEC_FEE,      "executor delta");
        assertEq(usdc.balanceOf(CUSTOMER), cBefore - AMOUNT,        "customer delta");
    }

    function test_charge_revertsIfTooEarly() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);
        mgr.charge(subId);

        vm.expectRevert(
            abi.encodeWithSelector(
                IPulseSubscriptionManager.TooEarlyToCharge.selector,
                subId,
                block.timestamp + PERIOD
            )
        );
        mgr.charge(subId);
    }

    function test_charge_succeedsAfterPeriod() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);
        mgr.charge(subId);

        vm.warp(block.timestamp + PERIOD);
        mgr.charge(subId);

        assertEq(mgr.getSubscription(subId).totalSpent, 2 * AMOUNT);
    }

    function test_charge_revertsIfNotSubscribed() public {
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotSubscribed.selector, subId)
        );
        mgr.charge(subId);
    }

    // ─── charge — spend cap auto-cancel ───────────────────────────────────────

    function test_charge_autoCancelsOnCapExceeded() public {
        // Cap = exactly one charge worth → first succeeds, second triggers auto-cancel
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, AMOUNT);

        mgr.charge(subId);
        vm.warp(block.timestamp + PERIOD);

        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(subId, address(mgr));
        mgr.charge(subId);

        // No transfer should have happened on the auto-cancel charge.
        assertFalse(mgr.getSubscription(subId).active);
    }

    function test_charge_unlimitedCap() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        for (uint i = 0; i < 3; i++) {
            vm.warp(mgr.getSubscription(subId).nextChargeAt);
            mgr.charge(subId);
        }
        assertEq(mgr.getSubscription(subId).totalSpent, 3 * AMOUNT);
    }

    // ─── cancel ───────────────────────────────────────────────────────────────

    function test_cancel_byCustomer() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(subId, CUSTOMER);
        vm.prank(CUSTOMER);
        mgr.cancel(subId);
        assertFalse(mgr.getSubscription(subId).active);
    }

    function test_cancel_byMerchant() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(subId, MERCHANT);
        vm.prank(MERCHANT);
        mgr.cancel(subId);
        assertFalse(mgr.getSubscription(subId).active);
    }

    function test_cancel_revertsForStranger() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotSubscribed.selector, subId)
        );
        mgr.cancel(subId);
    }

    function test_cancel_thenChargeReverts() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);
        vm.prank(CUSTOMER);
        mgr.cancel(subId);

        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotSubscribed.selector, subId)
        );
        mgr.charge(subId);
    }

    // ─── deactivatePlan ───────────────────────────────────────────────────────

    function test_deactivatePlan_byMerchant_emitsEvent() public {
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.PlanDeactivated(planId, MERCHANT);
        vm.prank(MERCHANT);
        mgr.deactivatePlan(planId);
        assertFalse(mgr.getPlan(planId).active);
    }

    function test_deactivatePlan_existingSubsKeepCharging() public {
        // Subscriptions denormalize plan fields, so deactivation should NOT
        // break existing subs from continuing to be charged.
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.prank(MERCHANT);
        mgr.deactivatePlan(planId);

        mgr.charge(subId); // first charge after deactivation still works
        vm.warp(block.timestamp + PERIOD);
        mgr.charge(subId); // and the next one
        assertEq(mgr.getSubscription(subId).totalSpent, 2 * AMOUNT);
    }

    function test_deactivatePlan_blocksNewSubscribe() public {
        vm.prank(MERCHANT);
        mgr.deactivatePlan(planId);

        vm.prank(CUSTOMER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.PlanNotActive.selector, planId)
        );
        mgr.subscribe(planId, 0);
    }

    function test_deactivatePlan_revertsForStranger() public {
        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.UnauthorizedMerchant.selector, planId)
        );
        mgr.deactivatePlan(planId);
    }

    function test_deactivatePlan_revertsIfAlreadyInactive() public {
        vm.startPrank(MERCHANT);
        mgr.deactivatePlan(planId);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.PlanNotActive.selector, planId)
        );
        mgr.deactivatePlan(planId);
        vm.stopPrank();
    }

    // ─── allowance revocation ────────────────────────────────────────────────

    function test_charge_revertsOnRevokedAllowance() public {
        vm.prank(CUSTOMER);
        mgr.subscribe(planId, 0);

        vm.prank(CUSTOMER);
        usdc.approve(address(mgr), 0);

        vm.expectRevert();
        mgr.charge(subId);
    }
}
