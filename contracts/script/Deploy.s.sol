// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";
import {VirioSubscriptionManager} from "../src/VirioSubscriptionManager.sol";

/// @notice Local-anvil deploy:
///   1. Deploy MockUSDC
///   2. Deploy VirioSubscriptionManager (feeRecipient = anvil[0])
///   3. Mint USDC to anvil[0..4] (10 000 USDC each)
///   4. Have anvil[1..4] approve the manager for max
///
///   Run with:
///     anvil --host 127.0.0.1 &
///     forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 \
///         --broadcast --skip-simulation
contract Deploy is Script {
    // Standard anvil private keys (well known, NEVER use on mainnet).
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

        // ─── Deploy ──────────────────────────────────────────────────────────
        vm.startBroadcast(PK_0);

        MockUSDC usdc = new MockUSDC();
        VirioSubscriptionManager mgr = new VirioSubscriptionManager(deployer);

        // Mint to deployer (acts as merchant + executor) and four test users.
        usdc.mint(deployer, INITIAL_MINT);
        usdc.mint(user1,    INITIAL_MINT);
        usdc.mint(user2,    INITIAL_MINT);
        usdc.mint(user3,    INITIAL_MINT);
        usdc.mint(user4,    INITIAL_MINT);

        // Deployer also approves manager (so deployer can act as a customer too).
        usdc.approve(address(mgr), type(uint256).max);

        vm.stopBroadcast();

        // ─── Each user approves the manager for max ──────────────────────────
        // (in production this is replaced by EIP-7702 delegate authorization;
        //  for the dashboard testbed we use the standard allowance flow.)
        vm.startBroadcast(PK_1); usdc.approve(address(mgr), type(uint256).max); vm.stopBroadcast();
        vm.startBroadcast(PK_2); usdc.approve(address(mgr), type(uint256).max); vm.stopBroadcast();
        vm.startBroadcast(PK_3); usdc.approve(address(mgr), type(uint256).max); vm.stopBroadcast();
        vm.startBroadcast(PK_4); usdc.approve(address(mgr), type(uint256).max); vm.stopBroadcast();

        console.log("MockUSDC                  :", address(usdc));
        console.log("VirioSubscriptionManager  :", address(mgr));
        console.log("Deployer (anvil[0])       :", deployer);
    }
}
