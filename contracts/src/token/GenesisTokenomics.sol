// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Canonical, deployment-independent VIRIO genesis allocation and unlock math.
/// @dev Allocation custody and vesting must be implemented with separately deployed
///      multisig/timelock and vesting contracts; this library is the source of truth
///      used by deployment tooling, tests, and public documentation.
library GenesisTokenomics {
    uint256 internal constant SUPPLY = 1_000_000_000e18;
    uint256 internal constant MONTH = 30 days;

    enum Bucket {
        CommunityEcosystem, ProtocolTreasury, EarlyCommunityAirdrop,
        TeamFutureHires, Founder, StrategicEcosystemReserve, SafetyModule,
        ProtocolLaunchLiquidity, LaunchNetworkIncentives, Advisors
    }

    function allocation(Bucket bucket) internal pure returns (uint256) {
        if (bucket == Bucket.CommunityEcosystem) return 300_000_000e18;
        if (bucket == Bucket.ProtocolTreasury) return 250_000_000e18;
        if (bucket == Bucket.EarlyCommunityAirdrop) return 100_000_000e18;
        if (bucket == Bucket.TeamFutureHires) return 80_000_000e18;
        if (bucket == Bucket.Founder) return 70_000_000e18;
        if (bucket == Bucket.StrategicEcosystemReserve) return 50_000_000e18;
        if (bucket == Bucket.SafetyModule) return 50_000_000e18;
        if (bucket == Bucket.ProtocolLaunchLiquidity) return 50_000_000e18;
        if (bucket == Bucket.LaunchNetworkIncentives) return 30_000_000e18;
        return 20_000_000e18; // Advisors
    }

    /// @notice Amount legitimately liquid under the public genesis schedule.
    /// @dev Treasury, safety, strategic reserve and undeployed LP are excluded until
    ///      a timelocked governance action deploys them. Community emissions are
    ///      participation-earned, not automatically circulating.
    function circulatingAt(uint256 elapsed) internal pure returns (uint256) {
        // Published genesis configuration: 50M VIRIO of the 50M maximum LP allocation.
        return circulatingAt(elapsed, 50_000_000e18);
    }

    /// @notice Circulation under a specified actual genesis LP deployment amount.
    /// @dev Deployment tooling must publish the selected value; it cannot exceed 50M.
    function circulatingAt(uint256 elapsed, uint256 genesisLpTokens) internal pure returns (uint256) {
        require(genesisLpTokens <= allocation(Bucket.ProtocolLaunchLiquidity), "LP exceeds allocation");
        uint256 liquid = genesisLpTokens;
        // Early community: 1% genesis claim (10M), then 90M linear from M3–M24.
        liquid += 10_000_000e18;
        liquid += linear(90_000_000e18, elapsed, 3 * MONTH, 21 * MONTH);
        // Verified launch/testnet contributions are earned before genesis.
        liquid += 30_000_000e18;
        // Community: 10M verified pre-genesis contribution plus 290M over 60 months.
        liquid += 10_000_000e18;
        liquid += linear(290_000_000e18, elapsed, 0, 60 * MONTH);
        // Founder: zero at TGE, M6 cliff then 30 months linear.
        liquid += linear(70_000_000e18, elapsed, 6 * MONTH, 30 * MONTH);
        // Team: M12 cliff then 36 months linear.
        liquid += linear(80_000_000e18, elapsed, 12 * MONTH, 36 * MONTH);
        // Advisors: M6 cliff then 24 months linear.
        liquid += linear(20_000_000e18, elapsed, 6 * MONTH, 24 * MONTH);
        return liquid;
    }

    function founderUnlockedAt(uint256 elapsed) internal pure returns (uint256) {
        return linear(70_000_000e18, elapsed, 6 * MONTH, 30 * MONTH);
    }

    function linear(uint256 amount, uint256 elapsed, uint256 cliff, uint256 duration)
        internal pure returns (uint256)
    {
        if (elapsed <= cliff) return 0;
        uint256 sinceCliff = elapsed - cliff;
        if (sinceCliff >= duration) return amount;
        return (amount * sinceCliff) / duration;
    }
}
