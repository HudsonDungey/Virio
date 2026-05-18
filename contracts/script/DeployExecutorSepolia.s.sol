// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {PulseExecutor}            from "../src/PulseExecutor.sol";
import {IPulseExecutor}           from "../src/interfaces/IPulseExecutor.sol";
import {PulseSubscriptionManager} from "../src/PulseSubscriptionManager.sol";
import {PulsePayrollManager}      from "../src/PulsePayrollManager.sol";

/// Sepolia deploy for PulseExecutor + wiring.
///
/// Env vars:
///   PRIVATE_KEY            — deployer EOA (becomes executor + manager owner).
///   FEE_RECIPIENT          — protocol fee recipient. Defaults to deployer.
///   SUBSCRIPTION_MANAGER   — address of an already-deployed PulseSubscriptionManager.
///                            If unset, a new one is deployed.
///   PAYROLL_MANAGER        — address of an already-deployed PulsePayrollManager.
///                            If unset, a new one is deployed.
///
/// Run via:
///   PRIVATE_KEY=0x... \
///   SUBSCRIPTION_MANAGER=0x... PAYROLL_MANAGER=0x... \
///   forge script script/DeployExecutorSepolia.s.sol --rpc-url sepolia --broadcast -vvvv
contract DeployExecutorSepolia is Script {
    function run() external {
        uint256 pk          = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(pk);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        address subAddr = vm.envOr("SUBSCRIPTION_MANAGER", address(0));
        address payAddr = vm.envOr("PAYROLL_MANAGER",      address(0));

        vm.startBroadcast(pk);

        PulseSubscriptionManager subMgr = subAddr == address(0)
            ? new PulseSubscriptionManager(feeRecipient)
            : PulseSubscriptionManager(subAddr);

        PulsePayrollManager payMgr = payAddr == address(0)
            ? new PulsePayrollManager(feeRecipient)
            : PulsePayrollManager(payAddr);

        PulseExecutor exec = new PulseExecutor(feeRecipient);

        // Register both managers with the executor.
        exec.registerManager(address(subMgr), IPulseExecutor.ManagerKind.Subscription);
        exec.registerManager(address(payMgr), IPulseExecutor.ManagerKind.Payroll);

        // Wire the executor as the trusted caller of charge / payroll on each manager.
        // Only succeeds if the deployer is the owner of both managers — which is the
        // case when this script deploys them in the same broadcast, OR when the
        // caller is the existing owner.
        subMgr.setTrustedExecutor(address(exec));
        payMgr.setTrustedExecutor(address(exec));

        vm.stopBroadcast();

        console.log("=== Sepolia executor deploy ===");
        console.log("PulseExecutor             :", address(exec));
        console.log("PulseSubscriptionManager  :", address(subMgr));
        console.log("PulsePayrollManager       :", address(payMgr));
        console.log("Deployer / owner          :", deployer);
        console.log("Fee recipient             :", feeRecipient);
        console.log("Deployment block          :", block.number);
        console.log("");
        console.log("Tunables (defaults):");
        console.log("  MIN_FEE_BPS   = 10  (0.10%)");
        console.log("  MAX_FEE_BPS   = 30  (0.30%)");
        console.log("  RAMP_DURATION = 2 days");
        console.log("  HEAL_COOLDOWN = 7 days");
        console.log("  BUFFER_SIZE   = 50");
        console.log("");
        console.log("Paste into packages/dashboard/pulse.local.json under contracts:");
        console.log('  "executor":', address(exec));
        console.log('  "subscriptionManager":', address(subMgr));
        console.log('  "payrollManager":', address(payMgr));
    }
}
