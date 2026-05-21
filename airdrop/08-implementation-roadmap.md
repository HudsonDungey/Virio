# 08 — Implementation Roadmap & Improvement Ideas

How to actually build this, in dependency order, plus options worth considering. Maps onto the
launch phases in [`../phases/`](../phases/).

## Build order

### A. Contract — `AirdropDistributor` (Phase 1)
- [ ] Spec the contract from [`05`](./05-architecture-and-contracts.md): state, `claim`,
      `claimAndStake`, `setRoot`, `recycleForfeited`, `fundBonusPool`.
- [ ] Decide the open questions: bonus-clawback enforcement, canonical-chain vs. per-chain,
      forfeiture redistribution, fixed-`totalAllocation` vesting (recommended).
- [ ] Implement against existing `Staking.stakeFor` (`contracts/src/token/Staking.sol:111`).
- [ ] Use OZ `MerkleProof`; double-hash leaves; admin = multisig + timelock + guardian pause.
- [ ] Foundry tests in `contracts/test/`: vesting math, double-claim, wrong-root, bonus clawback,
      forfeiture recycling, full 10-month simulation, claim-and-stake → yield path.
- [ ] Add a deploy script in `contracts/script/` (fund 100M at deploy in Phase 3).

### B. Off-chain — Points & Sybil Engine (Phase 1, parallel)
- [ ] New package `packages/airdrop-engine` (shares types with `packages/sdk`).
- [ ] Idempotent, concurrency-safe event ingestion — **do not repeat the dashboard event-cache
      bug** documented in `thingstoworkon.md` (store by id/txHash, serialize syncs).
- [ ] Referral-graph DB + scoring (doc 02) + sybil filters (doc 03).
- [ ] Deterministic merkle-tree builder; reproducible roots from public data.
- [ ] Outputs per month: `rootₘ`, `allocations.json`, `proofs/`, `excluded.json`, `methodology.md`.

### C. UI — claim experience (Phase 4)
- [ ] Eligibility checker (wallet → allocation + reason code if excluded).
- [ ] `claim` vs `claimAndStake` with **projected USDC APR** shown at the decision point.
- [ ] Vesting/tranche timeline, monthly-window countdown, forfeiture warnings.
- [ ] Referral dashboard + public leaderboard.
- [ ] Airdrop ops view (doc 07).

### D. Operations (Phase 5)
- [ ] Keeper to `setRoot` + `recycleForfeited` each month (one canonical chain — recommended).
- [ ] Per-root publication checklist gate (doc 07).
- [ ] Appeals window tooling.
- [ ] Monitoring + alarms.

## Critical path / dependencies

```
Phase1: AirdropDistributor + Engine spec ─┐
                                          ├─► Phase2: audit funded ─► Phase3: audit + deploy + fund 100M
Phase1: Staking.stakeFor confirmed ───────┘                                   │
                                                                              ▼
                                              Phase4: claim UI ◄── needs deployed addresses + ABI
                                                                              │
                                                                              ▼
                                              Phase5: season → TGE root₁ → monthly roots → distribute
```

The engine and UI can be built against testnet deployments before audit completes; only **mainnet
deploy + funding** is gated on the audit (Phase 2 → 3).

## Improvement ideas / possibilities (not yet committed)

Ranked rough value vs. effort. Pick deliberately; don't build all of these.

1. **Quadratic / concave referral weighting** — already concave in doc 02; consider quadratic
   funding-style matching for the leaderboard to reward breadth over a few mega-referrers.
   *Value: med · Effort: low (off-chain only).*
2. **Proof-of-personhood layer** (e.g. an attestation/zk-credential) as an *optional booster*,
   not a hard gate — boosts verified humans rather than excluding the unverified.
   *Value: high for sybil resistance · Effort: high, adds external dependency.*
3. **Dynamic bonus** that scales inversely with the staked-share KPI — auto-raise the
   claim-and-stake bonus when staking lags, within published bounds.
   *Value: high · Effort: med; needs a published bound + governance sign-off.*
4. **Forfeiture pro-rata top-up** to loyal claimers (vs. bonus-pool only) — stronger loyalty
   signal but complicates leaf format. *Value: med · Effort: med.*
5. **Streaming claims (Sablier-style continuous vesting)** instead of monthly tranches — smoother
   but loses the clean "use-it-or-lose-it" window semantics of monthly roots. *Value: low ·
   Effort: med; probably not worth abandoning monthly roots.*
6. **Cross-chain claim** — let claimants pick the chain to receive on via xERC20. Defer; keep
   distributor canonical on one chain first (doc 05 recommendation). *Value: med · Effort: high.*
7. **On-chain transparency log** — emit a hash of each month's `excluded.json`/`allocations.json`
   alongside `setRoot` so the off-chain artifacts are tamper-evident. *Value: high for trust ·
   Effort: low.* **Recommended early.**
8. **Gas-free claims via relayer / EIP-2612-style** — lower the barrier for small allocations.
   *Value: med · Effort: med.*

## Definition of done (airdrop)

- [ ] `AirdropDistributor` audited and deployed, funded with exactly 100M VIRIO.
- [ ] Engine produces reproducible monthly roots; methodology + excluded list published each month.
- [ ] Claim UI live with APR display and claim-and-stake working end-to-end.
- [ ] 10 monthly roots published on schedule; forfeitures recycled; KPIs tracked.
- [ ] Post-mortem after month 10: staked-share, retention, sell-pressure vs. buyback.
</content>
