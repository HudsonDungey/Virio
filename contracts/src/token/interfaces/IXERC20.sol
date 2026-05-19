// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IXERC20 (ERC-7281)
/// @notice Minimal sovereign-bridge interface for cross-chain ERC-20s.
///         Bridges with mint+burn allowances may mint/burn against the token,
///         each capped independently by a linearly-refilling rate limit.
interface IXERC20 {
    struct BridgeParameters {
        uint256 timestamp;        // last accumulator refresh
        uint256 ratePerSecond;    // refill rate (limit / duration)
        uint256 maxLimit;         // ceiling
        uint256 currentLimit;     // currently available
    }

    event BridgeLimitsSet(address indexed bridge, uint256 mintLimit, uint256 burnLimit);
    event LockboxSet(address indexed lockbox);

    /// @notice Mint tokens, deducting from the caller's mint allowance.
    function mint(address to, uint256 amount) external;

    /// @notice Burn tokens, deducting from the caller's burn allowance.
    function burn(address from, uint256 amount) external;

    /// @notice Current mint allowance available to `bridge`.
    function mintingCurrentLimitOf(address bridge) external view returns (uint256);

    /// @notice Current burn allowance available to `bridge`.
    function burningCurrentLimitOf(address bridge) external view returns (uint256);

    /// @notice Maximum (ceiling) mint allowance configured for `bridge`.
    function mintingMaxLimitOf(address bridge) external view returns (uint256);

    /// @notice Maximum (ceiling) burn allowance configured for `bridge`.
    function burningMaxLimitOf(address bridge) external view returns (uint256);

    /// @notice Owner-only: configure a bridge's mint+burn ceilings.
    ///         Each limit refills linearly from 0 → max over `DURATION`.
    function setLimits(address bridge, uint256 mintingLimit, uint256 burningLimit) external;
}
