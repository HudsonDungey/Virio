# Launch Phases

The path to $VIRIO launch, broken into five phases. Each phase has its own doc with a tickable
checklist of what to finalise, what to refine, and the exit criteria that gate the next phase.

| # | Phase | Goal | Doc |
|---|---|---|---|
| 1 | Smart contract finalisation | Every contract feature-complete, tested, internally reviewed, freeze-ready | [`PHASE-1-smart-contract-finalisation.md`](./PHASE-1-smart-contract-finalisation.md) |
| 2 | Public genesis preparation | Transparent Base bootstrap | [`PHASE-2-private-investment-and-token-sales.md`](./PHASE-2-private-investment-and-token-sales.md) |
| 3 | Security and Base genesis | Audit, remediate and deploy Base-first | [`PHASE-3-finalise-and-launch-contracts.md`](./PHASE-3-finalise-and-launch-contracts.md) |
| 4 | Website / UI | Smooth, correct, production-grade product + claim UX | [`PHASE-4-website-and-ui.md`](./PHASE-4-website-and-ui.md) |
| 5 | Token launch, airdrop, staking & distribution | TGE, run the airdrop season, distribute | [`PHASE-5-token-launch-airdrop-staking.md`](./PHASE-5-token-launch-airdrop-staking.md) |

## How the phases relate

```
P1 finalise contracts ──► P2 prepare public genesis ──► P3 security + Base deploy ──► P4 polish UI ──► P5 community bootstrap
   (incl. AirdropDistributor)   (funds the audit)   (fund 100M airdrop)   (claim UX)   (run the season)
```

They are mostly sequential but overlap: UI work (P4) and the off-chain airdrop engine can be
built against testnet while the audit (P3) runs, and the **airdrop usage season starts on the
live product before TGE** (it's product-first — see [`../airdrop.md`](../airdrop.md)).

## Source-of-truth docs

- Token economics, allocation, vesting, fees: [`../TOKENOMICS.md`](../TOKENOMICS.md)
- Airdrop master spec: [`../airdrop.md`](../airdrop.md) and deep dives in [`../airdrop/`](../airdrop/)
- Operations & architecture: [`../HOW-TO-OPERATE.md`](../HOW-TO-OPERATE.md), [`../RUN.md`](../RUN.md)
- Current known bugs/backlog: [`../thingstoworkon.md`](../thingstoworkon.md)

## Contract inventory (current state of the repo)

Already built (`contracts/src/`):
- `token/VIRIO.sol` — ERC-20 + Votes + xERC20 (ERC-7281), 1B fixed supply
- `token/Staking.sol` — stVIRIO 1:1, Synthetix reward math, `stakeFor` present
- `token/FeeDistributor.sol` — 60/25/15 fee split routing
- `token/SafetyModule.sol` — buyback/insurance holder (v1 minimal)
- `VirioSubscriptionManager.sol`, `VirioPayrollManager.sol`, `SubscriptionDelegate7702.sol`

Not yet built (needed for launch):
- `AirdropDistributor` (Phase 1 / [`../airdrop/05`](../airdrop/05-architecture-and-contracts.md))
- Allocation custody and vesting contracts for team, founder, advisors and community schedules (Phase 1)
- Security review and gated activation decision for fee distribution and any buyback mechanism
</content>
