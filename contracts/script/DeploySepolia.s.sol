// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VirioSubscriptionManager} from "../src/VirioSubscriptionManager.sol";
import {VirioSubscriptionDelegate7702} from "../src/VirioSubscriptionDelegate7702.sol";

/// @notice Sepolia deploy of the subscription stack (no token — reuse existing MockUSDC):
///   1. VirioSubscriptionManager (feeRecipient = the deployer EOA)
///   2. VirioSubscriptionDelegate7702 singleton (EIP-7702 delegation target)
///
///   Run via:  yarn deploy:sepolia:etherscan
contract DeploySepolia is Script {
    function run() external {
        uint256 pk       = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        VirioSubscriptionManager   mgr      = new VirioSubscriptionManager(deployer);
        VirioSubscriptionDelegate7702 delegate = new VirioSubscriptionDelegate7702();
        vm.stopBroadcast();

        console.log("=== Sepolia subscription deploy ===");
        console.log("VirioSubscriptionManager       :", address(mgr));
        console.log("VirioSubscriptionDelegate7702  :", address(delegate));
        console.log("Deployer / feeRecipient        :", deployer);
        console.log("Deployment block               :", block.number);
        console.log("");
        console.log("Paste into packages/dashboard/virio.local.json under contracts:");
        console.log('  "manager":         ', address(mgr));
        console.log('  "delegate":        ', address(delegate));
        console.log('  "feeRecipient":    ', deployer);
        console.log('  "deploymentBlock": ', block.number);
    }
}
