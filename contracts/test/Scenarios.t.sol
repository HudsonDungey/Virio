// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VirioSubscriptionManager} from "../src/VirioSubscriptionManager.sol";
import {IVirioSubscriptionManager} from "../src/interfaces/IVirioSubscriptionManager.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";

/// End-to-end scenario tests.
///
/// Models a realistic merchant onboarding: 5 plans across 2 merchants, 5
/// customers subscribing to 2-3 plans each, two permissionless executor bots
/// taking turns calling charge(), then a mix of cancellations, deactivations,
/// spend-cap auto-cancels, and revert paths — with full event capture.
///
/// Run with:  forge test --match-path test/Scenarios.t.sol -vvv
contract ScenariosTest is Test {
    VirioSubscriptionManager internal mgr;
    MockUSDC                 internal usdc;

    address internal OWNER     = makeAddr("owner");
    address internal FEE_RECIP = makeAddr("feeRecipient");

    // Two merchants → exercise per-plan merchant isolation
    address internal acmeMerchant   = makeAddr("acme");
    address internal hyperMerchant  = makeAddr("hyper");

    // Five customers
    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave  = makeAddr("dave");
    address internal eve   = makeAddr("eve");

    // Two executor bots → both should successfully charge & earn fees
    address internal botAlpha = makeAddr("botAlpha");
    address internal botBeta  = makeAddr("botBeta");

    address internal stranger = makeAddr("stranger");

    // ─── Plans ────────────────────────────────────────────────────────────────

    struct PlanCfg {
        address merchant;
        uint256 amount;
        uint256 period;
    }

    PlanCfg internal planA = PlanCfg(address(0), 10e6,  30 days);  // Acme Pro
    PlanCfg internal planB = PlanCfg(address(0), 5e6,   7 days);   // Acme Starter
    PlanCfg internal planC = PlanCfg(address(0), 100e6, 1 days);   // Hyper Enterprise
    PlanCfg internal planD = PlanCfg(address(0), 2e6,   1 hours);  // Hyper Compute
    PlanCfg internal planE = PlanCfg(address(0), 50e6,  90 days);  // Acme Quarterly

    bytes32 internal idA;
    bytes32 internal idB;
    bytes32 internal idC;
    bytes32 internal idD;
    bytes32 internal idE;

    uint256 internal constant START_BAL  = 100_000e6; // 100,000 USDC each
    uint16  internal constant EXEC_BPS   = 10;        // global executor fee
    uint16  internal constant PROTO_BPS  = 25;        // global protocol bps
    uint256 internal constant FLAT_FEE   = 1e6;       // global flat protocol fee

    function setUp() public {
        // Wire merchants now that we know the actual addresses
        planA.merchant = acmeMerchant;
        planB.merchant = acmeMerchant;
        planE.merchant = acmeMerchant;
        planC.merchant = hyperMerchant;
        planD.merchant = hyperMerchant;

        vm.startPrank(OWNER);
        usdc = new MockUSDC();
        mgr  = new VirioSubscriptionManager(FEE_RECIP);
        vm.stopPrank();

        // Fund & approve every customer
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

    /// Replicates the contract's global fee math so assertions read clearly.
    function _split(uint256 amount)
        internal pure returns (uint256 execFee, uint256 protoFee, uint256 merchantAmt)
    {
        execFee     = (amount * EXEC_BPS)  / 10_000;
        protoFee    = (amount * PROTO_BPS) / 10_000 + FLAT_FEE;
        merchantAmt = amount - execFee - protoFee;
    }

    // ─── Big scenario sweep ───────────────────────────────────────────────────

    /// Single integration test: 5 plans × 2–3 subs each, multiple executor
    /// charges across time, cancellations, deactivation, cap auto-cancel,
    /// re-subscribe after cancel. Verifies every event and every balance delta.
    function test_fullScenario_sweep() public {
        // ── Subscriptions ────────────────────────────────────────────────────
        // Plan A (Acme Pro): alice (no cap), bob (cap = 3 charges = 30 USDC)
        _subscribe(alice, idA, 0);
        _subscribe(bob,   idA, 3 * planA.amount);

        // Plan B (Acme Starter): alice, carol
        _subscribe(alice, idB, 0);
        _subscribe(carol, idB, 0);

        // Plan C (Hyper Enterprise): bob, dave, eve
        _subscribe(bob,   idC, 0);
        _subscribe(dave,  idC, 0);
        _subscribe(eve,   idC, 0);

        // Plan D (Hyper Compute): carol (no cap), eve (cap = 3 charges = 6 USDC)
        _subscribe(carol, idD, 0);
        _subscribe(eve,   idD, 3 * planD.amount);

        // Plan E (Acme Quarterly): dave (no cap), alice (cap = 2 charges)
        _subscribe(dave,  idE, 0);
        _subscribe(alice, idE, 2 * planE.amount);

        // ── First wave of charges (t=0, every sub just subscribed → due) ─────
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

        // ── Both executor bots should now have earned fees ───────────────────
        assertGt(usdc.balanceOf(botAlpha), 0, "botAlpha earned no fees");
        assertGt(usdc.balanceOf(botBeta),  0, "botBeta earned no fees");

        // ── TooEarlyToCharge across all plans ────────────────────────────────
        bytes32 subId = mgr.computeSubId(idA, alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IVirioSubscriptionManager.TooEarlyToCharge.selector,
                subId,
                block.timestamp + planA.period
            )
        );
        vm.prank(botAlpha);
        mgr.charge(subId);

        // ── Warp forward 1 hour: only Hyper Compute (planD) becomes due ──────
        vm.warp(block.timestamp + 1 hours);
        _chargeAndAssert(carol, idD, planD.amount, botBeta);
        _chargeAndAssert(eve,   idD, planD.amount, botAlpha);

        // planC (1 day period) still too early
        bytes32 bobCid = mgr.computeSubId(idC, bob);
        vm.expectRevert(
            abi.encodeWithSelector(
                IVirioSubscriptionManager.TooEarlyToCharge.selector,
                bobCid,
                _subNextCharge(bobCid)
            )
        );
        vm.prank(botAlpha);
        mgr.charge(bobCid);

        // ── Warp forward 1 day: planC due, planD due again, others still no ─
        vm.warp(block.timestamp + 1 days);
        _chargeAndAssert(bob,   idC, planC.amount, botBeta);
        _chargeAndAssert(dave,  idC, planC.amount, botAlpha);
        _chargeAndAssert(eve,   idC, planC.amount, botBeta);

        // planD is due multiple times over the past 25 hours; one charge per
        // call moves nextChargeAt forward by period — call repeatedly to drain.
        // First, charge carol's D once (she has no cap).
        _chargeAndAssert(carol, idD, planD.amount, botAlpha);

        // eve.D has cap = 3 charges. She's used 2 (t=0 + t=1h). The next charge
        // would put totalSpent at 3 * 2 = 6 USDC == cap (still ≤, no cancel).
        _chargeAndAssert(eve,   idD, planD.amount, botBeta);
        assertTrue(mgr.getSubscription(mgr.computeSubId(idD, eve)).active, "eve.D should still be active");

        // ── Trigger eve.D spend-cap auto-cancel on next charge ───────────────
        bytes32 eveDid = mgr.computeSubId(idD, eve);
        // Don't warp — the sub's nextChargeAt is already < now after 25h passed
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IVirioSubscriptionManager.Cancelled(eveDid, address(mgr));
        vm.prank(botAlpha);
        mgr.charge(eveDid);
        assertFalse(mgr.getSubscription(eveDid).active, "eve.D should be auto-cancelled");

        // ── Customer cancels their own sub ───────────────────────────────────
        bytes32 carolBid = mgr.computeSubId(idB, carol);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IVirioSubscriptionManager.Cancelled(carolBid, carol);
        vm.prank(carol);
        mgr.cancel(carolBid);
        assertFalse(mgr.getSubscription(carolBid).active);

        // ── Merchant cancels a customer's sub ────────────────────────────────
        bytes32 daveCid = mgr.computeSubId(idC, dave);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IVirioSubscriptionManager.Cancelled(daveCid, hyperMerchant);
        vm.prank(hyperMerchant);
        mgr.cancel(daveCid);
        assertFalse(mgr.getSubscription(daveCid).active);

        // ── Stranger tries to cancel — should revert ─────────────────────────
        bytes32 aliceAid = mgr.computeSubId(idA, alice);
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IVirioSubscriptionManager.NotSubscribed.selector, aliceAid
            )
        );
        mgr.cancel(aliceAid);

        // ── Deactivate plan A — existing subs keep charging ─────────────────
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IVirioSubscriptionManager.PlanDeactivated(idA, acmeMerchant);
        vm.prank(acmeMerchant);
        mgr.deactivatePlan(idA);

        // Warp past planA.period and confirm alice.A still chargeable.
        vm.warp(block.timestamp + planA.period);
        _chargeAndAssert(alice, idA, planA.amount, botBeta);

        // ── New subscribe to deactivated plan should revert ──────────────────
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(IVirioSubscriptionManager.PlanNotActive.selector, idA)
        );
        mgr.subscribe(idA, 0);

        // ── bob.A is capped at 3 charges = 30 USDC. We're now 1 period in,
        //    bob already paid 1 × 10 = 10 USDC. We should be able to charge
        //    bob.A two more times before the auto-cancel hits. ───────────────
        bytes32 bobAid = mgr.computeSubId(idA, bob);
        _chargeAndAssert(bob, idA, planA.amount, botAlpha);
        vm.warp(block.timestamp + planA.period);
        _chargeAndAssert(bob, idA, planA.amount, botBeta);

        // 4th charge would put bob over cap (40 > 30) → auto-cancel
        vm.warp(block.timestamp + planA.period);
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IVirioSubscriptionManager.Cancelled(bobAid, address(mgr));
        vm.prank(botAlpha);
        mgr.charge(bobAid);
        assertFalse(mgr.getSubscription(bobAid).active);

        // ── Resubscribe after self-cancel works ──────────────────────────────
        // carol.B was cancelled; she resubscribes (plan B still active since
        // only plan A got deactivated).
        vm.prank(carol);
        mgr.subscribe(idB, 0);
        assertTrue(mgr.getSubscription(carolBid).active);
    }

    // ─── Targeted edge cases (small focused tests) ────────────────────────────

    function test_doubleSubscribe_reverts() public {
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IVirioSubscriptionManager.AlreadySubscribed.selector, sid)
        );
        mgr.subscribe(idA, 0);
    }

    function test_chargeNonExistentSub_reverts() public {
        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.expectRevert(
            abi.encodeWithSelector(IVirioSubscriptionManager.NotSubscribed.selector, sid)
        );
        vm.prank(botAlpha);
        mgr.charge(sid);
    }

    function test_allowanceRevoked_chargeReverts() public {
        _subscribe(alice, idA, 0);
        vm.prank(alice);
        usdc.approve(address(mgr), 0);

        bytes32 sid = mgr.computeSubId(idA, alice);
        vm.prank(botAlpha);
        vm.expectRevert();
        mgr.charge(sid);
    }

    function test_executorIsAnyone_anyAddressCanCharge() public {
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);

        // The stranger has never been authorized — but charge() is permissionless.
        uint256 before = usdc.balanceOf(stranger);
        vm.prank(stranger);
        mgr.charge(sid);
        (uint256 execFee,,) = _split(planA.amount);
        assertEq(usdc.balanceOf(stranger), before + execFee, "stranger earned executor fee");
    }

    function test_lateCharge_additivePeriod_noDrift() public {
        // Anchor at a literal so the compiler can't re-evaluate `block.timestamp` later.
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        _subscribe(alice, idA, 0);
        bytes32 sid = mgr.computeSubId(idA, alice);

        // First charge at t0 → nextChargeAt = t0 + period
        vm.prank(botAlpha);
        mgr.charge(sid);

        // Warp 3 periods ahead (executor was late). One catch-up charge should
        // advance nextChargeAt by exactly one period (not anchor to block.timestamp).
        vm.warp(t0 + 3 * planA.period);
        vm.prank(botAlpha);
        mgr.charge(sid);

        assertEq(
            mgr.getSubscription(sid).nextChargeAt,
            t0 + 2 * planA.period,
            "additive period anchoring"
        );
    }

    function test_subId_isDeterministic() public {
        // Same (plan, customer) pair → same subscription id, regardless of time.
        bytes32 a = mgr.computeSubId(idA, alice);
        vm.warp(block.timestamp + 365 days);
        bytes32 b = mgr.computeSubId(idA, alice);
        assertEq(a, b);
    }

    // ─── Test helpers ─────────────────────────────────────────────────────────

    function _subscribe(address customer, bytes32 planId, uint256 cap) internal {
        bytes32 sid = mgr.computeSubId(planId, customer);
        vm.expectEmit(true, true, true, true, address(mgr));
        emit IVirioSubscriptionManager.Subscribed(sid, planId, customer, cap);
        vm.prank(customer);
        mgr.subscribe(planId, cap);
    }

    function _chargeAndAssert(
        address customer,
        bytes32 planId,
        uint256 amount,
        address executor
    ) internal {
        bytes32 sid = mgr.computeSubId(planId, customer);

        (uint256 execFee, uint256 protoFee, uint256 merchantAmt) = _split(amount);

        IVirioSubscriptionManager.Subscription memory sub = mgr.getSubscription(sid);
        address merchant     = sub.merchant;
        uint256 expectedNext = sub.nextChargeAt + sub.period;

        uint256 mBefore = usdc.balanceOf(merchant);
        uint256 fBefore = usdc.balanceOf(FEE_RECIP);
        uint256 cBefore = usdc.balanceOf(customer);
        uint256 eBefore = usdc.balanceOf(executor);

        vm.expectEmit(true, true, true, true, address(mgr));
        emit IVirioSubscriptionManager.ChargeExecuted(
            sid, executor, customer, amount, merchantAmt, execFee, protoFee, expectedNext
        );
        vm.prank(executor);
        mgr.charge(sid);

        assertEq(usdc.balanceOf(merchant), mBefore + merchantAmt, "merchant balance");
        assertEq(usdc.balanceOf(FEE_RECIP), fBefore + protoFee,   "feeRecipient balance");
        assertEq(usdc.balanceOf(customer), cBefore - amount,      "customer balance");
        assertEq(usdc.balanceOf(executor), eBefore + execFee,     "executor balance");
    }

    function _subNextCharge(bytes32 sid) internal view returns (uint256) {
        return mgr.getSubscription(sid).nextChargeAt;
    }
}
