// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Immutable single-token vesting wallet with a zero-unlock cliff.
contract TokenVesting {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address public immutable beneficiary;
    uint64 public immutable cliff;
    uint64 public immutable duration;
    uint256 public immutable allocation;
    uint256 public released;

    event Released(uint256 amount);

    error ZeroAddress();
    error InvalidSchedule();
    error NothingToRelease();

    constructor(
        IERC20 _token,
        address _beneficiary,
        uint64 _cliff,
        uint64 _duration,
        uint256 _allocation
    ) {
        if (address(_token) == address(0) || _beneficiary == address(0)) revert ZeroAddress();
        if (_duration == 0 || _allocation == 0) revert InvalidSchedule();
        token = _token;
        beneficiary = _beneficiary;
        cliff = _cliff;
        duration = _duration;
        allocation = _allocation;
    }

    function vestedAt(uint64 timestamp) public view returns (uint256) {
        if (timestamp <= cliff) return 0;
        uint256 elapsed = timestamp - cliff;
        if (elapsed >= duration) return allocation;
        return (allocation * elapsed) / duration;
    }

    function releasable() public view returns (uint256) {
        return vestedAt(uint64(block.timestamp)) - released;
    }

    function release() external returns (uint256 amount) {
        amount = releasable();
        if (amount == 0) revert NothingToRelease();
        released += amount;
        token.safeTransfer(beneficiary, amount);
        emit Released(amount);
    }
}
