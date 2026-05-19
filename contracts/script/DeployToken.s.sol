// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {PULSE}           from "../src/token/PULSE.sol";
import {Staking}         from "../src/token/Staking.sol";
import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";
import {SafetyModule}    from "../src/token/SafetyModule.sol";

/// @notice Multichain-aware deploy script for $PULSE.
///
/// Run on each supported chain (Ethereum, Base, Arbitrum, plus testnets).
/// The PULSE constructor mints the 1B genesis supply only on chainid 1.
/// Every other chain starts at totalSupply == 0 and only fills via bridges.
///
///   forge script script/DeployToken.s.sol \
///       --rpc-url $RPC_URL \
///       --broadcast \
///       -vvvv
///
/// Required env vars:
///   PRIVATE_KEY        — deployer private key
///   PULSE_OWNER        — initial owner (multisig at TGE, DAO at month 12)
///   PULSE_GENESIS_TO   — address receiving the 1B mint (mainnet only; ignored elsewhere)
///   PULSE_TREASURY     — chain-local treasury sink
///   PULSE_BUYBACK_OP   — chain-local buyback operator (EOA or contract)
///   PULSE_FEE_TOKEN    — primary fee token to register with Staking (e.g. USDC)
///
/// CREATE3 deterministic deployment is left as a follow-up; for v1 we accept
/// chain-specific addresses and surface them via the `chains.ts` SDK module.
contract DeployToken is Script {
    function run() external {
        uint256 pk            = vm.envUint("PRIVATE_KEY");
        address owner         = vm.envAddress("PULSE_OWNER");
        address genesisTo     = vm.envOr("PULSE_GENESIS_TO", owner);
        address treasury      = vm.envAddress("PULSE_TREASURY");
        address buybackOp     = vm.envAddress("PULSE_BUYBACK_OP");
        address feeToken      = vm.envAddress("PULSE_FEE_TOKEN");

        vm.startBroadcast(pk);

        // 1. PULSE token (xERC20 + ERC20Votes).
        //    Mints 1B to genesisTo iff this is mainnet (chainid 1).
        PULSE pulse = new PULSE(owner, genesisTo);

        // 2. Staking (1:1 stPULSE receipt).
        Staking staking = new Staking(IERC20(address(pulse)), owner);

        // 3. SafetyModule (holds buyback PULSE).
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

        console.log("=== Pulse token deploy on chainid", block.chainid, "===");
        console.log("PULSE          :", address(pulse));
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
        console.log("  - Call PulseSubscriptionManager.setFeeRecipient(feeDistributor)");
        console.log("  - Call PulsePayrollManager.setFeeRecipient(feeDistributor)");
        console.log("  - Add bridge(s) via PULSE.setLimits(bridge, mintMax, burnMax)");
    }
}
