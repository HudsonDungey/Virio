# 06 — Claim Flow & Vesting

## The lifecycle

```
SEASON (pre-TGE)         SNAPSHOT(S)        TGE              EACH MONTH (m=1..9)
─────────────────        ───────────        ───              ──────────────────
usage + referrals  ──►   engine scores  ──► publish root₁ ──► publish rootₘ
accrue continuously      + sybil filter     tranche1 live    gate on still-eligible
                                             (10%)            wallets, open tranche m
```

1. **Season runs on the live product**; points accrue from usage + referrals + community.
2. **One or more snapshots** are taken on pre-announced dates.
3. **Final eligibility** = snapshot state + season points, filtered for sybils.
4. **At TGE**, eligibility is published as a merkle root (`root₁`); each wallet claims via proof.
5. Claims **vest in 10 equal monthly tranches (10% each) over 10 months.**

## Per-wallet vesting (System 1)

Leaf = `keccak256(wallet, totalAllocation)`. Vesting is purely time-based off `tgeTimestamp`:

```
elapsedMonths  = (block.timestamp - tgeTimestamp) / 30 days
vestedTranches = min(elapsedMonths + 1, 10)     // tranche 1 unlocks AT TGE
maxClaimable   = totalAllocation * vestedTranches / 10
claimableNow   = maxClaimable - alreadyClaimed[wallet]
```

| Month | elapsedMonths | vestedTranches | Cumulative unlocked |
|---|---|---|---|
| TGE | 0 | 1 | 10% |
| +1 | 1 | 2 | 20% |
| +2 | 2 | 3 | 30% |
| … | … | … | … |
| +9 | 9 | 10 | 100% |

A wallet may let tranches accrue and **claim several at once** — subject to System 3's monthly
windows (you can only claim a tranche while you're in that month's root).

## Two claim paths

### `claim(proof, totalAllocation, amount)` → to wallet
Verifies proof against the current root, checks `amount <= claimableNow`, transfers VIRIO,
updates `alreadyClaimed`. **No bonus.**

### `claimAndStake(proof, totalAllocation, amount)` → to staking, + bonus
Routes the vested amount into `Staking.sol` via `stakeFor`, **mints stVIRIO to the claimant**,
and adds a **bonus** (+15–25% of the tranche, from the bonus pool, or early-unlock of the next
tranche). Bonus is **locked for a minimum duration**; early unstake claws back **only the bonus**
(never the base). See [`04`](./04-anti-dump-design.md) / [`05`](./05-architecture-and-contracts.md).

The claimant immediately starts earning **60% of protocol fees in USDC** (`FeeDistributor`),
with the **15% buyback** (`SafetyModule`) providing a standing bid — System 5.

## Use-it-or-lose-it windows (System 3)

- Each month the engine publishes a **fresh `rootₘ`** containing only wallets **still eligible**
  (recent product activity and/or still staked).
- To claim month *m*'s tranche, prove inclusion in `rootₘ` **within month *m***.
- Miss the window or fall out of eligibility → that tranche is **not in the root → forfeited**.
- `recycleForfeited()` sweeps forfeited tokens into the bonus pool / loyal-claimer top-up after
  each window.

> Practical UX implication: claimants who stake (claim-and-stake) generally stay in the root via
> the "still staked" condition, so staking also protects future tranches — reinforcing System 2.

## Worked example

Wallet `0xA` earns **totalAllocation = 1,000 VIRIO**.

- **TGE:** 100 VIRIO vested. `0xA` calls `claimAndStake(100)` → 100 staked + ~20 bonus
  (at +20%) = 120 stVIRIO, bonus locked 90 days. Starts earning USDC immediately.
- **+1mo:** still active → in `root₂`. Another 100 vested; stakes again (+20 bonus).
- **+5mo:** `0xA` stops using the product and unstakes everything before bonus unlock →
  bonuses to date are clawed back to the pool; base 600 already received is kept. `0xA` is **not
  in `root₆`** (no recent activity, not staked) → tranches 6–10 forfeited and recycled.

Contrast wallet `0xB` who claims-to-wallet at TGE and sells: gets 10% now, but must re-appear in
each monthly root to claim more — and earns no yield, no bonus.

## Edge cases to handle in the contract

- **Allocation change between months:** if `totalAllocation` can change month-to-month (gating),
  the leaf must encode the *current month's* claimable basis, or vesting must be computed against
  a fixed `totalAllocation` with eligibility only gating *whether* you can claim this month.
  **Decision (Phase 1):** keep `totalAllocation` fixed at TGE for vesting math; use monthly roots
  purely as an **eligibility gate** (present/absent), not to re-price allocations. Simpler and
  auditable.
- **Double-claim protection:** `alreadyClaimed[wallet]` monotonic; `amount <= claimableNow`.
- **Proof for the wrong root:** reject if proof doesn't verify against `currentRoot` for the
  active month.
- **Claiming after month 10:** no new vesting; any unforfeited remainder claimable per final root.
</content>
