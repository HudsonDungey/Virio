// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FeeDistributor, IStaking} from "../src/token/FeeDistributor.sol";

contract FeeToken is ERC20 {
    constructor() ERC20("Fee Token", "FEE") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FeeStaking is IStaking {
    IERC20 immutable feeToken;
    constructor(IERC20 _feeToken) { feeToken = _feeToken; }
    function isRewardToken(address token) external view returns (bool) { return token == address(feeToken); }
    function notifyReward(address, uint256 amount) external {
        feeToken.transferFrom(msg.sender, address(this), amount);
    }
}

contract FeeDistributorTest is Test {
    FeeToken internal token;
    FeeStaking internal staking;
    FeeDistributor internal distributor;
    address internal treasury = makeAddr("treasury");
    address internal buyback = makeAddr("buyback");

    function setUp() public {
        token = new FeeToken();
        staking = new FeeStaking(IERC20(address(token)));
        distributor = new FeeDistributor(address(this), IStaking(address(staking)), treasury, buyback);
        token.mint(address(distributor), 100e18);
    }

    function test_distributionWorksWithBuybackDisabledAndRoutesReserveToTreasury() public {
        distributor.setFeeDistributionEnabled(true);
        distributor.distribute(address(token));
        assertEq(token.balanceOf(address(staking)), 60e18);
        assertEq(token.balanceOf(treasury), 40e18);
        assertEq(token.balanceOf(buyback), 0);
    }

    function test_distributionStartsDisabled() public {
        vm.expectRevert(FeeDistributor.FeeDistributionDisabled.selector);
        distributor.distribute(address(token));
    }
}
