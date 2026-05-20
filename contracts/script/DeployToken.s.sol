// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VIRIO}           from "../src/token/VIRIO.sol";
import {Staking}         from "../src/token/Staking.sol";
import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";
import {SafetyModule}    from "../src/token/SafetyModule.sol";

/// @notice Multichain-aware deploy script for $VIRIO.
///
/// Run on each supported chain (Ethereum, Base, Arbitrum, plus testnets).
/// The VIRIO constructor mints the 1B genesis supply only on chainid 1.
/// Every other chain starts at totalSupply == 0 and only fills via bridges.
///
///   forge script script/DeployToken.s.sol \
///       --rpc-url $RPC_URL \
///       --broadcast \
///       -vvvv
///
/// Required env vars:
///   PRIVATE_KEY        — deployer private key
///   VIRIO_OWNER        — initial owner (multisig at TGE, DAO at month 12)
///   VIRIO_GENESIS_TO   — address receiving the 1B mint (mainnet only; ignored elsewhere)
///   VIRIO_TREASURY     — chain-local treasury sink
///   VIRIO_BUYBACK_OP   — chain-local buyback operator (EOA or contract)
///   VIRIO_FEE_TOKEN    — primary fee token to register with Staking (e.g. USDC)
///
/// CREATE3 deterministic deployment is left as a follow-up; for v1 we accept
/// chain-specific addresses and surface them via the `chains.ts` SDK module.
contract DeployToken is Script {
    function run() external {
        uint256 pk            = vm.envUint("PRIVATE_KEY");
        address owner         = vm.envAddress("VIRIO_OWNER");
        address genesisTo     = vm.envOr("VIRIO_GENESIS_TO", owner);
        address treasury      = vm.envAddress("VIRIO_TREASURY");
        address buybackOp     = vm.envAddress("VIRIO_BUYBACK_OP");
        address feeToken      = vm.envAddress("VIRIO_FEE_TOKEN");

        vm.startBroadcast(pk);

        // 1. VIRIO token (xERC20 + ERC20Votes).
        //    Mints 1B to genesisTo iff this is mainnet (chainid 1).
        VIRIO virio = new VIRIO(owner, genesisTo);

        // 2. Staking (1:1 stVIRIO receipt).
        Staking staking = new Staking(IERC20(address(virio)), owner);

        // 3. SafetyModule (holds buyback VIRIO).
        SafetyModule safetyModule = new SafetyModule(owner);

        // 4. FeeDistributor (60/25/15 splitter).
        FeeDistributor feeDistributor = new FeeDistributor(
            owner,
            IStaking(address(staking)),
            treasury,
            buybackOp
        );

        // 5. Wire reward token into Staking up-front (owner action; deployer
        //    is still owner pre-handoff). The DAO can add more later.
        staking.registerRewardToken(feeToken);

        vm.stopBroadcast();

        console.log("=== Virio token deploy on chainid", block.chainid, "===");
        console.log("VIRIO          :", address(virio));
        console.log("Staking        :", address(staking));
        console.log("FeeDistributor :", address(feeDistributor));
        console.log("SafetyModule   :", address(safetyModule));
        console.log("Owner          :", owner);
        console.log("Genesis -> to  :", genesisTo);
        console.log("Treasury       :", treasury);
        console.log("BuybackOperator:", buybackOp);
        console.log("Fee token      :", feeToken);
        console.log("");
        console.log("Next steps:");
        console.log("  - Call VirioSubscriptionManager.setFeeRecipient(feeDistributor)");
        console.log("  - Call VirioPayrollManager.setFeeRecipient(feeDistributor)");
        console.log("  - Add bridge(s) via VIRIO.setLimits(bridge, mintMax, burnMax)");
    }
}
