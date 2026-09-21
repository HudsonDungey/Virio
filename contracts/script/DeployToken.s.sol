// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

import {VIRIO} from "../src/token/VIRIO.sol";
import {Staking} from "../src/token/Staking.sol";
import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";
import {SafetyModule} from "../src/token/SafetyModule.sol";
import {GenesisAllocationVault} from "../src/token/GenesisAllocationVault.sol";

/// @notice Base genesis deployment with allocation custody and Vultisig-controlled timelock handoff.
/// @dev The broadcast key is the temporary setup owner. It performs only the
///      initialization needed to make the genesis allocation enforceable, then
///      transfers every Ownable2Step contract to the timelock. Vultisig executes
///      acceptOwnership through the 48-hour timelock after deployment.
contract DeployToken is Script {
    uint256 internal constant TIMELOCK_DELAY = 48 hours;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deploymentAdmin = vm.addr(pk);
        address vultisig = vm.envAddress("VIRIO_VULTISIG");
        address communityCustody = vm.envAddress("VIRIO_COMMUNITY_CUSTODY");
        address earlyCommunityDistributor = vm.envAddress("VIRIO_EARLY_COMMUNITY_DISTRIBUTOR");
        address founder = vm.envAddress("VIRIO_FOUNDER");
        address team = vm.envAddress("VIRIO_TEAM");
        address strategicCustody = vm.envAddress("VIRIO_STRATEGIC_ECOSYSTEM_CUSTODY");
        address liquidityCustody = vm.envAddress("VIRIO_LIQUIDITY_CUSTODY");
        address launchIncentivesCustody = vm.envAddress("VIRIO_LAUNCH_INCENTIVES_CUSTODY");
        address advisors = vm.envAddress("VIRIO_ADVISORS");
        address buybackOp = vm.envAddress("VIRIO_BUYBACK_OP");
        address feeToken = vm.envAddress("VIRIO_FEE_TOKEN");
        uint64 tgeTimestamp = uint64(vm.envUint("VIRIO_TGE_TIMESTAMP"));

        require(block.chainid == 8453, "DeployToken: Base only at genesis");

        address[] memory proposers = new address[](1);
        proposers[0] = vultisig;
        address[] memory executors = new address[](1);
        executors[0] = vultisig;

        vm.startBroadcast(pk);

        TimelockController timelock = new TimelockController(
            TIMELOCK_DELAY, proposers, executors, deploymentAdmin
        );
        GenesisAllocationVault allocationVault = new GenesisAllocationVault(deploymentAdmin);
        VIRIO virio = new VIRIO(deploymentAdmin, address(allocationVault));
        Staking staking = new Staking(IERC20(address(virio)), deploymentAdmin);
        SafetyModule safetyModule = new SafetyModule(deploymentAdmin);
        FeeDistributor feeDistributor = new FeeDistributor(
            deploymentAdmin, IStaking(address(staking)), address(timelock), buybackOp
        );

        // The setup signer owns Staking at this point, so this cannot fail due
        // to a multisig-only owner during deployment.
        staking.registerRewardToken(feeToken);

        // The vault verifies it received the exact fixed supply and atomically
        // funds all published allocations, including immutable vesting wallets.
        allocationVault.initialize(
            IERC20(address(virio)),
            tgeTimestamp,
            address(timelock),
            communityCustody,
            earlyCommunityDistributor,
            founder,
            team,
            strategicCustody,
            address(safetyModule),
            liquidityCustody,
            launchIncentivesCustody,
            advisors
        );

        // Vultisig controls the timelock. Ownership acceptance must be queued
        // through it after the mandatory 48-hour delay.
        virio.transferOwnership(address(timelock));
        staking.transferOwnership(address(timelock));
        feeDistributor.transferOwnership(address(timelock));
        safetyModule.transferOwnership(address(timelock));
        allocationVault.transferOwnership(address(timelock));
        timelock.revokeRole(timelock.DEFAULT_ADMIN_ROLE(), deploymentAdmin);

        vm.stopBroadcast();

        console.log("=== VIRIO Base genesis deployment ===");
        console.log("VIRIO                :", address(virio));
        console.log("Allocation vault     :", address(allocationVault));
        console.log("Founder vesting      :", allocationVault.founderVesting());
        console.log("Team vesting         :", allocationVault.teamVesting());
        console.log("Advisor vesting      :", allocationVault.advisorVesting());
        console.log("Staking              :", address(staking));
        console.log("FeeDistributor       :", address(feeDistributor));
        console.log("SafetyModule         :", address(safetyModule));
        console.log("48h timelock         :", address(timelock));
        console.log("Vultisig proposer/executor:", vultisig);
        console.log("Setup admin          :", deploymentAdmin);
        console.log("");
        console.log("Required post-deploy action after timelock delay:");
        console.log("  - Schedule and execute acceptOwnership on VIRIO, Staking, FeeDistributor,");
        console.log("    SafetyModule and GenesisAllocationVault through the Vultisig timelock.");
        console.log("  - Create liquidity separately from VIRIO_LIQUIDITY_CUSTODY; this script");
        console.log("    deliberately does not claim to create a DEX pool.");
        console.log("  - Keep bridge limits and fee/buyback gates disabled until approved.");
    }
}
