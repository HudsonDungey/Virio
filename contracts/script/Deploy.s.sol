// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";
import {PulseSubscriptionManager} from "../src/PulseSubscriptionManager.sol";
import {PulsePayrollManager}      from "../src/PulsePayrollManager.sol";
import {PulseExecutor}            from "../src/PulseExecutor.sol";
import {IPulseExecutor}           from "../src/interfaces/IPulseExecutor.sol";

/// @notice Local-anvil deploy:
///   1. Deploy MockUSDC
///   2. Deploy PulseSubscriptionManager + PulsePayrollManager
///   3. Deploy PulseExecutor and wire it as the trusted executor on both
///   4. Mint USDC to anvil[0..4] and have each approve both managers for max
///
///   Run with:
///     anvil --host 127.0.0.1 &
///     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
///         --broadcast --skip-simulation
contract Deploy is Script {
    // Standard anvil private keys.
    uint256 constant PK_0 = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    uint256 constant PK_1 = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d;
    uint256 constant PK_2 = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
    uint256 constant PK_3 = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6;
    uint256 constant PK_4 = 0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a;

    uint256 constant INITIAL_MINT = 10_000 * 1e6; // 10 000 USDC (6 decimals)

    function run() external {
        address deployer = vm.addr(PK_0);
        address user1    = vm.addr(PK_1);
        address user2    = vm.addr(PK_2);
        address user3    = vm.addr(PK_3);
        address user4    = vm.addr(PK_4);

        vm.startBroadcast(PK_0);

        MockUSDC                 usdc   = new MockUSDC();
        PulseSubscriptionManager subMgr = new PulseSubscriptionManager(deployer);
        PulsePayrollManager      payMgr = new PulsePayrollManager(deployer);
        PulseExecutor            exec   = new PulseExecutor(deployer);

        exec.registerManager(address(subMgr), IPulseExecutor.ManagerKind.Subscription);
        exec.registerManager(address(payMgr), IPulseExecutor.ManagerKind.Payroll);
        subMgr.setTrustedExecutor(address(exec));
        payMgr.setTrustedExecutor(address(exec));

        usdc.mint(deployer, INITIAL_MINT);
        usdc.mint(user1,    INITIAL_MINT);
        usdc.mint(user2,    INITIAL_MINT);
        usdc.mint(user3,    INITIAL_MINT);
        usdc.mint(user4,    INITIAL_MINT);

        usdc.approve(address(subMgr), type(uint256).max);
        usdc.approve(address(payMgr), type(uint256).max);

        vm.stopBroadcast();

        vm.startBroadcast(PK_1);
        usdc.approve(address(subMgr), type(uint256).max);
        usdc.approve(address(payMgr), type(uint256).max);
        vm.stopBroadcast();
        vm.startBroadcast(PK_2);
        usdc.approve(address(subMgr), type(uint256).max);
        usdc.approve(address(payMgr), type(uint256).max);
        vm.stopBroadcast();
        vm.startBroadcast(PK_3);
        usdc.approve(address(subMgr), type(uint256).max);
        usdc.approve(address(payMgr), type(uint256).max);
        vm.stopBroadcast();
        vm.startBroadcast(PK_4);
        usdc.approve(address(subMgr), type(uint256).max);
        usdc.approve(address(payMgr), type(uint256).max);
        vm.stopBroadcast();

        console.log("MockUSDC                  :", address(usdc));
        console.log("PulseSubscriptionManager  :", address(subMgr));
        console.log("PulsePayrollManager       :", address(payMgr));
        console.log("PulseExecutor             :", address(exec));
        console.log("Deployer (anvil[0])       :", deployer);
    }
}
