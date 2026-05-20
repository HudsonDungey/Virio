// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/test-helpers/MockUSDC.sol";
import {VirioSubscriptionManager} from "../src/VirioSubscriptionManager.sol";

/// @notice Sepolia deploy:
///   1. Deploy MockUSDC (mintable test token — anyone can mint to themselves)
///   2. Deploy VirioSubscriptionManager (feeRecipient = the deployer EOA)
///   3. Mint a starter 10,000 USDC to the deployer
///
///   Run with (replace YOUR_KEY and YOUR_ALCHEMY_URL):
///     PRIVATE_KEY=0xYOUR_KEY \
///     forge script script/DeploySepolia.s.sol \
///         --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY \
///         --broadcast \
///         --verify \
///         --etherscan-api-key $ETHERSCAN_API_KEY \
///         -vvvv
///
///   After it prints the addresses, paste them into
///   `packages/dashboard/virio.local.json` under `contracts.manager` / `contracts.usdc`
///   and set `deploymentBlock` to the Sepolia block of the deploy tx.
contract DeploySepolia is Script {
    uint256 constant INITIAL_MINT = 10_000 * 1e6; // 10 000 USDC (6 decimals)

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        MockUSDC usdc = new MockUSDC();
        VirioSubscriptionManager mgr = new VirioSubscriptionManager(deployer);
        usdc.mint(deployer, INITIAL_MINT);
        // Deployer approves manager — useful if you also subscribe from this address.
        usdc.approve(address(mgr), type(uint256).max);
        vm.stopBroadcast();

        console.log("=== Sepolia deploy ===");
        console.log("MockUSDC                  :", address(usdc));
        console.log("VirioSubscriptionManager  :", address(mgr));
        console.log("Deployer / feeRecipient   :", deployer);
        console.log("");
        console.log("Paste into packages/dashboard/virio.local.json:");
        console.log('  "contracts.manager":', address(mgr));
        console.log('  "contracts.usdc":   ', address(usdc));
        console.log('  "contracts.feeRecipient":', deployer);
        console.log('  "deploymentBlock":  ', block.number);
    }
}
