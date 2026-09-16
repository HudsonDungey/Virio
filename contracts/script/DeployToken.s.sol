// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VIRIO}           from "../src/token/VIRIO.sol";
import {Staking}         from "../src/token/Staking.sol";
import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";
import {SafetyModule}    from "../src/token/SafetyModule.sol";
import {GenesisTokenomics} from "../src/token/GenesisTokenomics.sol";

/// @notice Base-first deploy script for $VIRIO.
///
/// Run on Base at genesis. The VIRIO constructor mints the 1B genesis supply
/// only on Base (chainid 8453). Other chains remain unsupported until a later
/// governance-approved expansion and bridge configuration.
///
///   forge script script/DeployToken.s.sol \
///       --rpc-url $RPC_URL \
///       --broadcast \
///       -vvvv
///
/// Required env vars:
///   PRIVATE_KEY        — deployer private key
///   VIRIO_OWNER        — initial owner (multisig at TGE, DAO at month 12)
///   VIRIO_GENESIS_TO   — token allocation distributor / timelock on Base
///   VIRIO_TREASURY     — chain-local treasury sink
///   VIRIO_BUYBACK_OP   — reserved operator; buybacks are disabled at genesis
///   GENESIS_LP_TOKEN_AMOUNT — amount of the 50M LP allocation actually deposited
///   GENESIS_LP_QUOTE_AMOUNT — corresponding quote asset amount (recorded for launch ops)
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
        uint256 genesisLpTokens = vm.envUint("GENESIS_LP_TOKEN_AMOUNT");
        uint256 genesisLpQuote = vm.envUint("GENESIS_LP_QUOTE_AMOUNT");
        require(block.chainid == 8453, "DeployToken: Base only at genesis");
        require(genesisLpTokens <= GenesisTokenomics.allocation(GenesisTokenomics.Bucket.ProtocolLaunchLiquidity), "DeployToken: LP exceeds allocation");

        vm.startBroadcast(pk);

        // 1. VIRIO token (xERC20 + ERC20Votes).
        //    Mints 1B to the allocation distributor on Base only.
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
        console.log("Genesis LP VIRIO (of 50M max):", genesisLpTokens);
        console.log("Genesis LP quote amount:", genesisLpQuote);
        console.log("");
        console.log("Next steps:");
        console.log("  - Keep FeeDistributor legal/security gates disabled at genesis");
        console.log("  - Deploy allocation custody and vesting contracts before distributing genesis supply");
        console.log("  - Do not configure bridges until an expansion is approved");
    }
}
