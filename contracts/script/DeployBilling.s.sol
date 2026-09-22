// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VirioAuthorizationRegistry} from "../src/billing/VirioAuthorizationRegistry.sol";
import {VirioRecurringBilling} from "../src/billing/VirioRecurringBilling.sol";
import {VirioMeteredBilling} from "../src/billing/VirioMeteredBilling.sol";
import {IVirioAuthorizationRegistry as IReg} from
    "../src/billing/interfaces/IVirioAuthorizationRegistry.sol";

/// @notice Deploys the programmable billing stack: the authorization registry
///         plus the recurring and metered modules, with both modules registered.
///
///         This deploys NOTHING over the existing VirioSubscriptionManager.
///         That contract is immutable and stays exactly where it is; merchants
///         already on it keep charging with no action required. See
///         docs/migration for what moving across involves.
///
///         Target Base Sepolia first:
///           forge script script/DeployBilling.s.sol \
///             --rpc-url base-sepolia --broadcast --verify -vvvv
///
///         Env:
///           PRIVATE_KEY    deployer key
///           FEE_RECIPIENT  protocol fee recipient (defaults to the deployer)
contract DeployBilling is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);

        vm.startBroadcast(pk);
        VirioAuthorizationRegistry registry = new VirioAuthorizationRegistry(feeRecipient);
        VirioRecurringBilling recurring = new VirioRecurringBilling(registry);
        VirioMeteredBilling metered = new VirioMeteredBilling(registry);

        // A module can settle nothing until the registry admits it. Registering
        // here keeps deploy-and-enable atomic, so there is no window where a
        // module address is live but unregistered.
        registry.setModuleStatus(address(recurring), IReg.ModuleStatus.Active);
        registry.setModuleStatus(address(metered), IReg.ModuleStatus.Active);
        vm.stopBroadcast();

        console.log("=== Virio programmable billing ===");
        console.log("chain id                   :", block.chainid);
        console.log("VirioAuthorizationRegistry :", address(registry));
        console.log("VirioRecurringBilling      :", address(recurring));
        console.log("VirioMeteredBilling        :", address(metered));
        console.log("feeRecipient               :", feeRecipient);
        console.log("deployment block           :", block.number);
        console.log("");
        console.log("Set these in the dashboard (lib/addresses.ts) and the SDK config:");
        console.log('  "authorizationRegistry": ', address(registry));
        console.log('  "recurringBilling":      ', address(recurring));
        console.log('  "meteredBilling":        ', address(metered));
        console.log('  "billingDeploymentBlock":', block.number);
    }
}
