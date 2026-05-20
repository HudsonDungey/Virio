# $VIRIO Tokenomics

## Overview

Virio is a permissionless subscription + payroll protocol that runs natively on every major EVM chain. Every charge pays a 0.1% executor fee, a 0.25% protocol fee, and a $1 USDC flat fee. $VIRIO captures that revenue and pays it back to stakers as real fee-token yield, on the same chain the fee was earned.

- Total supply: **1,000,000,000 VIRIO** (fixed, no inflation)
- Cross-chain via **xERC20 (ERC-7281)** — single canonical supply across every chain
- Community-aligned: **75%** · Insiders: **20%** · Public: **5%**
- LP tokens are burnt **on deposit** — liquidity can grow but never be removed

## 1. Allocation (1,000,000,000 VIRIO)

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

The initial 1B is minted on Ethereum mainnet only. On every other chain, VIRIO's `totalSupply()` starts at zero and only grows as the token bridges in via burn-and-mint. The sum of `totalSupply()` across every chain is always exactly 1,000,000,000.

## 2. Emission Schedule

Approx. % circulating:

| TGE | M12 | M24 | M36 | M48 |
|---|---|---|---|---|
| 32% | 52% | 66% | 80% | 89% |

No insider unlocks before month 6.

## 3. Multichain Architecture

$VIRIO deploys to **Ethereum, Base, and Arbitrum at TGE**, with more EVMs to follow. Same source, deterministic CREATE3 address, same protocol behavior everywhere.

**Cross-chain token (xERC20 / ERC-7281).** Bridging is burn-and-mint: VIRIO burns on the source chain and mints on the destination via an allowlisted bridge with per-window rate limits. There are no wrapped or bridged variants — every VIRIO is the canonical VIRIO, just temporarily resident on a particular chain. Day-one bridge is **LayerZero V2**; additional bridges (Hyperlane, Across, CCIP) can be added under the same xERC20 limits with no token migration.

**Price peg.** Because supply is conserved and every VIRIO is fungible across chains, any price spread between chains is closed by arbitrageurs. Same mechanism that keeps USDC at $1.00 across 12+ chains.

**Stake locally, earn locally.** Staking, fee distribution, treasury, and the Safety Module are all **chain-local**. Fees earned on Base pay Base stakers; fees earned on Arbitrum pay Arbitrum stakers. No bridging needed to collect yield.

## 4. Value Accrual

**stVIRIO — a fungible 1:1 staking receipt.** Stake N VIRIO → receive N stVIRIO. Burn N stVIRIO → redeem N VIRIO. No NFTs, no lock duration, no decay. stVIRIO is a regular transferable ERC-20 (with ERC20Votes for governance), so it can be traded, LP'd, or used as collateral while it earns.

Rewards accrue **continuously** against your stVIRIO balance using the Synthetix `StakingRewards` math:

```
rewardPerToken[t] += (rewardsDeposited × 1e18) / stVIRIO.totalSupply
earned(user)       = stBalance[user] × (rewardPerToken[t] − rewardPerTokenPaid[user]) / 1e18
```

A user who stakes one second before a fee distribution earns **zero** from that distribution (their accumulator snapshot is taken at stake). No timing attack.

The reward accumulator is **token-agnostic**: any fee token Virio collects on that chain (USDC, USDT, DAI, …) accrues independently and is claimed via `claim(token)`.

Unstaking is subject to a DAO-tunable cooldown (default `0` at launch, can be raised to ≤7 days if needed).

**Protocol fee split (per chain, DAO-set at TGE):**

- 60% → stVIRIO stakers (paid in the fee token, on that chain)
- 25% → Chain-local treasury
- 15% → On-market VIRIO buyback on that chain → Safety Module

**Merchant fee-discount staking:**

| Stake (VIRIO) | Protocol bps | Flat fee |
|---|---|---|
| 0 | 25 | $1.00 |
| 10k | 22 | $1.00 |
| 50k | 20 | $0.50 |
| 250k | 17 | $0.25 |
| 1M | 13 | waived |

## 5. Revenue Model

Assumptions: avg charge $50, 1.5 charges/relationship/month. `rev = TPV × 0.25% + charges × $1`.

| Year | Scenario | Active | TPV | Protocol Rev |
|---|---|---|---|---|
| 1 | Base | 50k | $37.5M | $1.2M |
| 1 | Bull | 200k | $150M | $4.9M |
| 3 | Base | 1M | $750M | $24M |
| 3 | Bull | 5M | $3.75B | $122M |
| 5 | Bull | 20M | $15B | $488M |

## 6. Holder Earnings

**USDC yield per 10k stVIRIO / yr** (assuming 125M stVIRIO outstanding across all chains, 60% of fees to stakers):

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

**Example position** — buy 100k VIRIO at public sale $0.30 = $30k cost, stake all of it:

- Y3 Base @ 40× P/F → token value $96k + ~$12k accumulated USDC yield = **~3.6× / $108k**
- Y3 Bull @ 40× P/F → token value $488k + ~$61k accumulated USDC yield = **~18× / $549k**

**Buyback floor** — 15% of fees → constant VIRIO bid, executed on each chain's local DEX. Y3 Base = $3.6M/yr; Y3 Bull = $18.3M/yr.

## 7. Fundraise & Launch

- No VC round. Investor Reserve (5%) drawn only for strategic partners; unsold portion → Community at M24.
- **Public sale**: 50M VIRIO offered openly — no allowlist, no private rounds. Expected clear $0.10–$0.30, raises $5–15M. 25% unlocks at TGE; 9-mo linear thereafter.
- **DEX liquidity**: Uniswap V3 on Ethereum, Base, and Arbitrum at TGE. Every LP token from the launch bucket is burnt the instant it is minted — liquidity grows but is never withdrawable.
- **Listings**: tier-2 CEX at M1; tier-1 conditional on volume.
- **Launch FDV**: $50–300M. Initial circ MC: $16–96M.

## 8. Risks & Mitigations

- LP burnt on deposit → liquidity is one-way, no rug surface
- xERC20 with per-bridge rate limits → no single bridge can drain supply on any chain
- Insider footprint 20%, no unlocks before M6
- Treasury 25% in 4-of-7 Safe + 48h timelock until DAO at M12
- Audits: Spearbit + Trail of Bits pre-TGE
- Airdrop sybil filters adjustable month-to-month
