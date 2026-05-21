# 07 — KPIs & Monitoring

What we measure to know the airdrop is acquiring real users and not building a sell wall. Each
KPI has a **source**, a **target/healthy band**, and an **alarm** condition.

## 1. Allowlist quality

| Metric | Source | Healthy | Alarm |
|---|---|---|---|
| % eligible wallets with real usage | engine + Subscription/Payroll events | > 90% | < 75% |
| Sybil rejection rate | engine filter output | stable per season | sudden spike/drop (filter mis-tuned) |
| Retroactive-floor share of user bucket | engine | ≤ 15% of 60M | exceeding cap |

> Read: are we paying real users, or did farmers get through?

## 2. Referral health

| Metric | Source | Healthy | Alarm |
|---|---|---|---|
| Referee activation rate | engine (referees crossing usage floor) | > 30% | < 10% (link-spam) |
| Points-per-referrer distribution | engine | long tail, no whale | top-1% > 30% of bucket |
| Self/circular-referral flags | sybil filter | near 0 after filter | rising post-filter |

> Read: are referrals bringing real users, or being farmed?

## 3. Stickiness (the one that matters most)

| Metric | Source | Healthy | Alarm |
|---|---|---|---|
| % of claimed airdrop staked vs. sold | `AirdropDistributor` events + `Staking` | > 50% staked | < 25% staked |
| Time-weighted staked supply | `Staking.sol` balances | rising | falling after each unlock |
| Bonus-clawback rate | `AirdropDistributor` | low | high (people staking just for bonus, then exiting) |

> Read: is claim-and-stake (Systems 2+5) actually converting recipients into holders?

## 4. Sell pressure

| Metric | Source | Healthy | Alarm |
|---|---|---|---|
| Net airdrop tokens hitting DEXs / tranche | DEX subgraph + claim events | < buyback absorption | > buyback for 2+ tranches |
| Buyback absorption (15% fees) | `FeeDistributor`/`SafetyModule` | covers net sells | persistently below net sells |
| Forfeiture volume / month | `recycleForfeited()` events | declining over season | spiking (mass churn) |

> Read: is the wall being absorbed, and is the drip working?

## 5. Retention (months 6–10)

| Metric | Source | Healthy | Alarm |
|---|---|---|---|
| Wallets still active in month *m* | Subscription/Payroll events | flat/rising | steep decline |
| Wallets still claiming in month *m* | claim events | tracks active set | claims ≫ activity (gating leak) |
| Cohort survival (TGE cohort → month 10) | engine | > 40% | < 20% |

> Read: did we acquire users who stay, or mercenaries who left after the first tranche?

## Dashboards & alerting

- Extend the existing dashboard (`packages/dashboard`) with an **airdrop ops view**: per-month
  root status, claimed/staked/forfeited split, sell-pressure vs. buyback chart, sybil-rejection log.
- **Per-root publication checklist** runs as a gate before `setRoot`:
  - [ ] root reproducible from public data
  - [ ] excluded list + reason codes published
  - [ ] eligible count within expected delta of last month
  - [ ] no single referrer over cap
- **Alarms** (page the team): sybil rate anomaly, staked-share below band, net sells exceeding
  buyback for 2 consecutive tranches, forfeiture spike.

## Decision levers (what you tune in response)

Because rules are tunable month-to-month (`TOKENOMICS.md` §8):
- Staked share too low → **raise the claim-and-stake bonus** or **lengthen gating**.
- Sell pressure > buyback → consider **slowing tranche cadence** or **boosting stake incentives**.
- Sybil rate spike → **tighten clustering thresholds**, widen appeals scrutiny.
- Referral concentration → **lower the per-referrer cap**.

Every change must be **published before** the month it applies to — never retroactively.
</content>
