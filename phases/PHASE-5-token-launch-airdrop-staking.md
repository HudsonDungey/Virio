# Phase 5 — Token Launch, Airdrop, Staking & Distribution

**Goal:** execute TGE, stand up liquidity + staking, and **run the airdrop season → snapshot →
10-month streamed distribution**, converting recipients into stakers via the anti-dump stack.

**Exit criteria:** TGE complete; liquidity live (LP burnt); staking earning real USDC yield;
airdrop `root₁` published and claimable; monthly roots published on schedule through month 10.

This phase executes the full airdrop spec — see [`../airdrop.md`](../airdrop.md) and
[`../airdrop/`](../airdrop/).

---

## 5.1 Pre-TGE — run the usage season (product-first)

The airdrop is product-first: the usage season runs on the **live product before TGE**.

- [ ] Publish the airdrop rules **before** the season: scoring (doc 02), sybil filters (doc 03),
      caps, retroactive-floor criteria, snapshot dates.
- [ ] Stand up the **Points & Sybil engine** ingesting `Subscription`/`Payroll` events + referral graph.
- [ ] Run referral program + community quests; public leaderboard live.
- [ ] Take **snapshot(s)** on the pre-announced dates.
- [ ] Score + sybil-filter → final eligibility; publish the **excluded list + reason codes**.
- [ ] Open the **appeals window**; resolve; finalise `allocations.json`.

## 5.2 TGE — token generation event

- [ ] Confirm circulating supply at TGE matches `TOKENOMICS.md` §2 (~32%).
- [ ] Release **public-sale** tokens (25% TGE, 9-mo linear).
- [ ] Seed **Uniswap V3** on Ethereum/Base/Arbitrum; **burn every LP token on deposit** (one-way).
- [ ] Activate fee flows: charges → `FeeDistributor` → 60% stakers / 25% treasury / 15% buyback.
- [ ] Set `AirdropDistributor.tgeTimestamp`.
- [ ] Confirm **no insider unlocks before M6** (team/creator/investor/advisor still locked).

## 5.3 Staking goes live

- [ ] `Staking` open; stVIRIO mint/burn working; cooldown at launch default (0, raisable ≤ 7d).
- [ ] `FeeDistributor` distributing USDC to stakers (Synthetix `rewardPerToken`).
- [ ] Buyback executing 15% → `SafetyModule` (standing bid).
- [ ] UI shows live yield + APR (Phase 4).

## 5.4 Airdrop distribution — month 0 (TGE)

- [ ] Publish **`root₁`** to `AirdropDistributor`; emit transparency hash of the artifacts
      ([`../airdrop/08`](../airdrop/08-implementation-roadmap.md) idea #7).
- [ ] **Tranche 1 (10%)** claimable: `claim` (to wallet) or **`claimAndStake`** (+15–25% bonus,
      into `Staking`).
- [ ] Verify claim-and-stake → stVIRIO → USDC yield path on mainnet with a real claim.
- [ ] Monitor day-one KPIs: claimed/staked split, sell pressure vs. buyback (doc 07).

## 5.5 Months 1–9 — streamed distribution & gating

Repeat each month (this is the live operation of anti-dump Systems 1/2/3/5/7):

- [ ] Engine re-scores eligibility (recent activity and/or still staked) + re-runs sybil filters.
- [ ] Run the **per-root publication checklist** (doc 07) before publishing.
- [ ] Publish **`rootₘ`**; open tranche *m* within its window.
- [ ] Keeper runs **`recycleForfeited()`** after each window → bonus pool / loyal-claimer top-up.
- [ ] Publish methodology + excluded list + transparency hash each month.
- [ ] Track KPIs; **tune within published bounds** (bonus size, gating strictness, caps) — and
      publish changes *before* the month they apply to, never retroactively.

## 5.6 Post-distribution (after month 10)

- [ ] Final tranche distributed; reconcile that ≤ 100M ever left the distributor.
- [ ] Sweep/route any residual per the documented forfeiture policy.
- [ ] **Post-mortem:** staked-share, retention (cohort survival M6–M10), sell-pressure vs.
      buyback, sybil rejection rate.
- [ ] Feed learnings into any future seasons / governance (Treasury → DAO at M12).

## Definition of done

- [ ] TGE complete; liquidity live with LP burnt; staking earning USDC.
- [ ] All 10 monthly airdrop roots published on schedule; forfeitures recycled.
- [ ] Claim-and-stake adoption tracked; majority of claimed supply staked (target, doc 07).
- [ ] Post-mortem published; insider unlocks remain on the `TOKENOMICS.md` schedule.
</content>
