# $PULSE Tokenomics

## Overview

Pulse is a permissionless subscription + payroll protocol on EVM. Every charge pays a 0.1% executor fee, a 0.25% protocol fee, and a $1 USDC flat fee. $PULSE captures that revenue via a ve-model with real USDC yield and a community-first cap table.

- Total supply: **1,000,000,000 PULSE** (fixed, no inflation)
- Community-aligned: **75%** · Insiders: **20%** · Public: **5%**
- LP tokens are burnt **on deposit** — liquidity can grow but never be removed

## 1. Allocation (1,000,000,000 PULSE)

| Bucket | % | Tokens | Vesting |
|---|---|---|---|
| Community Ecosystem | 30% | 300M | 5-yr programmatic emission |
| Treasury (DAO) | 25% | 250M | Multisig at TGE → DAO at M12 |
| Airdrop | 10% | 100M | 1% / month for 10 months |
| Team & Future Hires | 8% | 80M | 12-mo cliff, 36-mo linear |
| Creator | 5% | 50M | 6-mo cliff, 24-mo linear |
| Investor Reserve | 5% | 50M | 12-mo cliff, 24-mo linear |
| Insurance / Safety Module | 5% | 50M | Held by contract |
| LP (burnt on deposit) | 5% | 50M | LP token sent to 0x…dead at mint |
| Public Sale | 5% | 50M | 25% TGE, 9-mo linear |
| Advisors | 2% | 20M | 6-mo cliff, 24-mo linear |

## 2. Emission Schedule

Approx. % circulating:

| TGE | M12 | M24 | M36 | M48 |
|---|---|---|---|---|
| 32% | 52% | 66% | 80% | 89% |

No insider unlocks before month 6.

## 3. Value Accrual

**vePULSE** — lock 1 week to 4 years. Non-transferable, decays linearly. `vePULSE = PULSE × (lock_remaining / 4yr)`. Lockers receive:

- Pro-rata USDC real yield
- Governance + gauge votes on emissions

**Protocol fee split** (DAO-set at TGE):

- 60% → vePULSE stakers (USDC)
- 25% → Treasury (USDC)
- 15% → On-market PULSE buyback → Safety Module

**Merchant fee-discount staking:**

| Stake (PULSE) | Protocol bps | Flat fee |
|---|---|---|
| 0 | 25 | $1.00 |
| 10k | 22 | $1.00 |
| 50k | 20 | $0.50 |
| 250k | 17 | $0.25 |
| 1M | 13 | waived |

## 4. Revenue Model

Assumptions: avg charge $50, 1.5 charges/relationship/month. `rev = TPV × 0.25% + charges × $1`.

| Year | Scenario | Active | TPV | Protocol Rev |
|---|---|---|---|---|
| 1 | Base | 50k | $37.5M | $1.2M |
| 1 | Bull | 200k | $150M | $4.9M |
| 3 | Base | 1M | $750M | $24M |
| 3 | Bull | 5M | $3.75B | $122M |
| 5 | Bull | 20M | $15B | $488M |

## 5. Holder Earnings

**USDC yield per 10k vePULSE/yr** (assuming 125M effective vePULSE outstanding, 60% of fees to lockers):

| Scenario | Annual USDC |
|---|---|
| Y1 Base ($1.2M) | $58 |
| Y3 Base ($24M) | $1,152 |
| Y3 Bull ($122M) | $5,856 |
| Y5 Bull ($488M) | $23,424 |

**Token FDV @ P/F multiples** (price = FDV / 1B supply):

| Year / Rev | 20× FDV (price) | 40× FDV (price) | 80× FDV (price) |
|---|---|---|---|
| Y1 Base $1.2M | $24M ($0.024) | $48M ($0.048) | $96M ($0.096) |
| Y3 Base $24M | $480M ($0.48) | $960M ($0.96) | $1.92B ($1.92) |
| Y3 Bull $122M | $2.44B ($2.44) | $4.88B ($4.88) | $9.76B ($9.76) |
| Y5 Bull $488M | $9.76B ($9.76) | $19.5B ($19.5) | $39B ($39) |

**Example position** — buy 100k PULSE at public sale $0.30 = $30k cost, lock 4yr:

- Y3 Base @ 40× P/F → token value $96k + ~$12k USDC yield = **~3.6× / $108k**
- Y3 Bull @ 40× P/F → token value $488k + ~$61k USDC yield = **~18× / $549k**

**Buyback floor** — 15% of fees → constant PULSE bid. Y3 Base = $3.6M/yr; Y3 Bull = $18.3M/yr.

## 6. Fundraise & Launch

- No VC round. Investor Reserve (5%) drawn only for strategic partners; unsold portion → Community at M24.
- **Public sale**: 50M PULSE offered openly — no allowlist, no private rounds. Expected clear $0.10–$0.30, raises $5–15M. 25% unlocks at TGE; 9-mo linear thereafter.
- **DEX liquidity**: Uniswap V3 on Base. Every LP token from the launch bucket is burnt the instant it is minted — liquidity grows but is never withdrawable.
- **Listings**: tier-2 CEX at M1; tier-1 conditional on volume.
- **Launch FDV**: $50–300M. Initial circ MC: $16–96M.

## 7. Risks & Mitigations

- LP burnt on deposit → liquidity is one-way, no rug surface
- Insider footprint 20%, no unlocks before M6
- Treasury 25% in 4-of-7 Safe + 48h timelock until DAO at M12
- Audits: Spearbit + Trail of Bits pre-TGE
- Airdrop sybil filters adjustable month-to-month
