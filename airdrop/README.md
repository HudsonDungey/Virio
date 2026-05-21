# VIRIO Airdrop — Deep-Dive Docs

These documents expand the master spec at [`../airdrop.md`](../airdrop.md). Read in order if
you're new; jump to a section by topic otherwise.

| # | Doc | What it answers |
|---|---|---|
| 00 | [`../airdrop.md`](../airdrop.md) | The one-page master spec (start here) |
| 01 | [`01-overview-and-allocation.md`](./01-overview-and-allocation.md) | Why this airdrop, who gets what, when |
| 02 | [`02-qualification-and-points.md`](./02-qualification-and-points.md) | Exactly how points are earned per bucket |
| 03 | [`03-sybil-resistance.md`](./03-sybil-resistance.md) | How we keep farmers out |
| 04 | [`04-anti-dump-design.md`](./04-anti-dump-design.md) | The 5-mechanism anti-dump stack |
| 05 | [`05-architecture-and-contracts.md`](./05-architecture-and-contracts.md) | `AirdropDistributor` + Points/Sybil engine |
| 06 | [`06-claim-flow-and-vesting.md`](./06-claim-flow-and-vesting.md) | Merkle claim + monthly windows |
| 07 | [`07-kpis-and-monitoring.md`](./07-kpis-and-monitoring.md) | What we measure and alarm on |
| 08 | [`08-implementation-roadmap.md`](./08-implementation-roadmap.md) | Build order + improvement options |

## How this fits the launch

The airdrop is **Phase 5** in [`../phases/`](../phases/), but it has dependencies that reach
back into every earlier phase:

- **Phase 1** must finalise the `AirdropDistributor` contract and confirm `Staking.stakeFor`
  is the integration point for claim-and-stake.
- **Phase 2** funds the audit that the `AirdropDistributor` must pass.
- **Phase 3** deploys `AirdropDistributor` alongside the rest of the suite and funds it with 100M VIRIO.
- **Phase 4** ships the claim UI (eligibility checker, claim/claim-and-stake, projected APR).
- **Phase 5** runs the season, publishes monthly roots, and executes distribution.

## Anchor facts (do not drift from these)

- Airdrop = **100,000,000 VIRIO = 10%** of the fixed 1B supply.
- Release = **1%/month for 10 months** = **10 equal tranches of 10%** per wallet.
- Buckets: **60M users / 35M referrals / 5M community**.
- Bonus pool is funded from the community slice and/or recycled forfeitures — **never new supply**.
- Existing contracts the airdrop plugs into: `Staking.sol`, `FeeDistributor.sol`,
  `SafetyModule.sol`, `VirioSubscriptionManager.sol`, `VirioPayrollManager.sol`.
</content>
