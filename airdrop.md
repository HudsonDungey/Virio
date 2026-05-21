# $VIRIO Airdrop

> Master spec for the VIRIO airdrop. Deep-dive documents live in [`airdrop/`](./airdrop/).
> Launch sequencing lives in [`phases/`](./phases/). Token economics live in [`TOKENOMICS.md`](./TOKENOMICS.md).

## Overview

The Virio airdrop distributes **100,000,000 VIRIO (10% of supply)** to the people who
actually build the network: real product users and the referrers who bring them. It is a
**retroactive + seasonal reward, not a giveaway** — eligibility is earned through verifiable
on-chain product usage and qualified referrals, then claimed on a streamed schedule designed
to favour people who stay.

- **Sequencing: product first.** The product and a usage-driven points season run *before* TGE.
  A snapshot is taken, then the airdrop becomes claimable at/after TGE.
- The **"whitelist" is an airdrop-eligibility allowlist** — it is *not* sale access. The public
  sale has no allowlist (see [`TOKENOMICS.md`](./TOKENOMICS.md) §7).
- **Release schedule: 1% of total supply per month for 10 months** (per `TOKENOMICS.md`) — the
  full 100M airdrop unlocks over 10 months. Equivalently, each wallet's allocation vests in
  **10 equal monthly tranches (10% per tranche)**, claimed via a merkle distribution.

## Allocation (100,000,000 VIRIO)

| Bucket | Share | Tokens | Earned by |
|---|---|---|---|
| Real product users | 60% | 60,000,000 | Active subscriptions / payroll relationships, charges actually executed. Includes a retroactive floor for testnet + OG community. |
| Product referrals | 35% | 35,000,000 | Inviting users who themselves become active (qualified usage, not raw signups). |
| Community & social | 5% | 5,000,000 | Discord/X quests, content, ambassador program, bug/feedback bounties. |

> **Holders & stakers are rewarded separately, not from this pool.** In a product-first launch
> there are no VIRIO holders to snapshot before TGE. Holder/staker value comes from the live
> mechanics in `TOKENOMICS.md`: **stVIRIO stakers earn 60% of protocol fees in USDC continuously**,
> backed by the **15% buyback floor** and merchant fee discounts. The airdrop acquires users;
> fee yield retains holders.

## How to qualify

### Real product users (60M)
- Run real activity: create/subscribe to plans, run payroll, have charges actually execute.
- Points scale with genuine value flowing through the protocol (e.g. charge volume + number of
  active relationships + account longevity), not with one-off transactions.
- **Retroactive floor:** pre-TGE testnet users, early Discord, and OG community get a guaranteed
  minimum.

### Product referrals (35M)
- Wallet-/account-tied referral links.
- Referrer earns only when the referee **becomes active** (subscribes / runs payroll). Raw
  signups earn nothing.
- Decaying tiers (full credit for direct referrals, partial for second-degree) and a
  per-referrer cap so a few whales can't drain the bucket.
- Public leaderboard with bonus allocation for top referrers.

### Community & social (5M)
- Quests, content, ambassador roles, and bug/feedback bounties. Deliberately the smallest slice
  to keep the airdrop weighted toward real economic activity.

## Sybil resistance

Eligibility rules are published before the season and may be tuned month-to-month (as reserved
in `TOKENOMICS.md` §8):

- Minimum real-usage floor to be eligible at all.
- Funding-graph / clustering analysis to detect one actor running many wallets.
- Referral-quality gating: the referee must reach an activity threshold.
- Per-wallet and per-referrer caps.
- Clawback of points if a referee churns immediately after qualifying.

## Claim flow

1. Season runs on the live product; points accrue from usage + referrals + community.
2. One or more snapshots are taken on pre-announced dates.
3. Final eligibility = snapshot state + season points, filtered for sybils.
4. At TGE, eligibility is published as a merkle root; each wallet claims via merkle proof.
5. Claims vest in **10 equal monthly tranches (10% each) over 10 months**. See anti-dump design below.

## Reducing dump risk over time

A 100M airdrop is a large potential sell wall. The goal is to convert recipients into long-term
holders/stakers and make holding the higher-EV choice. The selected stack is mechanisms
**1, 2, 3, 5, and 7**, layered so vesting buys time, staking + yield change the decision, gating
removes mercenaries, and sybil filtering shrinks the wall before it forms.

**1. Streamed vesting, not a cliff (baseline).** The 10 equal monthly tranches (10%/mo × 10
months) release is the first defense: no recipient can dump their full allocation at TGE.

**2. Claim-and-stake bonus (strongest lever).** Recipients who stake their claim (convert to
stVIRIO) instead of taking it to their wallet get a bonus — a multiplier on the staked amount
and/or accelerated unlock of the next tranche. Because stVIRIO earns 60% of protocol fees in
USDC, staking is already attractive; the bonus makes selling the clearly worse choice.

**3. Use-it-or-lose-it tranches.** Each monthly tranche is claimable only within its month, and
the next tranche is gated on continued eligibility (still an active product user and/or still
staked). Mercenaries who stop using the product and dump forfeit remaining tranches; forfeited
tokens recycle to the bonus pool and remaining loyal claimers.

**5. Real yield as the reason to hold (not just lockups).** stVIRIO pays continuous USDC fee
yield and the 15% buyback provides a standing bid. The airdrop is marketed as "stake your claim
and earn real USDC," so holding has an ongoing payoff rather than pure price speculation.

**7. Anti-sybil = fewer pure dumpers.** Tight sybil filtering removes much of the sell wall
before it exists — the cheapest anti-dump measure is simply not allocating to mercenaries.

## How the systems work

### Components

**Off-chain — Points & Sybil Engine (new service):**
- Indexes on-chain product activity from `VirioSubscriptionManager` and `VirioPayrollManager`
  events (plans, subscribes, executed charges, payroll runs) via the existing event cache / an
  indexer.
- Tracks the referral graph (referrer → referee wallets) in its own DB.
- Computes points, applies sybil filters, and builds the monthly merkle trees. Publishes each
  root on-chain plus the methodology + filtered list off-chain for transparency.

**On-chain — AirdropDistributor (new contract):**
- Holds the 100M VIRIO. Stores the current merkle root and a `tgeTimestamp`.
- Enforces vesting, the claim-and-stake path, and per-tranche windows/gating.
- Integrates with the existing `Staking.sol` (mints stVIRIO), `FeeDistributor.sol`
  (60% fees → stakers in USDC), and `SafetyModule.sol` (15% buyback). No changes to token
  economics — it plugs into what already exists.

### End-to-end flow
1. Product runs; the engine ingests usage + referral events continuously during the season.
2. Snapshot(s) taken on announced dates → engine scores wallets and runs sybil filters.
3. At TGE the engine publishes `root₁` to `AirdropDistributor`; tranche 1 (10%) becomes claimable.
4. Each subsequent month the engine publishes `rootₘ` reflecting who is still eligible that month.
5. Wallets claim each month via merkle proof — either to wallet (vested only) or claim-and-stake
   (vested + bonus, deposited into `Staking.sol`).
6. Missed or no-longer-eligible tranches are forfeited and recycled.

### System 1 — Streamed vesting (AirdropDistributor)
Leaf = `keccak256(wallet, totalAllocation)`. Vesting is purely time-based off `tgeTimestamp`:

```
elapsedMonths = (block.timestamp - tgeTimestamp) / 30 days
vestedTranches = min(elapsedMonths + 1, 10)          // tranche 1 unlocks at TGE
maxClaimable   = totalAllocation * vestedTranches / 10
claimableNow   = maxClaimable - alreadyClaimed[wallet]
```

`claim(proof, totalAllocation, amount)` verifies the proof against the current root, checks
`amount <= claimableNow`, transfers, and updates `alreadyClaimed`. A wallet can let tranches
accrue and claim several at once (subject to System 3's windows).

### System 2 — Claim-and-stake bonus
Two entry points on the distributor:
- `claim(...)` → transfers vested VIRIO to the wallet (no bonus).
- `claimAndStake(...)` → routes the vested amount into `Staking.sol` (via `stakeFor`), mints
  stVIRIO to the claimant, and adds a bonus (e.g. **+15–25%** on the staked tranche, or unlocks
  the next tranche early).

Bonus tokens come from a reserved bonus pool (funded by the 5% community slice and/or recycled
forfeitures — **not new supply, so total stays 100M**). Bonus VIRIO is subject to a minimum
stake duration; unstaking before it elapses claws back the bonus. The base tranche is **never**
clawed back — only the bonus is at risk — so the incentive is purely positive.

### System 3 — Use-it-or-lose-it tranches & gating
Implemented with fresh monthly merkle roots rather than a single static root:
- Each month the engine builds `rootₘ` containing only wallets still eligible — i.e. had
  qualifying product activity in the trailing ~30 days (read from `SubscriptionManager` /
  `PayrollManager`) and/or are still staked (read from `Staking.sol`).
- To claim month *m*'s tranche, the wallet must prove inclusion in `rootₘ` within month *m*.
  Fall out of eligibility or miss the window → that tranche is not in the root → forfeited.
- Forfeited tokens are swept (a `recycleForfeited()` keeper call after each window) into the
  bonus pool / a pro-rata top-up for wallets that did stay eligible.

> Trade-off: monthly roots are more operational overhead than one static root, but they are what
> make "use it or lose it" actually enforceable on-chain.

### System 5 — Real yield (existing contracts, no new code)
`claimAndStake` deposits straight into the already-built `Staking.sol`, so the recipient
immediately begins accruing 60% of protocol fees in USDC via `FeeDistributor.sol` (Synthetix
`rewardPerToken` math, claimed with `claim(token)`), while `SafetyModule.sol`'s 15% buyback
maintains a standing VIRIO bid. The UI surfaces projected USDC APR at the claim screen so the
hold-vs-sell math is explicit at the decision point.

### System 7 — Points & Sybil pipeline (off-chain)
Pipeline run before each monthly root:
1. Ingest product events (charges, active relationships, longevity) + referral graph.
2. Score usage and referrals into points → bucket allocations (60M / 35M / 5M).
3. Filter: minimum-usage floor, funding-graph/clustering detection, referee-activation gating,
   per-wallet & per-referrer caps, churn clawback, timing heuristics.
4. Build the merkle tree from the filtered allocations and publish `rootₘ` on-chain + the
   methodology/eligibility list off-chain.

The chain only ever sees the final root; all heuristics live off-chain but are transparent and
auditable.

## KPIs to watch
- **Allowlist quality:** % of eligible wallets with real usage; sybil rejection rate.
- **Referral health:** referee activation rate; points-per-referrer distribution (flag concentration).
- **Stickiness:** % of claimed airdrop that gets staked vs. sold; time-weighted staked supply.
- **Sell pressure:** net airdrop tokens hitting DEXs per tranche vs. buyback absorption.
- **Retention:** wallets still active / still claiming in months 6–10.

## Deep-dive documents

| Doc | Covers |
|---|---|
| [`airdrop/README.md`](./airdrop/README.md) | Index + reading order |
| [`airdrop/01-overview-and-allocation.md`](./airdrop/01-overview-and-allocation.md) | Goals, allocation, sequencing |
| [`airdrop/02-qualification-and-points.md`](./airdrop/02-qualification-and-points.md) | Scoring model for each bucket |
| [`airdrop/03-sybil-resistance.md`](./airdrop/03-sybil-resistance.md) | Filters, clustering, gating |
| [`airdrop/04-anti-dump-design.md`](./airdrop/04-anti-dump-design.md) | The 1/2/3/5/7 stack in detail |
| [`airdrop/05-architecture-and-contracts.md`](./airdrop/05-architecture-and-contracts.md) | AirdropDistributor + engine design |
| [`airdrop/06-claim-flow-and-vesting.md`](./airdrop/06-claim-flow-and-vesting.md) | Merkle claim mechanics & windows |
| [`airdrop/07-kpis-and-monitoring.md`](./airdrop/07-kpis-and-monitoring.md) | Metrics, dashboards, alarms |
| [`airdrop/08-implementation-roadmap.md`](./airdrop/08-implementation-roadmap.md) | Build order + improvement ideas |
</content>
