// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// ─────────────────────────────────────────────────────────────────────────────
// SafetyModule — chain-local on-chain insurance fund for Virio.
//
// Receives VIRIO bought back from the 15% protocol-fee slice (executed by the
// buybackOperator) and holds it as a reserve. The DAO can vote to deploy
// reserves under defined conditions (audit / governance / emergency).
//
// Intentionally minimal at v1: a holder contract with owner-gated withdrawals.
// The covered-call / staked-backstop variants common in Aave / Curve are out
// of scope for the initial launch.
// ─────────────────────────────────────────────────────────────────────────────

import {Ownable}      from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20}       from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}    from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SafetyModule is Ownable2Step {
    using SafeERC20 for IERC20;

    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address _initialOwner) Ownable(_initialOwner) {}

    /// @notice DAO-gated withdrawal. Used to pay claims or rebalance reserves.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }
}
