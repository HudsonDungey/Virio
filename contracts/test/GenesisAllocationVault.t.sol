// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VIRIO} from "../src/token/VIRIO.sol";
import {GenesisAllocationVault} from "../src/token/GenesisAllocationVault.sol";
import {GenesisTokenomics} from "../src/token/GenesisTokenomics.sol";
import {TokenVesting} from "../src/token/TokenVesting.sol";

contract GenesisAllocationVaultTest is Test {
    VIRIO internal virio;
    GenesisAllocationVault internal vault;

    address internal treasury = makeAddr("timelock");
    address internal community = makeAddr("community");
    address internal airdrop = makeAddr("airdrop");
    address internal founder = makeAddr("founder");
    address internal team = makeAddr("team");
    address internal strategic = makeAddr("strategic");
    address internal safety = makeAddr("safety");
    address internal liquidity = makeAddr("liquidity");
    address internal launch = makeAddr("launch");
    address internal advisors = makeAddr("advisors");

    uint64 internal tge;

    function setUp() public {
        vm.chainId(8453);
        tge = uint64(block.timestamp);
        vault = new GenesisAllocationVault(address(this));
        virio = new VIRIO(address(this), address(vault));
        vault.initialize(
            IERC20(address(virio)), tge, treasury, community, airdrop, founder, team,
            strategic, safety, liquidity, launch, advisors
        );
    }

    function test_initializationAllocatesExactlyFixedSupply() public view {
        assertEq(virio.balanceOf(address(vault)), 0);
        assertEq(virio.balanceOf(treasury), 250_000_000e18);
        assertEq(virio.balanceOf(community), 300_000_000e18);
        assertEq(virio.balanceOf(airdrop), 100_000_000e18);
        assertEq(virio.balanceOf(strategic), 50_000_000e18);
        assertEq(virio.balanceOf(safety), 50_000_000e18);
        assertEq(virio.balanceOf(liquidity), 50_000_000e18);
        assertEq(virio.balanceOf(launch), 30_000_000e18);
        assertEq(virio.balanceOf(vault.founderVesting()), 70_000_000e18);
        assertEq(virio.balanceOf(vault.teamVesting()), 80_000_000e18);
        assertEq(virio.balanceOf(vault.advisorVesting()), 20_000_000e18);
        assertEq(virio.totalSupply(), GenesisTokenomics.SUPPLY);
    }

    function test_founderIsFullyLockedAtGenesisAndCliff() public {
        TokenVesting founderVesting = TokenVesting(vault.founderVesting());
        assertEq(founderVesting.releasable(), 0);
        vm.warp(tge + uint64(6 * GenesisTokenomics.MONTH));
        assertEq(founderVesting.releasable(), 0);
        vm.warp(tge + uint64(7 * GenesisTokenomics.MONTH));
        founderVesting.release();
        assertEq(virio.balanceOf(founder), uint256(70_000_000e18) / 30);
    }

    function test_cannotInitializeTwice() public {
        vm.expectRevert(GenesisAllocationVault.AlreadyInitialized.selector);
        vault.initialize(
            IERC20(address(virio)), tge, treasury, community, airdrop, founder, team,
            strategic, safety, liquidity, launch, advisors
        );
    }

    function test_rejectsPastTgeTimestamp() public {
        GenesisAllocationVault newVault = new GenesisAllocationVault(address(this));
        VIRIO newToken = new VIRIO(address(this), address(newVault));
        vm.warp(block.timestamp + 1);
        vm.expectRevert(GenesisAllocationVault.TgeInPast.selector);
        newVault.initialize(
            IERC20(address(newToken)), tge, treasury, community, airdrop, founder, team,
            strategic, safety, liquidity, launch, advisors
        );
    }
}
