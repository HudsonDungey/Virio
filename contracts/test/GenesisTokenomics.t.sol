// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GenesisTokenomics} from "../src/token/GenesisTokenomics.sol";
import {VIRIO} from "../src/token/VIRIO.sol";
import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";

contract GenesisTokenomicsTest is Test {
    function test_allocationsSumToFixedSupply() public pure {
        uint256 total;
        for (uint256 i; i <= uint256(GenesisTokenomics.Bucket.Advisors); ++i) {
            total += GenesisTokenomics.allocation(GenesisTokenomics.Bucket(i));
        }
        assertEq(total, GenesisTokenomics.SUPPLY);
    }

    function test_founderHasZeroLiquidAtGenesis() public pure {
        assertEq(GenesisTokenomics.founderUnlockedAt(0), 0);
        assertEq(GenesisTokenomics.founderUnlockedAt(6 * GenesisTokenomics.MONTH), 0);
    }

    function test_documentedCirculatingSupplyMath() public pure {
        assertEq(GenesisTokenomics.circulatingAt(0), 100_000_000e18);
        assertEq(GenesisTokenomics.circulatingAt(6 * GenesisTokenomics.MONTH), 141_857_142_857_142_857_142_857_142);
        assertEq(GenesisTokenomics.circulatingAt(12 * GenesisTokenomics.MONTH), 215_571_428_571_428_571_428_571_428);
        assertEq(GenesisTokenomics.circulatingAt(24 * GenesisTokenomics.MONTH), 389_666_666_666_666_666_666_666_666);
        assertEq(GenesisTokenomics.circulatingAt(36 * GenesisTokenomics.MONTH), 507_333_333_333_333_333_333_333_333);
        assertEq(GenesisTokenomics.circulatingAt(48 * GenesisTokenomics.MONTH), 592_000_000e18);
        assertEq(GenesisTokenomics.circulatingAt(60 * GenesisTokenomics.MONTH), 650_000_000e18);
    }

    function test_baseIsOnlyGenesisMintChain() public {
        vm.chainId(8453);
        VIRIO base = new VIRIO(address(this), address(this));
        assertEq(base.totalSupply(), 1_000_000_000e18);
        vm.chainId(42161);
        VIRIO unsupported = new VIRIO(address(this), address(this));
        assertEq(unsupported.totalSupply(), 0);
    }

    function test_feeDistributionAndBuybackStartDisabled() public {
        FeeDistributor distributor = new FeeDistributor(
            address(this), IStaking(address(1)), address(2), address(3)
        );
        assertFalse(distributor.feeDistributionEnabled());
        assertFalse(distributor.protocolBuybackEnabled());
    }
}
