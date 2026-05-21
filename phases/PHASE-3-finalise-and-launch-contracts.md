# Phase 3 — Finalise & Launch Smart Contracts

**Goal:** take the frozen Phase 1 suite through external audit, fix everything, and **deploy the
full contract suite to mainnet** (Ethereum, Base, Arbitrum) ready for TGE.

**Exit criteria:** audits passed with all critical/high findings resolved and re-checked;
deterministic deployment complete on all launch chains; contracts funded and wired; everything
verified and handed to multisig.

---

## 3.1 Audit

- [ ] Engage **Spearbit + Trail of Bits** on the frozen commit (`TOKENOMICS.md` §8).
- [ ] Provide audit scope doc, invariants, threat model from Phase 1.
- [ ] Triage every finding: severity, fix plan, or documented accept-with-rationale.
- [ ] Fix **all critical/high**; fix or formally accept medium/low.
- [ ] **Re-audit / fix-review** on the patched code — don't deploy un-reviewed fixes.
- [ ] Publish audit reports (transparency; expected by community + listings).

## 3.2 Pre-deploy hardening

- [ ] Re-run full Foundry suite + invariants + fork tests on the post-audit commit.
- [ ] Final gas snapshot review.
- [ ] Freeze the **deployment commit**; tag it.
- [ ] Dry-run the entire deploy on a fork of each target chain.
- [ ] Confirm constructor params + initial config for every contract (fee splits, bridge limits,
      cooldown, owners).

## 3.3 Deployment (multichain, deterministic)

Per `TOKENOMICS.md` §3: same source, **deterministic CREATE3 address**, same behaviour everywhere.

- [ ] Deploy `VIRIO` — **mint full 1B on Ethereum mainnet only**; other chains start at 0 and grow
      via xERC20 burn-and-mint.
- [ ] Deploy `Staking`, `FeeDistributor`, `SafetyModule` **per chain** (chain-local).
- [ ] Deploy `VirioSubscriptionManager`, `VirioPayrollManager`, `SubscriptionDelegate7702` per chain.
- [ ] Deploy **`AirdropDistributor`** on the **canonical chain** (recommend Ethereum — avoids
      cross-chain root reconciliation; see [`../airdrop/05`](../airdrop/05-architecture-and-contracts.md)).
- [ ] Deploy **vesting contracts** for team/creator/investor/advisor/public-sale schedules.
- [ ] Configure **LayerZero V2** bridge + per-bridge rate limits (xERC20).
- [ ] Use/extend the existing deploy scripts (`contracts/script/Deploy*.s.sol`).

## 3.4 Wiring & funding

- [ ] `FeeDistributor` → `Staking` set; treasury + buyback operator set; 60/25/15 confirmed.
- [ ] `Staking` reward tokens registered (USDC etc. per chain).
- [ ] Subscription/Payroll managers point at `FeeDistributor`.
- [ ] **Fund `AirdropDistributor` with exactly 100M VIRIO**; set `tgeTimestamp` + bonus pool source.
- [ ] Fund vesting contracts per the allocation table.
- [ ] Allocate the **50M public-sale** tranche; allocate **50M LP** (to be burnt on deposit at TGE).

## 3.5 Verification & handover

- [ ] Verify all source on each chain's explorer.
- [ ] Sanity-check on-chain config matches `TOKENOMICS.md` (every allocation, every split).
- [ ] Confirm CREATE3 addresses match across chains.
- [ ] Transfer all ownership/admin to the **multisig + timelock** (no EOA owners left).
- [ ] Publish the deployed-address registry (used by Phase 4 UI + airdrop engine).
- [ ] Smoke test on mainnet with a tiny real transaction per critical path.

## Definition of done

- [ ] Audits passed; all critical/high resolved + re-reviewed; reports published.
- [ ] Full suite deployed on Ethereum/Base/Arbitrum at deterministic addresses, source-verified.
- [ ] `AirdropDistributor` funded with 100M; vesting + sale + LP buckets allocated.
- [ ] Everything wired, config matches tokenomics, ownership handed to multisig.
- [ ] Address registry published → unblocks Phase 4 + Phase 5.
</content>
