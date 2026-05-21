# 04 — Anti-Dump Design

A 100M airdrop is a large potential sell wall. The goal is not to *trap* recipients (lockups
only delay the dump) but to **change the decision** so holding/using is the higher-EV choice.

We selected mechanisms **1, 2, 3, 5, and 7**, layered so that:
- **vesting buys time** (1),
- **staking + yield change the decision** (2, 5),
- **gating removes mercenaries** (3),
- **sybil filtering shrinks the wall before it forms** (7).

The numbered list below also references the menu of options we considered; #4 (full lockup) and
#6 (vote-escrow) were deliberately *not* chosen — see "Rejected options" at the end.

---

## System 1 — Streamed vesting, not a cliff (baseline)

The **10 equal monthly tranches (10%/mo × 10 months)** release is the first defense: no recipient
can dump their full allocation at TGE. Spreading unlocks flattens sell pressure and lets organic
demand (and the 15% buyback) absorb supply tranche by tranche.

- Purely time-based off `tgeTimestamp`.
- Tranche 1 unlocks at TGE; one more each ~30 days, to 100% at month 10.
- Implemented in `AirdropDistributor` (see [`05`](./05-architecture-and-contracts.md)).

## System 2 — Claim-and-stake bonus (strongest lever)

Recipients who **stake their claim** (convert to stVIRIO via `Staking.stakeFor`) instead of
taking it to their wallet get a **bonus**: a multiplier on the staked amount (proposed **+15–25%**)
and/or accelerated unlock of the next tranche.

Why it's the strongest lever: stVIRIO already earns 60% of protocol fees in USDC, so staking is
*already* the attractive option. The bonus tips it from "attractive" to "selling is clearly the
worse choice," and routes the airdrop **into the staking flywheel rather than the order book**.

- Bonus is funded from the reserved bonus pool (community slice + recycled forfeitures) — **not
  new supply**.
- Bonus VIRIO has a **minimum stake duration**; unstaking early **claws back only the bonus**.
- The **base tranche is never clawed back** — the incentive is purely positive, never punitive.

## System 3 — Use-it-or-lose-it tranches & gating

Implemented with **fresh monthly merkle roots** rather than one static root:
- Each month the engine builds `rootₘ` containing only wallets **still eligible** — qualifying
  product activity in the trailing ~30 days (`SubscriptionManager`/`PayrollManager`) and/or still
  staked (`Staking.sol`).
- To claim month *m*'s tranche, the wallet must prove inclusion in `rootₘ` **within month *m***.
  Fall out of eligibility or miss the window → not in the root → **forfeited**.
- Forfeited tokens are swept (`recycleForfeited()` keeper call after each window) into the bonus
  pool / a pro-rata top-up for wallets that stayed eligible.

> Trade-off: monthly roots are more operational overhead than one static root, but they are what
> make "use it or lose it" actually enforceable on-chain. This overhead is accepted deliberately.

## System 5 — Real yield as the reason to hold

Lockups only delay dumping; **yield changes the decision**. `claimAndStake` deposits straight
into the already-built `Staking.sol`, so the recipient immediately accrues:
- **60% of protocol fees in USDC** via `FeeDistributor.sol` (Synthetix `rewardPerToken` math,
  claimed with `claim(token)`), and
- a standing VIRIO bid from `SafetyModule.sol`'s **15% buyback**.

The airdrop is **marketed as "stake your claim and earn real USDC"** — holding has an ongoing
payoff, not just price hope. The claim UI surfaces **projected USDC APR** at the decision point
so the hold-vs-sell math is explicit (see Phase 4).

## System 7 — Anti-sybil = fewer pure dumpers

The biggest dump risk is sybil farmers who only ever intended to sell. Tight sybil filtering
(doc [`03`](./03-sybil-resistance.md)) removes much of the sell wall **before it exists** — the
cheapest anti-dump measure is simply not allocating to mercenaries. Because filtering re-runs
each month, farmers who slip through at TGE are pruned from later roots.

---

## How the layers compound

```
            TGE                       month 3                     month 10
 sell wall  ███████████   →   ████   (sybils pruned, 7)   →   ██  (most staked, 2+5)
 pressure   │             vesting (1) drip                  │
            └ only 10% liquid at once, gated monthly (3), and the staked share never hits the book
```

- **1** caps instantaneous supply to one tranche.
- **7** shrinks the eligible set to real users.
- **3** removes anyone who stops being a real user, tranche by tranche.
- **2 + 5** convert the remaining liquid tranches into staked, yield-earning positions.

Net effect: the sell wall is smaller at TGE than the headline 100M, drips instead of dumping,
shrinks further each month, and competes against a continuous USDC-yield + buyback bid.

## Rejected options (and why)

- **#4 Hard lockup / longer cliff:** pure delay, no behaviour change, and worse UX. Streamed
  vesting (1) + gating (3) achieves the spreading without an opaque cliff.
- **#6 Vote-escrow (ve-lock):** adds governance complexity and a new lock primitive. stVIRIO is
  intentionally a simple, liquid 1:1 receipt (`TOKENOMICS.md` §4); bolting on ve-locks would
  fracture that model for marginal benefit over (2)+(5).

## Open calibration questions

- Bonus size: +15% vs +25% — model against expected forfeiture inflow so the bonus pool stays solvent.
- Min stake duration for bonus: long enough to matter, short enough not to feel like a trap.
- Gating strictness: how much trailing activity counts as "still a real user" without punishing
  seasonal/lumpy businesses.
</content>
