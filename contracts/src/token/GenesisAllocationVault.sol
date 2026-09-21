// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {GenesisTokenomics} from "./GenesisTokenomics.sol";
import {TokenVesting} from "./TokenVesting.sol";

/// @notice One-time allocator for the 1B Base genesis mint.
/// @dev Deploy before VIRIO, mint VIRIO here, then initialize once with the
///      published recipients. It has no post-initialization withdrawal function.
contract GenesisAllocationVault is Ownable2Step {
    using SafeERC20 for IERC20;

    IERC20 public token;
    bool public initialized;

    address public founderVesting;
    address public teamVesting;
    address public advisorVesting;

    event Initialized(
        address indexed token,
        address indexed treasury,
        address founderVesting,
        address teamVesting,
        address advisorVesting
    );

    error AlreadyInitialized();
    error ZeroAddress();
    error IncorrectGenesisBalance(uint256 actual);
    error TgeInPast();

    constructor(address deploymentAdmin) Ownable(deploymentAdmin) {
        if (deploymentAdmin == address(0)) revert ZeroAddress();
    }

    function initialize(
        IERC20 _token,
        uint64 tgeTimestamp,
        address treasuryTimelock,
        address communityCustody,
        address earlyCommunityDistributor,
        address founder,
        address team,
        address strategicEcosystemCustody,
        address safetyModule,
        address liquidityCustody,
        address launchIncentivesCustody,
        address advisors
    ) external onlyOwner {
        if (initialized) revert AlreadyInitialized();
        if (tgeTimestamp < block.timestamp) revert TgeInPast();
        if (
            address(_token) == address(0) || treasuryTimelock == address(0) ||
            communityCustody == address(0) || earlyCommunityDistributor == address(0) ||
            founder == address(0) || team == address(0) || strategicEcosystemCustody == address(0) ||
            safetyModule == address(0) || liquidityCustody == address(0) ||
            launchIncentivesCustody == address(0) || advisors == address(0)
        ) revert ZeroAddress();
        uint256 balance = _token.balanceOf(address(this));
        if (balance != GenesisTokenomics.SUPPLY) revert IncorrectGenesisBalance(balance);
        initialized = true;
        token = _token;

        founderVesting = address(new TokenVesting(
            _token, founder, tgeTimestamp + uint64(6 * GenesisTokenomics.MONTH),
            uint64(30 * GenesisTokenomics.MONTH),
            GenesisTokenomics.allocation(GenesisTokenomics.Bucket.Founder)
        ));
        teamVesting = address(new TokenVesting(
            _token, team, tgeTimestamp + uint64(12 * GenesisTokenomics.MONTH),
            uint64(36 * GenesisTokenomics.MONTH),
            GenesisTokenomics.allocation(GenesisTokenomics.Bucket.TeamFutureHires)
        ));
        advisorVesting = address(new TokenVesting(
            _token, advisors, tgeTimestamp + uint64(6 * GenesisTokenomics.MONTH),
            uint64(24 * GenesisTokenomics.MONTH),
            GenesisTokenomics.allocation(GenesisTokenomics.Bucket.Advisors)
        ));

        _token.safeTransfer(treasuryTimelock, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.ProtocolTreasury));
        _token.safeTransfer(communityCustody, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.CommunityEcosystem));
        _token.safeTransfer(earlyCommunityDistributor, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.EarlyCommunityAirdrop));
        _token.safeTransfer(founderVesting, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.Founder));
        _token.safeTransfer(teamVesting, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.TeamFutureHires));
        _token.safeTransfer(strategicEcosystemCustody, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.StrategicEcosystemReserve));
        _token.safeTransfer(safetyModule, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.SafetyModule));
        _token.safeTransfer(liquidityCustody, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.ProtocolLaunchLiquidity));
        _token.safeTransfer(launchIncentivesCustody, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.LaunchNetworkIncentives));
        _token.safeTransfer(advisorVesting, GenesisTokenomics.allocation(GenesisTokenomics.Bucket.Advisors));

        emit Initialized(address(_token), treasuryTimelock, founderVesting, teamVesting, advisorVesting);
    }
}
