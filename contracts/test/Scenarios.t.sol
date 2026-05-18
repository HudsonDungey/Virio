// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PulseSubscriptionManager} from "../src/PulseSubscriptionManager.sol";
import {IPulseSubscriptionManager} from "../src/interfaces/IPulseSubscriptionManager.sol";
import {IPulseExecutor} from "../src/interfaces/IPulseExecutor.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";

/// End-to-end scenario tests.
///
/// Models a realistic merchant onboarding: 5 plans across 2 merchants, 5
/// customers subscribing to 2-3 plans each, two executor "bots" (payee
/// addresses; the test contract acts as the trusted router that calls
/// chargeFor), then a mix of cancellations, deactivations, spend-cap
/// auto-cancels, and revert paths — with full event capture.
///
/// Run with:  forge test --match-path test/Scenarios.t.sol -vvv
contract ScenariosTest is Test {
    PulseSubscriptionManager internal mgr;
    MockUSDC                 internal usdc;

    address internal OWNER     = makeAddr("owner");
    address internal FEE_RECIP = makeAddr("feeRecipient");

    address internal acmeMerchant   = makeAddr("acme");
    address internal hyperMerchant  = makeAddr("hyper");

    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave  = makeAddr("dave");
    address internal eve   = makeAddr("eve");

    address internal botAlpha = makeAddr("botAlpha");
    address internal botBeta  = makeAddr("botBeta");

    address internal stranger = makeAddr("stranger");

    struct PlanCfg {
        address merchant;
        uint256 amount;
        uint256 period;
    }

    PlanCfg internal planA = PlanCfg(address(0), 10e6,  30 days);
    PlanCfg internal planB = PlanCfg(address(0), 5e6,   7 days);
    PlanCfg internal planC = PlanCfg(address(0), 100e6, 1 days);
    PlanCfg internal planD = PlanCfg(address(0), 2e6,   1 hours);
    PlanCfg internal planE = PlanCfg(address(0), 50e6,  90 days);

    bytes32 internal idA;
    bytes32 internal idB;
    bytes32 internal idC;
    bytes32 internal idD;
    bytes32 internal idE;

    uint256 internal constant START_BAL  = 100_000e6;
    uint16  internal constant EXEC_BPS   = 10;
    uint16  internal constant PROTO_BPS  = 25;
    uint256 internal constant FLAT_FEE   = 1e6;

    function setUp() public {
        planA.merchant = acmeMerchant;
        planB.merchant = acmeMerchant;
        planE.merchant = acmeMerchant;
        planC.merchant = hyperMerchant;
        planD.merchant = hyperMerchant;

        vm.startPrank(OWNER);
        usdc = new MockUSDC();
        mgr  = new PulseSubscriptionManager(FEE_RECIP);
        // Test contract is the trusted executor router for the scenario.
        mgr.setTrustedExecutor(address(this));
        vm.stopPrank();

        address[5] memory customers = [alice, bob, carol, dave, eve];
        for (uint i; i < customers.length; i++) {
            usdc.mint(customers[i], START_BAL);
            vm.prank(customers[i]);
            usdc.approve(address(mgr), type(uint256).max);
        }

        idA = _createPlan(planA);
        idB = _createPlan(planB);
        idC = _createPlan(planC);
        idD = _createPlan(planD);
        idE = _createPlan(planE);
    }

    function _createPlan(PlanCfg memory p) internal returns (bytes32) {
        vm.prank(p.merchant);
        return mgr.createPlan(address(usdc), p.amount, p.period);
    }

    function _split(uint256 amount)
        internal pure returns (uint256 execFee, uint256 protoFee, uint256 merchantAmt)
    {
        execFee     = (amount * EXEC_BPS)  / 10_000;
        protoFee    = (amount * PROTO_BPS) / 10_000 + FLAT_FEE;
        merchantAmt = amount - execFee - protoFee;
    }

    // ─── IPulseExecutor stub (manager calls back during subscribe/cancel) ────
    function registerPayment(
        IPulseExecutor.ManagerKind,
        bytes32,
        bytes32,
        uint64,
        uint64
    ) external pure returns (bytes32) {
        return bytes32(0);
    }
    function deregisterPayment(bytes32) external pure {}

    // ─── Big scenario sweep ───────────────────────────────────────────────────

    function test_fullScenario_sweep() public {
        _subscribe(alice, idA, 0);
        _subscribe(bob,   idA, 3 * planA.amount);

        _subscribe(alice, idB, 0);
        _subscribe(carol, idB, 0);

        _subscribe(bob,   idC, 0);
        _subscribe(dave,  idC, 0);
        _subscribe(eve,   idC, 0);

        _subscribe(carol, idD, 0);
        _subscribe(eve,   idD, 3 * planD.amount);

        _subscribe(dave,  idE, 0);
        _subscribe(alice, idE, 2 * planE.amount);

        _chargeAndAssert(alice, idA, planA.amount, botAlpha);
        _chargeAndAssert(bob,   idA, planA.amount, botBeta);
        _chargeAndAssert(alice, idB, planB.amount, botAlpha);
        _chargeAndAssert(carol, idB, planB.amount, botBeta);
        _chargeAndAssert(bob,   idC, planC.amount, botAlpha);
        _chargeAndAssert(dave,  idC, planC.amount, botBeta);
        _chargeAndAssert(eve,   idC, planC.amount, botAlpha);
        _chargeAndAssert(carol, idD, planD.amount, botBeta);
        _chargeAndAssert(eve,   idD, planD.amount, botAlpha);
        _chargeAndAssert(dave,  idE, planE.amount, botBeta);
        _chargeAndAssert(alice, idE, planE.amount, botAlpha);

        assertGt(usdc.balanceOf(botAlpha), 0, "botAlpha earned no fees");
        assertGt(usdc.balanceOf(botBeta),  0, "botBeta earned no fees");

        bytes32 subId = mgr.computeSubId(idA, alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPulseSubscriptionManager.TooEarlyToCharge.selector,
                subId,
                block.timestamp + planA.period
            )
        );
        mgr.chargeFor(subId, EXEC_BPS, botAlpha);

        vm.warp(block.timestamp + 1 hours);
        _chargeAndAssert(carol, idD, planD.amount, botBeta);
        _chargeAndAssert(eve,   idD, planD.amount, botAlpha);

        bytes32 bobCid = mgr.computeSubId(idC, bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPulseSubscriptionManager.TooEarlyToCharge.selector,
                bobCid,
                _subNextCharge(bobCid)
            )
        );
        mgr.chargeFor(bobCid, EXEC_BPS, botAlpha);

        vm.warp(block.timestamp + 1 days);
        _chargeAndAssert(bob,   idC, planC.amount, botBeta);
        _chargeAndAssert(dave,  idC, planC.amount, botAlpha);
        _chargeAndAssert(eve,   idC, planC.amount, botBeta);

        _chargeAndAssert(carol, idD, planD.amount, botAlpha);
        _chargeAndAssert(eve,   idD, planD.amount, botBeta);
        assertTrue(
            mgr.getSubscription(mgr.computeSubId(idD, eve)).active,
            "eve.D should still be active"
        );

        bytes32 eveDid = mgr.computeSubId(idD, eve);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(eveDid, address(mgr));
        mgr.chargeFor(eveDid, EXEC_BPS, botAlpha);
        assertFalse(mgr.getSubscription(eveDid).active, "eve.D should be auto-cancelled");

        bytes32 carolBid = mgr.computeSubId(idB, carol);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(carolBid, carol);
        vm.prank(carol);
        mgr.cancel(carolBid);
        assertFalse(mgr.getSubscription(carolBid).active);

        bytes32 daveCid = mgr.computeSubId(idC, dave);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(daveCid, hyperMerchant);
        vm.prank(hyperMerchant);
        mgr.cancel(daveCid);
        assertFalse(mgr.getSubscription(daveCid).active);

        bytes32 aliceAid = mgr.computeSubId(idA, alice);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPulseSubscriptionManager.NotSubscribed.selector, aliceAid
            )
        );
        mgr.cancel(aliceAid);

        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.PlanDeactivated(idA, acmeMerchant);
        vm.prank(acmeMerchant);
        mgr.deactivatePlan(idA);

        vm.warp(block.timestamp + planA.period);
        _chargeAndAssert(alice, idA, planA.amount, botBeta);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.PlanNotActive.selector, idA)
        );
        mgr.subscribe(idA, 0);

        bytes32 bobAid = mgr.computeSubId(idA, bob);
        _chargeAndAssert(bob, idA, planA.amount, botAlpha);
        vm.warp(block.timestamp + planA.period);
        _chargeAndAssert(bob, idA, planA.amount, botBeta);

        vm.warp(block.timestamp + planA.period);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulseSubscriptionManager.Cancelled(bobAid, address(mgr));
        mgr.chargeFor(bobAid, EXEC_BPS, botAlpha);
        assertFalse(mgr.getSubscription(bobAid).active);

        vm.prank(carol);
        mgr.subscribe(idB, 0);
        assertTrue(mgr.getSubscription(carolBid).active);
    }

    // ─── Targeted edge cases ──────────────────────────────────────────────────

    function test_doubleSubscribe_reverts() public {
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.AlreadySubscribed.selector, sid)
        );
        mgr.subscribe(idA, 0);
    }

    function test_chargeNonExistentSub_reverts() public {
        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotSubscribed.selector, sid)
        );
        mgr.chargeFor(sid, EXEC_BPS, botAlpha);
    }

    function test_allowanceRevoked_chargeReverts() public {
        _subscribe(alice, idA, 0);
        vm.prank(alice);
        usdc.approve(address(mgr), 0);

        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.expectRevert();
        mgr.chargeFor(sid, EXEC_BPS, botAlpha);
    }

    function test_chargeFor_revertsForNonExecutor() public {
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);

        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotTrustedExecutor.selector, stranger)
        );
        mgr.chargeFor(sid, EXEC_BPS, stranger);
    }

    function test_lateCharge_additivePeriod_noDrift() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);

        mgr.chargeFor(sid, EXEC_BPS, botAlpha);

        vm.warp(t0 + 3 * planA.period);
        mgr.chargeFor(sid, EXEC_BPS, botAlpha);

        assertEq(
            mgr.getSubscription(sid).nextChargeAt,
            t0 + 2 * planA.period,
            "additive period anchoring"
        );
    }

    function test_subId_isDeterministic() public {
        bytes32 a = mgr.computeSubId(idA, alice);
        vm.warp(block.timestamp + 365 days);
        bytes32 b = mgr.computeSubId(idA, alice);
        assertEq(a, b);
    }

    // ─── Test helpers ─────────────────────────────────────────────────────────

    function _subscribe(address customer, bytes32 planId, uint256 cap) internal {
        bytes32 sid = mgr.computeSubId(planId, customer);
        vm.expectEmit(true, true, true, true, address(mgr));
        emit IPulseSubscriptionManager.Subscribed(sid, planId, customer, cap);
        vm.prank(customer);
        mgr.subscribe(planId, cap);
    }

    function _chargeAndAssert(
        address customer,
        bytes32 planId,
        uint256 amount,
        address botPayee
    ) internal {
        bytes32 sid = mgr.computeSubId(planId, customer);

        (uint256 execFee, uint256 protoFee, uint256 merchantAmt) = _split(amount);

        IPulseSubscriptionManager.Subscription memory sub = mgr.getSubscription(sid);
        address merchant     = sub.merchant;
        uint256 expectedNext = sub.nextChargeAt + sub.period;

        uint256 mBefore = usdc.balanceOf(merchant);
        uint256 fBefore = usdc.balanceOf(FEE_RECIP);
        uint256 cBefore = usdc.balanceOf(customer);
        uint256 bBefore = usdc.balanceOf(botPayee);

        vm.expectEmit(true, true, true, true, address(mgr));
        emit IPulseSubscriptionManager.ChargeExecuted(
            sid, botPayee, customer, amount, merchantAmt, execFee, protoFee, expectedNext
        );
        // Test contract is the trusted executor — call chargeFor directly.
        mgr.chargeFor(sid, EXEC_BPS, botPayee);

        assertEq(usdc.balanceOf(merchant), mBefore + merchantAmt, "merchant balance");
        assertEq(usdc.balanceOf(FEE_RECIP), fBefore + protoFee,   "feeRecipient balance");
        assertEq(usdc.balanceOf(customer), cBefore - amount,      "customer balance");
        assertEq(usdc.balanceOf(botPayee), bBefore + execFee,     "bot balance");
    }

    function _subNextCharge(bytes32 sid) internal view returns (uint256) {
        return mgr.getSubscription(sid).nextChargeAt;
    }
}
