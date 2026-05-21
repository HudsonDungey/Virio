# $VIRIO Airdrop

## Overview

The Virio airdrop distributes **100,000,000 VIRIO (10% of supply)** to the people who actually build
the network: real product users and the referrers who bring them. It is a **retroactive + seasonal
reward**, not a giveaway — eligibility is earned through verifiable on-chain product usage and
qualified referrals, then claimed on a streamed schedule designed to favor people who stay.

- **Sequencing:** *product first.* The product and a usage-driven points season run **before** TGE.
  A snapshot is taken, then the airdrop becomes claimable at/after TGE.
- **The "whitelist" is an airdrop-eligibility allowlist** — it is **not** sale access. The public sale
  has no allowlist (see `TOKENOMICS.md`).
- **Release schedule:** **1% of the airdrop per month for 10 months** (per `TOKENOMICS.md`), claimed
  per-wallet via a merkle distribution.

## Allocation (100,000,000 VIRIO)

| Bucket | Share | Tokens | Earned by |
|---|---|---|---|
| **Real product users** | 60% | 60,000,000 | Active subscriptions / payroll relationships, charges actually executed. Includes a retroactive floor for testnet + OG community. |
| **Product referrals** | 35% | 35,000,000 | Inviting users who themselves become *active* (qualified usage, not raw signups). |
| **Community & social** | 5% | 5,000,000 | Discord/X quests, content, ambassador program, bug/feedback bounties. |

> **Holders & stakers are rewarded separately, not from this pool.** In a product-first launch there
> are no VIRIO holders to snapshot before TGE. Holder/staker value comes from the live mechanics in
> `TOKENOMICS.md`: stVIRIO stakers earn **60% of protocol fees in USDC continuously**, backed by the
> **15% buyback floor** and **merchant fee discounts**. The airdrop acquires users; fee yield retains
> holders.

## How to qualify

### Real product users (60M)
- Run real activity: create/subscribe to plans, run payroll, have charges actually execute.
- Points scale with **genuine value flowing through the protocol** (e.g. charge volume + number of
  active relationships + account longevity), not with one-off transactions.
- Retroactive floor: pre-TGE testnet users, early Discord, and OG community get a guaranteed minimum.

### Product referrals (35M)
- Wallet-/account-tied referral links.
- Referrer earns **only when the referee becomes active** (subscribes / runs payroll). Raw signups
  earn nothing.
- Decaying tiers (full credit for direct referrals, partial for second-degree) and a **per-referrer
  cap** so a few whales can't drain the bucket.
- Public leaderboard with bonus allocation for top referrers.

### Community & social (5M)
- Quests, content, ambassador roles, and bug/feedback bounties. Deliberately the smallest slice to
  keep the airdrop weighted toward real economic activity.

## Sybil resistance

Eligibility rules are published **before** the season and may be tuned month-to-month (as reserved in
`TOKENOMICS.md`):
- Minimum real-usage floor to be eligible at all.
- Funding-graph / clustering analysis to detect one actor running many wallets.
- Referral-quality gating: the referee must reach an activity threshold.
- Per-wallet and per-referrer caps.
- Clawback of points if a referee churns immediately after qualifying.

## Claim flow

1. Season runs on the live product; points accrue from usage + referrals + community.
2. One or more **snapshots** are taken on pre-announced dates.
3. Final eligibility = snapshot state + season points, filtered for sybils.
4. At TGE, eligibility is published as a **merkle root**; each wallet claims via merkle proof.
5. Claims unlock **1% of the airdrop per month for 10 months**. See anti-dump design below.

---

## Reducing dump risk over time

A 100M airdrop is a large potential sell wall. The goal is to convert recipients into long-term
holders/stakers and make holding the higher-EV choice. Mechanisms below are layered — vesting alone
is not enough.

### 1. Streamed vesting, not a cliff (baseline)
The **1%/mo × 10 months** release is the first defense: no recipient can dump their full allocation at
TGE. Spreading unlocks over ~10 months flattens sell pressure and lets organic demand absorb supply.

### 2. Claim-and-stake bonus (strongest lever)
Offer a **meaningfully larger allocation to recipients who stake (convert to stVIRIO) instead of
selling** — e.g. a bonus multiplier on tranches that are staked, or instant unlock of a future tranche
when the current one is staked. Because stVIRIO earns 60% of protocol fees in USDC, staking is already
attractive; the bonus makes selling the clearly worse choice. This redirects the airdrop into the
staking flywheel rather than the order book.

### 3. Use-it-or-lose-it tranches
Make each monthly tranche **claimable only within a window**, and/or **gate the next tranche on
continued eligibility** (e.g. the wallet must still be an active product user / still staked). Pure
mercenaries who stop using the product and dump forfeit their remaining unclaimed tranches; those
forfeited tokens recycle to the ecosystem or to remaining loyal users.

### 4. Loyalty multiplier that grows with holding time
Weight rewards by **duration**, not a single snapshot — time-weighted balance so tokens borrowed for
one snapshot don't qualify, and longer holding/staking earns progressively more. Rewards patience,
punishes flip-and-leave.

### 5. Real yield as the reason to hold (not just lockups)
Lockups only delay dumping; **yield changes the decision.** stVIRIO pays continuous USDC fee yield and
the 15% buyback provides a standing bid. Market the airdrop as *"stake your claim and earn real USDC,"*
so holding has a clear ongoing payoff rather than pure price speculation.

### 6. Optional early-exit haircut
If desired, allow recipients to exit unvested tranches early but at a **penalty/haircut**, with the
forfeited portion redistributed to those who keep vesting. Makes dumping explicitly costly while still
giving people an exit.

### 7. Anti-sybil = fewer pure dumpers
The biggest dump risk is sybil farmers who only ever intended to sell. Tight sybil filtering (section
above) removes much of the sell wall *before* it exists — the cheapest anti-dump measure is simply not
allocating to mercenaries.

### 8. Reward continued activity, not a one-time drop
Run **recurring seasons** funded from the 30% community/ecosystem bucket so the best way to keep
earning is to keep using and holding. Turns a one-time event into an ongoing reason to stay.

### 9. Supportive liquidity & supply design (already in tokenomics)
- **LP burnt on deposit** → liquidity is one-way; depth grows but can't be rugged.
- **15% fee buyback** → constant on-market VIRIO bid that absorbs sell pressure.
- **No insider unlocks before M6** → no insider overhang colliding with airdrop unlocks early.

### Recommended default stack
1%/mo × 10mo streaming **+** claim-and-stake bonus **+** use-it-or-lose-it next-tranche gating **+**
time-weighted loyalty **+** real USDC yield messaging. Tight sybil filtering underpins all of it.

---

## KPIs to watch
- **Allowlist quality:** % of eligible wallets with real usage; sybil rejection rate.
- **Referral health:** referee *activation* rate; points-per-referrer distribution (flag concentration).
- **Stickiness:** % of claimed airdrop that gets **staked vs. sold**; time-weighted staked supply.
- **Sell pressure:** net airdrop tokens hitting DEXs per tranche vs. buyback absorption.
- **Retention:** wallets still active / still claiming in months 6–10.
