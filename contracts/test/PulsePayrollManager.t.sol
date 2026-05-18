// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PulsePayrollManager} from "../src/PulsePayrollManager.sol";
import {IPulsePayrollManager} from "../src/interfaces/IPulsePayrollManager.sol";
import {IPulseExecutor} from "../src/interfaces/IPulseExecutor.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";

/// Unit tests for PulsePayrollManager. executePayrollFor / executePayrollBatchFor
/// are executor-only, so the test contract is wired as the trustedExecutor and
/// drives the calls directly. The executor fee is routed to KEEPER (the payee
/// address the router would use in production).
contract PulsePayrollManagerTest is Test {
    PulsePayrollManager internal mgr;
    MockUSDC            internal usdc;

    address internal OWNER    = makeAddr("owner");
    address internal FEE_REC  = makeAddr("feeRecipient");
    address internal EMPLOYER = makeAddr("employer");
    address internal STRANGER = makeAddr("stranger");
    address internal KEEPER   = makeAddr("keeper");

    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave  = makeAddr("dave");

    uint256 constant PERIOD       = 7 days;
    uint256 constant ALICE_AMOUNT = 1_000e6; // 1,000 USDC / week
    uint256 constant BOB_AMOUNT   = 800e6;
    uint256 constant CAROL_AMOUNT = 1_200e6;
    uint256 constant DAVE_AMOUNT  = 600e6;

    // Fee math (matches contract globals: 10 bps exec via ramp min, 25 bps proto, 1 USDC flat)
    uint16  constant EXEC_BPS  = 10;
    uint16  constant PROTO_BPS = 25;
    uint256 constant FLAT_FEE  = 1e6;

    bytes32 internal planId;

    function setUp() public {
        vm.prank(OWNER);
        usdc = new MockUSDC();

        vm.prank(OWNER);
        mgr = new PulsePayrollManager(FEE_REC);

        // Test contract is the trusted executor for these unit tests.
        vm.prank(OWNER);
        mgr.setTrustedExecutor(address(this));

        usdc.mint(EMPLOYER, 1_000_000e6);
        vm.prank(EMPLOYER);
        usdc.approve(address(mgr), type(uint256).max);

        vm.prank(EMPLOYER);
        planId = mgr.createPlan(address(usdc), PERIOD);
    }

    function _split(uint256 amount)
        internal pure returns (uint256 execFee, uint256 proto, uint256 net)
    {
        execFee = (amount * EXEC_BPS)  / 10_000;
        proto   = (amount * PROTO_BPS) / 10_000 + FLAT_FEE;
        net     = amount - execFee - proto;
    }

    function _execPay(bytes32 rid) internal {
        mgr.executePayrollFor(planId, rid, EXEC_BPS, KEEPER);
    }

    /// @dev IPulseExecutor stub for the manager's register/deregister callbacks.
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

    // ─── createPlan ───────────────────────────────────────────────────────────

    function test_createPlan_emitsEvent() public {
        bytes32 expected = keccak256(abi.encodePacked(EMPLOYER, uint256(2), block.chainid));
        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulsePayrollManager.PlanCreated(expected, EMPLOYER, address(usdc), PERIOD);
        vm.prank(EMPLOYER);
        mgr.createPlan(address(usdc), PERIOD);
    }

    function test_createPlan_revertsOnZeroPeriod() public {
        vm.prank(EMPLOYER);
        vm.expectRevert(IPulsePayrollManager.InvalidPeriod.selector);
        mgr.createPlan(address(usdc), 0);
    }

    function test_createPlan_revertsOnZeroToken() public {
        vm.prank(EMPLOYER);
        vm.expectRevert(IPulsePayrollManager.ZeroAddress.selector);
        mgr.createPlan(address(0), PERIOD);
    }

    // ─── deactivatePlan ───────────────────────────────────────────────────────

    function test_deactivatePlan_byEmployer() public {
        vm.expectEmit(true, true, false, false, address(mgr));
        emit IPulsePayrollManager.PlanDeactivated(planId, EMPLOYER);
        vm.prank(EMPLOYER);
        mgr.deactivatePlan(planId);
        assertFalse(mgr.getPlan(planId).active);
    }

    function test_deactivatePlan_revertsForStranger() public {
        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.UnauthorizedEmployer.selector, planId)
        );
        mgr.deactivatePlan(planId);
    }

    function test_deactivatePlan_blocksNewRecipients() public {
        vm.prank(EMPLOYER);
        mgr.deactivatePlan(planId);

        vm.prank(EMPLOYER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.PlanNotActive.selector, planId)
        );
        mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
    }

    // ─── addRecipient ─────────────────────────────────────────────────────────

    function test_addRecipient_setsState() public {
        bytes32 expectedRid = mgr.computeRecipientId(planId, alice);

        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulsePayrollManager.RecipientAdded(planId, expectedRid, alice, ALICE_AMOUNT, 0);
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        assertEq(rid, expectedRid);
        IPulsePayrollManager.Recipient memory r = mgr.getRecipient(planId, rid);
        assertEq(r.wallet, alice);
        assertEq(r.amount, ALICE_AMOUNT);
        assertEq(r.totalPaid, 0);
        assertEq(r.spendCap, 0);
        assertTrue(r.active);
    }

    function test_addRecipient_revertsOnDuplicate() public {
        vm.startPrank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.RecipientAlreadyExists.selector, rid)
        );
        mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        vm.stopPrank();
    }

    function test_addRecipient_revertsOnZeroAmount() public {
        vm.prank(EMPLOYER);
        vm.expectRevert(IPulsePayrollManager.InvalidAmount.selector);
        mgr.addRecipient(planId, alice, 0, 0);
    }

    // ─── addRecipientsBatch ──────────────────────────────────────────────────

    function test_addRecipientsBatch_addsAll() public {
        address[] memory wallets = new address[](3);
        uint256[] memory amounts = new uint256[](3);
        uint256[] memory caps    = new uint256[](3);
        (wallets[0], amounts[0], caps[0]) = (alice, ALICE_AMOUNT, 0);
        (wallets[1], amounts[1], caps[1]) = (bob,   BOB_AMOUNT,   0);
        (wallets[2], amounts[2], caps[2]) = (carol, CAROL_AMOUNT, 0);

        vm.prank(EMPLOYER);
        bytes32[] memory rids = mgr.addRecipientsBatch(planId, wallets, amounts, caps);
        assertEq(rids.length, 3);
        assertEq(mgr.getPlanRecipientIds(planId).length, 3);
    }

    function test_addRecipientsBatch_revertsOnLengthMismatch() public {
        address[] memory wallets = new address[](2);
        uint256[] memory amounts = new uint256[](3);
        uint256[] memory caps    = new uint256[](2);
        wallets[0] = alice; wallets[1] = bob;
        amounts[0] = ALICE_AMOUNT; amounts[1] = BOB_AMOUNT; amounts[2] = CAROL_AMOUNT;

        vm.prank(EMPLOYER);
        vm.expectRevert(IPulsePayrollManager.ArrayLengthMismatch.selector);
        mgr.addRecipientsBatch(planId, wallets, amounts, caps);
    }

    // ─── executePayrollFor (single) ──────────────────────────────────────────

    function test_executePayrollFor_balanceDeltasAndEvent() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        (uint256 execFee, uint256 proto, uint256 net) = _split(ALICE_AMOUNT);

        uint256 eBefore = usdc.balanceOf(EMPLOYER);
        uint256 aBefore = usdc.balanceOf(alice);
        uint256 fBefore = usdc.balanceOf(FEE_REC);
        uint256 kBefore = usdc.balanceOf(KEEPER);

        vm.expectEmit(true, true, true, true, address(mgr));
        emit IPulsePayrollManager.PayrollExecuted(
            planId, rid, KEEPER, alice, ALICE_AMOUNT, net, execFee, proto, block.timestamp + PERIOD
        );
        _execPay(rid);

        assertEq(usdc.balanceOf(EMPLOYER), eBefore - ALICE_AMOUNT, "employer");
        assertEq(usdc.balanceOf(alice),    aBefore + net,          "recipient");
        assertEq(usdc.balanceOf(FEE_REC),  fBefore + proto,        "feeRecipient");
        assertEq(usdc.balanceOf(KEEPER),   kBefore + execFee,      "keeper");
    }

    function test_executePayrollFor_revertsIfTooEarly() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        _execPay(rid);

        vm.expectRevert(
            abi.encodeWithSelector(
                IPulsePayrollManager.TooEarlyToPay.selector, rid, block.timestamp + PERIOD
            )
        );
        _execPay(rid);
    }

    function test_executePayrollFor_revertsForNonExecutor() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.NotTrustedExecutor.selector, STRANGER)
        );
        mgr.executePayrollFor(planId, rid, EXEC_BPS, KEEPER);
    }

    function test_executePayrollFor_revertsAboveMaxBps() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.FeeBpsExceedsMax.selector, uint16(31), uint16(30))
        );
        mgr.executePayrollFor(planId, rid, 31, KEEPER);
    }

    function test_executePayrollFor_autoRemovesOnCapExceeded() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, ALICE_AMOUNT);

        _execPay(rid);

        vm.warp(block.timestamp + PERIOD);

        vm.expectEmit(true, true, true, false, address(mgr));
        emit IPulsePayrollManager.RecipientRemoved(planId, rid, address(mgr));
        _execPay(rid);

        assertFalse(mgr.getRecipient(planId, rid).active);
    }

    // ─── executePayrollBatchFor ───────────────────────────────────────────────

    function test_executePayrollBatchFor_paysAllAndEmitsBatchEvent() public {
        address[] memory wallets = new address[](4);
        uint256[] memory amounts = new uint256[](4);
        uint256[] memory caps    = new uint256[](4);
        (wallets[0], amounts[0], caps[0]) = (alice, ALICE_AMOUNT, 0);
        (wallets[1], amounts[1], caps[1]) = (bob,   BOB_AMOUNT,   0);
        (wallets[2], amounts[2], caps[2]) = (carol, CAROL_AMOUNT, 0);
        (wallets[3], amounts[3], caps[3]) = (dave,  DAVE_AMOUNT,  0);

        vm.prank(EMPLOYER);
        bytes32[] memory rids = mgr.addRecipientsBatch(planId, wallets, amounts, caps);

        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulsePayrollManager.BatchPayrollExecuted(planId, KEEPER, 4, 0);
        mgr.executePayrollBatchFor(planId, rids, EXEC_BPS, KEEPER);

        (, , uint256 aliceNet) = _split(ALICE_AMOUNT);
        (, , uint256 bobNet)   = _split(BOB_AMOUNT);
        assertEq(usdc.balanceOf(alice), aliceNet);
        assertEq(usdc.balanceOf(bob),   bobNet);
    }

    function test_executePayrollBatchFor_partialFailDoesNotBlockOthers() public {
        address[] memory wallets = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        uint256[] memory caps    = new uint256[](2);
        (wallets[0], amounts[0], caps[0]) = (alice, ALICE_AMOUNT, 0);
        (wallets[1], amounts[1], caps[1]) = (bob,   BOB_AMOUNT,   0);

        vm.prank(EMPLOYER);
        bytes32[] memory rids = mgr.addRecipientsBatch(planId, wallets, amounts, caps);

        bytes32[] memory batch = new bytes32[](3);
        batch[0] = rids[0];
        batch[1] = keccak256("nonexistent");
        batch[2] = rids[1];

        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulsePayrollManager.BatchPayrollExecuted(planId, KEEPER, 2, 1);
        mgr.executePayrollBatchFor(planId, batch, EXEC_BPS, KEEPER);

        (, , uint256 aliceNet) = _split(ALICE_AMOUNT);
        (, , uint256 bobNet)   = _split(BOB_AMOUNT);
        assertEq(usdc.balanceOf(alice), aliceNet);
        assertEq(usdc.balanceOf(bob),   bobNet);
    }

    function test_executePayrollBatchFor_revertsIfPlanInactive() public {
        vm.prank(EMPLOYER);
        mgr.deactivatePlan(planId);

        bytes32[] memory empty = new bytes32[](0);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.PlanNotActive.selector, planId)
        );
        mgr.executePayrollBatchFor(planId, empty, EXEC_BPS, KEEPER);
    }

    // ─── removeRecipient ──────────────────────────────────────────────────────

    function test_removeRecipient_byEmployer() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.expectEmit(true, true, false, true, address(mgr));
        emit IPulsePayrollManager.RecipientRemoved(planId, rid, EMPLOYER);
        vm.prank(EMPLOYER);
        mgr.removeRecipient(planId, rid);

        assertFalse(mgr.getRecipient(planId, rid).active);
        assertEq(mgr.getPlanRecipientIds(planId).length, 0);
    }

    function test_removeRecipient_revertsForStranger() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.UnauthorizedEmployer.selector, planId)
        );
        mgr.removeRecipient(planId, rid);
    }

    function test_remove_thenReadd_resetsTotals() public {
        vm.startPrank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        vm.stopPrank();

        _execPay(rid);
        vm.prank(EMPLOYER);
        mgr.removeRecipient(planId, rid);

        vm.prank(EMPLOYER);
        mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        assertEq(mgr.getRecipient(planId, rid).totalPaid, 0, "totals should reset on re-add");
    }

    // ─── updateRecipient ──────────────────────────────────────────────────────

    function test_updateRecipient_changesAmountAndCap() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.prank(EMPLOYER);
        mgr.updateRecipient(planId, rid, 2_000e6, 10_000e6);

        IPulsePayrollManager.Recipient memory r = mgr.getRecipient(planId, rid);
        assertEq(r.amount, 2_000e6);
        assertEq(r.spendCap, 10_000e6);
    }

    function test_updateRecipient_revertsOnZeroAmount() public {
        vm.prank(EMPLOYER);
        bytes32 rid = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);

        vm.prank(EMPLOYER);
        vm.expectRevert(IPulsePayrollManager.InvalidAmount.selector);
        mgr.updateRecipient(planId, rid, 0, 0);
    }

    // ─── owner-only setters ───────────────────────────────────────────────────

    function test_setProtocolFeeBps_onlyOwner() public {
        vm.prank(OWNER);
        mgr.setProtocolFeeBps(50);
        assertEq(mgr.protocolFeeBps(), 50);

        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setProtocolFeeBps(50);
    }

    function test_setProtocolFlatFee_onlyOwner() public {
        vm.prank(OWNER);
        mgr.setProtocolFlatFee(5e6);
        assertEq(mgr.protocolFlatFee(), 5e6);

        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setProtocolFlatFee(5e6);
    }

    function test_setTrustedExecutor_onlyOwner() public {
        vm.prank(OWNER);
        mgr.setTrustedExecutor(KEEPER);
        assertEq(mgr.trustedExecutor(), KEEPER);

        vm.prank(STRANGER);
        vm.expectRevert("Pulse: not owner");
        mgr.setTrustedExecutor(address(this));
    }

    // ─── getDueRecipients ────────────────────────────────────────────────────

    function test_getDueRecipients_returnsOnlyDue() public {
        vm.startPrank(EMPLOYER);
        bytes32 rA = mgr.addRecipient(planId, alice, ALICE_AMOUNT, 0);
        bytes32 rB = mgr.addRecipient(planId, bob,   BOB_AMOUNT,   0);
        vm.stopPrank();

        _execPay(rA);

        bytes32[] memory due = mgr.getDueRecipients(planId);
        assertEq(due.length, 1);
        assertEq(due[0], rB);
    }
}
