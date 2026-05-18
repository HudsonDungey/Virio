// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PulsePayrollManager} from "../src/PulsePayrollManager.sol";

/// Sepolia deploy of the payroll manager.
///   PRIVATE_KEY (env)         — deployer EOA, becomes the owner.
///   FEE_RECIPIENT (env, opt)  — fee collector. Defaults to the deployer.
///
/// Run via:  yarn deploy:payroll:sepolia
contract DeployPayrollSepolia is Script {
    function run() external {
        uint256 pk       = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Prefer explicit FEE_RECIPIENT from env; fall back to deployer if unset.
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast(pk);
        PulsePayrollManager mgr = new PulsePayrollManager(feeRecipient);
        vm.stopBroadcast();

        console.log("=== Sepolia payroll deploy ===");
        console.log("PulsePayrollManager :", address(mgr));
        console.log("Owner / deployer    :", deployer);
        console.log("Fee recipient       :", feeRecipient);
        console.log("Deployment block    :", block.number);
        console.log("");
        console.log("Paste into packages/dashboard/pulse.local.json under contracts:");
        console.log('  "payrollManager": ', address(mgr));
        console.log('  "payrollDeploymentBlock":', block.number);
    }
}
