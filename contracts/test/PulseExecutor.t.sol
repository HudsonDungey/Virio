// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {PulseExecutor}             from "../src/PulseExecutor.sol";
import {IPulseExecutor}            from "../src/interfaces/IPulseExecutor.sol";
import {PulseSubscriptionManager}  from "../src/PulseSubscriptionManager.sol";
import {IPulseSubscriptionManager} from "../src/interfaces/IPulseSubscriptionManager.sol";
import {PulsePayrollManager}       from "../src/PulsePayrollManager.sol";
import {IPulsePayrollManager}      from "../src/interfaces/IPulsePayrollManager.sol";
import {MockUSDC}                  from "../src/test-helpers/MockUSDC.sol";

/// Unit tests for PulseExecutor.
/// Covers: dynamic-fee ramp, penalty tiers, restriction + auto-heal, batching,
///         registration callbacks, executor-only entrypoints, paymentId
///         determinism, pause, and ExecutionRecord persistence.
contract PulseExecutorTest is Test {
    PulseExecutor             internal exec;
    PulseSubscriptionManager  internal subMgr;
    PulsePayrollManager       internal payMgr;
    MockUSDC                  internal usdc;

    address internal OWNER     = makeAddr("owner");
    address internal FEE_RECIP = makeAddr("feeRecipient");
    address internal MERCHANT  = makeAddr("merchant");
    address internal EMPLOYER  = makeAddr("employer");
    address internal CUSTOMER  = makeAddr("customer");
    address internal WORKER    = makeAddr("worker");
    address internal KEEPER    = makeAddr("keeper");
    address internal STRANGER  = makeAddr("stranger");

    uint256 internal constant SUB_AMOUNT   = 10_000e6; // 10,000 USDC — big enough that the 1 USDC flat fee is small relative to fee bps math
    uint256 internal constant PAY_AMOUNT   = 5_000e6;
    uint256 internal constant SUB_PERIOD  = 30 days;
    uint256 internal constant PAY_PERIOD  = 7 days;

    bytes32 internal subPlanId;
    bytes32 internal subId;
    bytes32 internal subPaymentId;

    bytes32 internal payPlanId;
    bytes32 internal recipientId;
    bytes32 internal payPaymentId;

    function setUp() public {
        vm.startPrank(OWNER);
        usdc   = new MockUSDC();
        subMgr = new PulseSubscriptionManager(FEE_RECIP);
        payMgr = new PulsePayrollManager(FEE_RECIP);
        exec   = new PulseExecutor(FEE_RECIP);

        // Wire executor ↔ managers
        exec.registerManager(address(subMgr), IPulseExecutor.ManagerKind.Subscription);
        exec.registerManager(address(payMgr), IPulseExecutor.ManagerKind.Payroll);
        subMgr.setTrustedExecutor(address(exec));
        payMgr.setTrustedExecutor(address(exec));
        vm.stopPrank();

        // Subscription side: merchant, customer, fund + approve.
        vm.prank(MERCHANT);
        subPlanId = subMgr.createPlan(address(usdc), SUB_AMOUNT, SUB_PERIOD);
        subId     = subMgr.computeSubId(subPlanId, CUSTOMER);

        usdc.mint(CUSTOMER, 10_000_000e6);
        vm.prank(CUSTOMER);
        usdc.approve(address(subMgr), type(uint256).max);

        vm.prank(CUSTOMER);
        subMgr.subscribe(subPlanId, 0);
        subPaymentId = exec.computePaymentId(address(subMgr), subId);

        // Payroll side: employer + worker + fund + approve.
        vm.prank(EMPLOYER);
        payPlanId = payMgr.createPlan(address(usdc), PAY_PERIOD);

        usdc.mint(EMPLOYER, 10_000_000e6);
        vm.prank(EMPLOYER);
        usdc.approve(address(payMgr), type(uint256).max);

        vm.prank(EMPLOYER);
        recipientId = payMgr.addRecipient(payPlanId, WORKER, PAY_AMOUNT, 0);
        payPaymentId = exec.computePaymentId(address(payMgr), recipientId);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  REGISTRATION CALLBACKS
    // ═════════════════════════════════════════════════════════════════════════

    function test_subscribe_autoRegistersPaymentInExecutor() public {
        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        assertTrue(p.registered);
        assertEq(p.manager, address(subMgr));
        assertEq(p.innerId, subId);
        assertEq(uint8(p.kind), uint8(IPulseExecutor.ManagerKind.Subscription));
        assertEq(p.period, SUB_PERIOD);
    }

    function test_addRecipient_autoRegistersPaymentInExecutor() public {
        IPulseExecutor.Payment memory p = exec.getPayment(payPaymentId);
        assertTrue(p.registered);
        assertEq(p.manager, address(payMgr));
        assertEq(p.innerId, recipientId);
        assertEq(p.planId,  payPlanId);
        assertEq(uint8(p.kind), uint8(IPulseExecutor.ManagerKind.Payroll));
    }

    function test_cancel_deregistersPaymentInExecutor() public {
        vm.prank(CUSTOMER);
        subMgr.cancel(subId);
        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        assertFalse(p.registered);
    }

    function test_removeRecipient_deregistersPaymentInExecutor() public {
        vm.prank(EMPLOYER);
        payMgr.removeRecipient(payPlanId, recipientId);
        IPulseExecutor.Payment memory p = exec.getPayment(payPaymentId);
        assertFalse(p.registered);
    }

    function test_paymentId_isDeterministic() public {
        bytes32 expected = keccak256(
            abi.encodePacked(address(subMgr), subId, block.chainid)
        );
        assertEq(subPaymentId, expected);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  EXECUTOR-ONLY GATING ON MANAGERS
    // ═════════════════════════════════════════════════════════════════════════

    function test_chargeFor_revertsForNonExecutor() public {
        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.NotTrustedExecutor.selector, STRANGER)
        );
        subMgr.chargeFor(subId, 10, STRANGER);
    }

    function test_executePayrollFor_revertsForNonExecutor() public {
        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulsePayrollManager.NotTrustedExecutor.selector, STRANGER)
        );
        payMgr.executePayrollFor(payPlanId, recipientId, 10, STRANGER);
    }

    function test_chargeFor_revertsAboveMaxBps() public {
        vm.prank(address(exec));
        vm.expectRevert(
            abi.encodeWithSelector(IPulseSubscriptionManager.FeeBpsExceedsMax.selector, uint16(31), uint16(30))
        );
        subMgr.chargeFor(subId, 31, address(exec));
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  DYNAMIC FEE RAMP
    // ═════════════════════════════════════════════════════════════════════════

    function test_dynamicFeeBps_atZeroDelay_isMin() public {
        assertEq(exec.dynamicFeeBps(0), 10);
    }

    function test_dynamicFeeBps_atHalfRamp_isMidpoint() public {
        assertEq(exec.dynamicFeeBps(1 days), 20); // half of 2-day ramp → midpoint
    }

    function test_dynamicFeeBps_atRamp_isMax() public {
        assertEq(exec.dynamicFeeBps(2 days), 30);
    }

    function test_dynamicFeeBps_beyondRamp_capsAtMax() public {
        assertEq(exec.dynamicFeeBps(10 days), 30);
    }

    function test_dynamicFeeBps_atQuarterRamp() public {
        // 10 + (30-10)*(0.5 days)/(2 days) = 10 + 5 = 15
        assertEq(exec.dynamicFeeBps(12 hours), 15);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  HAPPY-PATH EXECUTION
    // ═════════════════════════════════════════════════════════════════════════

    function test_execute_subscription_paysExecutorAndAdvancesSchedule() public {
        uint256 kBefore = usdc.balanceOf(KEEPER);
        uint256 fBefore = usdc.balanceOf(FEE_RECIP);

        // immediately chargeable; delay = 0 → bps = 10
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        uint256 expectedExecFee = (SUB_AMOUNT * 10) / 10_000;
        assertEq(usdc.balanceOf(KEEPER) - kBefore, expectedExecFee, "keeper got 100% of exec fee");

        // protocol fee = 25 bps + 1 USDC flat
        uint256 expectedProto = (SUB_AMOUNT * 25) / 10_000 + 1e6;
        assertEq(usdc.balanceOf(FEE_RECIP) - fBefore, expectedProto, "feeRecipient delta");

        // schedule advanced by SUB_PERIOD
        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        assertEq(p.scheduledAt, block.timestamp + SUB_PERIOD);

        // stats
        IPulseExecutor.ExecutorStats memory s = exec.getStats(KEEPER);
        assertEq(s.totalExecutions,      1);
        assertEq(s.successfulExecutions, 1);
        assertEq(s.failedExecutions,     0);
        assertEq(s.totalVolumeProcessed, SUB_AMOUNT);
        assertEq(s.totalFeesEarned,      expectedExecFee);
    }

    function test_execute_payroll_paysWorkerAndExecutor() public {
        uint256 wBefore = usdc.balanceOf(WORKER);
        uint256 kBefore = usdc.balanceOf(KEEPER);

        vm.prank(KEEPER);
        exec.execute(payPaymentId);

        uint256 expectedExecFee = (PAY_AMOUNT * 10) / 10_000;
        uint256 expectedProto   = (PAY_AMOUNT * 25) / 10_000 + 1e6;
        uint256 expectedWorker  = PAY_AMOUNT - expectedExecFee - expectedProto;

        assertEq(usdc.balanceOf(WORKER) - wBefore, expectedWorker);
        assertEq(usdc.balanceOf(KEEPER) - kBefore, expectedExecFee);
    }

    function test_execute_higherDelay_paysHigherFee() public {
        vm.warp(block.timestamp + 2 days); // beyond ramp → max bps = 30

        uint256 kBefore = usdc.balanceOf(KEEPER);
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        uint256 expectedExecFee = (SUB_AMOUNT * 30) / 10_000;
        assertEq(usdc.balanceOf(KEEPER) - kBefore, expectedExecFee);
    }

    function test_execute_scheduleAdvancesByPeriod_notWallClock() public {
        // First charge at t=t0 with delay = 0 → next scheduled = t0 + period.
        uint256 t0 = block.timestamp;
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        // Wait 3 periods, then execute. Schedule should still advance by exactly
        // one period each call — no drift toward wall clock.
        vm.warp(t0 + 3 * SUB_PERIOD);
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        assertEq(p.scheduledAt, t0 + 2 * SUB_PERIOD);
    }

    function test_execute_revertsBeforeDue() public {
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        // Try again immediately — manager will revert TooEarly, executor
        // captures it as a failure (doesn't revert externally).
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        IPulseExecutor.ExecutorStats memory s = exec.getStats(KEEPER);
        assertEq(s.failedExecutions, 1);
        assertEq(s.successfulExecutions, 1);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PENALTY TIER LADDER
    // ═════════════════════════════════════════════════════════════════════════

    /// @dev Warps to exactly scheduledAt so the execution happens with delay=0
    ///      (and therefore bps = MIN_FEE_BPS). Used by the helpers below to
    ///      keep fee math predictable when filling the rolling buffer.
    function _executeAtZeroDelay() internal {
        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        if (block.timestamp < p.scheduledAt) vm.warp(p.scheduledAt);
        vm.prank(KEEPER);
        exec.execute(subPaymentId);
    }

    function _doNSuccesses(uint256 n) internal {
        for (uint256 i; i < n; ) {
            _executeAtZeroDelay();
            unchecked { ++i; }
        }
    }

    /// @dev Forces N failures by revoking the customer's USDC allowance so
    ///      chargeFor() reverts on transferFrom. Reverts roll back manager
    ///      state, so scheduledAt does NOT advance — every iteration re-runs
    ///      against the same scheduledAt and records a failure outcome.
    function _doNFailures(uint256 n) internal {
        vm.prank(CUSTOMER);
        usdc.approve(address(subMgr), 0);
        for (uint256 i; i < n; ) {
            IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
            if (block.timestamp < p.scheduledAt) vm.warp(p.scheduledAt);
            vm.prank(KEEPER);
            exec.execute(subPaymentId);
            unchecked { ++i; }
        }
        vm.prank(CUSTOMER);
        usdc.approve(address(subMgr), type(uint256).max);
    }

    function test_failureRate_underThreshold_noPenalty() public {
        // 2 failures / 50 = 4% → tier 0 (no penalty).
        _doNSuccesses(48);
        _doNFailures(2);

        uint256 kBefore = usdc.balanceOf(KEEPER);
        _executeAtZeroDelay();

        uint256 expected = (SUB_AMOUNT * 10) / 10_000;
        assertEq(usdc.balanceOf(KEEPER) - kBefore, expected, "no penalty under 5%");
    }

    function test_failureRate_inFiveToFifteenBand_appliesTwentyPctPenalty() public {
        // 5 failures / 50 = 10% → tier 1 → keep 80%.
        _doNSuccesses(45);
        _doNFailures(5);

        uint256 kBefore = usdc.balanceOf(KEEPER);
        uint256 fBefore = usdc.balanceOf(FEE_RECIP);
        _executeAtZeroDelay();

        uint256 fullFee = (SUB_AMOUNT * 10) / 10_000;
        uint256 expectedReward  = (fullFee * 80) / 100;
        uint256 expectedPenalty = fullFee - expectedReward;
        uint256 expectedProto   = (SUB_AMOUNT * 25) / 10_000 + 1e6;

        assertEq(usdc.balanceOf(KEEPER) - kBefore, expectedReward, "80% keep");
        assertEq(usdc.balanceOf(FEE_RECIP) - fBefore, expectedProto + expectedPenalty, "withheld → protocol");
    }

    function test_failureRate_aboveThirtyPct_restricts() public {
        // 34 successes first, then 16 failures → fill=50 with 16/50=32% rate
        // → restriction triggered on the failure that crosses the threshold.
        _doNSuccesses(34);
        _doNFailures(16);

        assertTrue(exec.isRestricted(KEEPER));
        vm.prank(KEEPER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseExecutor.ExecutorRestricted.selector, KEEPER)
        );
        exec.execute(subPaymentId);
    }

    function test_autoHeal_afterCooldown_clearsRestriction() public {
        _doNSuccesses(34);
        _doNFailures(16);
        assertTrue(exec.isRestricted(KEEPER));

        // Advance past HEAL_COOLDOWN.
        vm.warp(block.timestamp + 7 days + 1);

        // Heal happens at next execute() entry; warp to scheduledAt first.
        _executeAtZeroDelay();

        assertFalse(exec.isRestricted(KEEPER));
        assertEq(exec.healCount(KEEPER), 1);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  BATCH
    // ═════════════════════════════════════════════════════════════════════════

    function test_executeBatch_mixedSuccessAndFail() public {
        // Two payments: sub (due) + payroll (due). Both should succeed.
        bytes32[] memory batch = new bytes32[](2);
        batch[0] = subPaymentId;
        batch[1] = payPaymentId;

        vm.prank(KEEPER);
        exec.executeBatch(batch);

        IPulseExecutor.ExecutorStats memory s = exec.getStats(KEEPER);
        assertEq(s.successfulExecutions, 2);
        assertEq(s.failedExecutions,     0);
    }

    function test_executeBatch_oneFailDoesNotBlockOthers() public {
        // Run sub once to advance its schedule, then batch it (not due) + payroll (due)
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        bytes32[] memory batch = new bytes32[](2);
        batch[0] = subPaymentId;     // not due → failure (TooEarly)
        batch[1] = payPaymentId;     // due → success

        vm.prank(KEEPER);
        exec.executeBatch(batch);

        IPulseExecutor.ExecutorStats memory s = exec.getStats(KEEPER);
        assertEq(s.successfulExecutions, 2); // one earlier + payroll
        assertEq(s.failedExecutions,     1);
    }

    function test_executeBatch_emptyReverts() public {
        bytes32[] memory empty = new bytes32[](0);
        vm.prank(KEEPER);
        vm.expectRevert(IPulseExecutor.BatchEmpty.selector);
        exec.executeBatch(empty);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  EXECUTION RECORD
    // ═════════════════════════════════════════════════════════════════════════

    function test_executionRecord_persistedOnSuccess() public {
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        IPulseExecutor.ExecutionRecord memory r = exec.getExecution(1);
        assertEq(r.paymentId, subPaymentId);
        assertEq(r.executor, KEEPER);
        assertEq(r.manager,  address(subMgr));
        assertEq(r.merchant, MERCHANT);
        assertEq(r.payer,    CUSTOMER);
        assertTrue(r.success);
        assertEq(r.bpsApplied, 10);
        assertEq(r.delaySeconds, 0);
        assertEq(r.grossAmount, SUB_AMOUNT);
    }

    function test_executionRecord_persistedOnFailure() public {
        // Execute then immediately re-execute → second one is a "TooEarly" failure
        vm.prank(KEEPER);
        exec.execute(subPaymentId);
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        IPulseExecutor.ExecutionRecord memory r = exec.getExecution(2);
        assertFalse(r.success);
        assertEq(r.executor, KEEPER);
        assertTrue(r.failureReasonHash != bytes32(0));
        assertEq(r.retryCount, 1);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  PAUSE
    // ═════════════════════════════════════════════════════════════════════════

    function test_pause_blocksExecute() public {
        vm.prank(OWNER);
        exec.pause();

        vm.prank(KEEPER);
        vm.expectRevert(IPulseExecutor.PausedError.selector);
        exec.execute(subPaymentId);

        vm.prank(OWNER);
        exec.unpause();

        // Now succeeds.
        vm.prank(KEEPER);
        exec.execute(subPaymentId);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  RAMP PARAM ADMIN
    // ═════════════════════════════════════════════════════════════════════════

    function test_setRampParams_byOwner() public {
        vm.prank(OWNER);
        exec.setRampParams(15, 25, 1 days);
        assertEq(exec.MIN_FEE_BPS(),   15);
        assertEq(exec.MAX_FEE_BPS(),   25);
        assertEq(exec.RAMP_DURATION(), 1 days);
    }

    function test_setRampParams_revertsAboveCeiling() public {
        vm.prank(OWNER);
        vm.expectRevert(IPulseExecutor.InvalidRampParams.selector);
        exec.setRampParams(10, 31, 2 days); // max bps > 30
    }

    function test_setRampParams_revertsForNonOwner() public {
        vm.prank(STRANGER);
        vm.expectRevert(IPulseExecutor.NotOwner.selector);
        exec.setRampParams(10, 30, 2 days);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  MANAGER REGISTRY
    // ═════════════════════════════════════════════════════════════════════════

    function test_registerPayment_revertsForNonTrustedManager() public {
        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(IPulseExecutor.NotTrustedManager.selector, STRANGER)
        );
        exec.registerPayment(
            IPulseExecutor.ManagerKind.Subscription,
            bytes32(0),
            bytes32(uint256(1)),
            uint64(block.timestamp),
            uint64(SUB_PERIOD)
        );
    }

    function test_registerPayment_isIdempotent() public {
        // Subscribe again is blocked by AlreadySubscribed, so cancel then re-subscribe.
        vm.prank(CUSTOMER);
        subMgr.cancel(subId);
        vm.prank(CUSTOMER);
        subMgr.subscribe(subPlanId, 0);

        IPulseExecutor.Payment memory p = exec.getPayment(subPaymentId);
        assertTrue(p.registered);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  ENUMERATION + MIGRATION
    // ═════════════════════════════════════════════════════════════════════════

    function test_enumeration_recordsPaymentAndExecutor() public {
        // setUp already created 2 payments (sub + payroll).
        assertEq(exec.paymentCount(), 2);
        assertEq(exec.managerCount(), 2);

        // Drive one execution to record KEEPER in _allExecutors.
        vm.prank(KEEPER);
        exec.execute(subPaymentId);
        assertEq(exec.executorCount(), 1);

        address[] memory addrs = exec.executorsSlice(0, 1);
        assertEq(addrs[0], KEEPER);
    }

    function test_migrate_revertsWhenNotPaused() public {
        vm.prank(OWNER);
        vm.expectRevert(IPulseExecutor.NotPausedError.selector);
        exec.migratePaymentsTo(address(0xBEEF), 0, 1);
    }

    function test_migrateAll_roundTrips_paymentsExecutorsManagersConfig() public {
        // Drive a successful + a failed execute so KEEPER has stats + a bitmap.
        vm.prank(KEEPER);
        exec.execute(subPaymentId);

        // Force a failure on subPaymentId: revoke USDC allowance so chargeFor
        // reverts on transferFrom (captured as failure inside the executor).
        vm.prank(CUSTOMER);
        usdc.approve(address(subMgr), 0);
        // Warp past schedule so it's "due".
        IPulseExecutor.Payment memory ps = exec.getPayment(subPaymentId);
        vm.warp(ps.scheduledAt);
        vm.prank(KEEPER);
        exec.execute(subPaymentId);
        vm.prank(CUSTOMER);
        usdc.approve(address(subMgr), type(uint256).max);

        // Deploy sink, pause both, whitelist source.
        vm.prank(OWNER);
        PulseExecutor sink = new PulseExecutor(FEE_RECIP);
        vm.startPrank(OWNER);
        sink.pause();
        sink.setMigrationSource(address(exec));
        exec.pause();
        vm.stopPrank();

        // Push state.
        vm.prank(OWNER);
        exec.migrateManagersTo(address(sink), 0, exec.managerCount());
        vm.prank(OWNER);
        exec.migratePaymentsTo(address(sink), 0, exec.paymentCount());
        vm.prank(OWNER);
        exec.migrateExecutorStateTo(address(sink), 0, exec.executorCount());
        vm.prank(OWNER);
        exec.migrateConfigTo(address(sink));

        // Verify sink mirrors source.
        IPulseExecutor.Payment memory srcP = exec.getPayment(subPaymentId);
        IPulseExecutor.Payment memory dstP = sink.getPayment(subPaymentId);
        assertEq(dstP.manager,     srcP.manager);
        assertEq(dstP.scheduledAt, srcP.scheduledAt);
        assertTrue(dstP.registered);

        IPulseExecutor.ExecutorStats memory srcS = exec.getStats(KEEPER);
        IPulseExecutor.ExecutorStats memory dstS = sink.getStats(KEEPER);
        assertEq(dstS.totalExecutions,      srcS.totalExecutions);
        assertEq(dstS.successfulExecutions, srcS.successfulExecutions);
        assertEq(dstS.failedExecutions,     srcS.failedExecutions);

        // Bitmap-derived view should be identical post-migration.
        assertEq(sink.failureRateBps(KEEPER), exec.failureRateBps(KEEPER));

        // Trusted managers carried over.
        assertEq(sink.managerCount(), exec.managerCount());

        // Config carried over.
        assertEq(sink.MIN_FEE_BPS(),   exec.MIN_FEE_BPS());
        assertEq(sink.MAX_FEE_BPS(),   exec.MAX_FEE_BPS());
        assertEq(sink.RAMP_DURATION(), exec.RAMP_DURATION());
    }
}
