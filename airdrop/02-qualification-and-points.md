# 02 — Qualification & Points

This is the scoring model the off-chain **Points & Sybil Engine** runs each season. All numbers
below are **starting parameters** — they are published before the season and tunable
month-to-month, as reserved in `TOKENOMICS.md` §8. Treat them as a v1 proposal to calibrate, not
gospel.

## Inputs (all on-chain, all verifiable)

Read from existing contracts:
- `VirioSubscriptionManager` events: `PlanCreated`, `Subscribed`, `Charged` (executed charges).
- `VirioPayrollManager` events: payroll runs / executed payments.
- `Staking.sol`: current stVIRIO balance and stake age (for ongoing-eligibility gating).

Off-chain only:
- Referral graph (referrer → referee), tied to wallet/account at signup.
- Community/quest completion records.

## Bucket 1 — Real product users (60M)

Points scale with **genuine value flowing through the protocol**, not raw transaction count.
Proposed score:

```
userPoints = w_volume · f(chargeVolumeUSD)
           + w_relationships · activeRelationships
           + w_longevity · accountAgeMonths
```

with:
- `f(x)` a **concave** function (e.g. `sqrt` or `log1p`) so a whale doesn't linearly dominate;
- starting weights `w_volume = 0.6`, `w_relationships = 0.3`, `w_longevity = 0.1`;
- **"active relationship"** = a subscription/payroll link that executed ≥1 real charge in the
  trailing 30 days.

### Minimum-usage floor
A wallet must clear a floor to score *anything* (e.g. ≥1 executed charge of ≥ $X total, across
≥1 relationship). Below the floor → 0 points. This is the cheapest sybil defense.

### Retroactive floor (guaranteed minimum)
Pre-TGE testnet users, early Discord, and OG community get a **guaranteed minimum allocation**
even if their mainnet volume is small, as a thank-you for bootstrapping. Implementation: a
fixed-size set with a flat per-wallet grant, capped so the retroactive floor consumes a bounded
slice of the 60M bucket (proposal: ≤ 15% of the user bucket = ≤ 9M).

### Allocation
Final user allocations = `60M × userPoints_i / Σ userPoints` after sybil filtering, with the
retroactive floor applied as a `max(floor, scored)` per qualifying OG wallet.

## Bucket 2 — Product referrals (35M)

The core rule: **the referrer earns only when the referee becomes active.** A raw signup is
worth nothing. Activation = referee crosses the same usage floor as Bucket 1.

### Decaying tiers
- **Direct (tier 1):** full credit for the referee's activation + a fraction of the referee's
  ongoing usage points (e.g. 20%).
- **Second-degree (tier 2):** partial credit (e.g. 5%). No tier 3+ — keeps the graph shallow and
  the incentive honest.

```
refPoints(r) = Σ_{a ∈ direct(r), active}   ( base_act + 0.20 · userPoints(a) )
             + Σ_{b ∈ second(r), active}   ( 0.05 · userPoints(b) )
```

### Per-referrer cap
A hard cap on `refPoints` per wallet (e.g. no single referrer may earn more than **0.5–1%** of
the 35M bucket) so a handful of whales/influencers can't drain it. Excess above the cap is
redistributed pro-rata to other referrers.

### Leaderboard bonus
A small carve-out (e.g. 5–10% of the 35M) is reserved for the **top-N referrers** by *activated*
referees, shown on a public leaderboard. This rewards quality (activations) not quantity (clicks).

## Bucket 3 — Community & social (5M)

Smallest slice on purpose. Earned via:
- **Quests** (Discord/X tasks) — completion-gated, deduplicated by account.
- **Content & ambassadors** — curated, role-based grants.
- **Bug/feedback bounties** — paid against a published schedule.

Points here are **flat or banded** (not volume-weighted) and **capped per wallet**, because
social activity is the easiest to fake — keeping the slice small and flat limits the blast radius
of any farming.

## Putting it together

```
For each wallet w:
   raw = userPoints(w) + refPoints(w) + communityPoints(w)
   → run sybil filters (doc 03): may zero or down-weight raw
   → apply caps and retroactive floor
   → normalise within each bucket to its token cap (60M / 35M / 5M)
   → totalAllocation(w) = userTokens(w) + refTokens(w) + communityTokens(w)
```

`totalAllocation(w)` is the value that goes into the merkle leaf
`keccak256(w, totalAllocation)` (see [`06-claim-flow-and-vesting.md`](./06-claim-flow-and-vesting.md)).

## Publish-before-season checklist

- [ ] Final weights, floors, tiers, and caps frozen and published.
- [ ] Snapshot date(s) announced.
- [ ] Retroactive-floor wallet set finalised and published (with the criteria used).
- [ ] Worked examples published so users can predict their score.
- [ ] Methodology doc + open-source scoring script committed for auditability.
</content>
