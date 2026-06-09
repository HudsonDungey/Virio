# Virio — Codebase Review & Smart Contract Audit

**Date:** 2026-06-09
**Scope:** Full monorepo — `contracts/` (Foundry/Solidity), `packages/sdk`, `packages/scheduler`, `packages/dashboard`.
**Reviewer:** Automated engineering review.
**Commit:** `claude/smart-contract-audit-tul3qv` branch head.

> This is an internal engineering review, not a substitute for a professional third‑party audit. The site advertises a Code4rena pre‑TGE audit; nothing here replaces that. Findings are rated by my own judgement of likelihood × impact.

---

## 1. Executive Summary

Virio is a non‑custodial, pull‑based ERC‑20 subscription + payroll protocol with an accompanying governance token (`VIRIO`), staking module, fee distributor, and an EIP‑7702 delegation target. The contracts are small, single‑purpose, and follow the repo's stated doctrine well: CEI ordering, custom errors, reentrancy guards, events on every state change, and no upgradeability.

Overall the contract code is **clean and defensively written**. No issue I found lets an attacker drain funds they aren't already approved to spend — the non‑custodial design means the worst‑case blast radius is bounded by each user's own ERC‑20 allowance. The most material findings concern (1) the `VIRIO`/`Staking`/`FeeDistributor` reward path, where instant reward distribution is sandwichable and a first‑depositor rounding edge exists, (2) inconsistencies between the two managers (ownership handover, period drift), and (3) a handful of trust‑boundary validation gaps in the TypeScript layer.

| Area | Rating |
|---|---|
| Subscription / Payroll managers | Solid. Minor findings only. |
| VIRIO token (xERC20 + Votes) | Solid. One rate‑limit init nuance. |
| Staking | Sandwichable reward stream; first‑depositor dust; unbounded historical token list. |
| FeeDistributor | Mostly fine; `distributeMany` swallows errors by design. |
| Delegate7702 | Careful design; revocation/period‑state nuances worth documenting. |
| SDK / Scheduler / Dashboard | Good. Validation gaps at chain/RPC and API boundaries. |
| Tooling / CI | **No CI pipeline. No automated test gating. Hardhat + Foundry coexist confusingly.** |

---

## 2. Severity Legend

- **Critical** — direct loss of funds / protocol insolvency, realistic path.
- **High** — loss of funds or correctness break under specific but plausible conditions.
- **Medium** — value leakage, griefing, or correctness break with constraints.
- **Low** — minor / defense‑in‑depth / requires privileged or unlikely conditions.
- **Informational** — style, doctrine, hygiene, documentation.

No Critical findings. No High findings with an unprivileged path. Items below are Medium and lower.

---

## 3. Smart Contract Findings

### 3.1 Staking — `notifyReward` distributes instantly and is sandwichable
**Severity: Medium** · `contracts/src/token/Staking.sol:158`

`notifyReward` adds the full reward to `rewardPerTokenStored` in a single block:

```solidity
uint256 delta = (amount * 1e18) / supply;
rewardPerTokenStored[rewardToken] += delta;
```

Because the reward is realized immediately (no `periodFinish` / drip schedule like the canonical Synthetix `StakingRewards`), an actor who sees a pending `notifyReward` (or the permissionless `FeeDistributor.distribute` that triggers it) can:

1. `stake` a large amount in the same block just before `notifyReward`,
2. let the reward settle to their inflated balance,
3. `unstake` immediately after (cooldown defaults to `0`).

They capture a pro‑rata slice of a reward they contributed nothing to earning. The contract comment claims "No timing‑attack on distributions," which is true for *interleaving two notifies* but **not** for sandwiching a single notify. With `cooldown == 0` (the default) this is a clean, atomic‑ish MEV extraction.

**Recommendation:** Stream rewards over a duration (`periodFinish`, `rewardRate`) as canonical `StakingRewards` does, or require a non‑zero unstake cooldown so capital must be committed across the reward window. At minimum, correct the comment so the limitation is documented.

---

### 3.2 Staking — first‑depositor / small‑supply reward dust and rounding loss
**Severity: Low** · `contracts/src/token/Staking.sol:165,210,241`

`delta = (amount * 1e18) / supply` truncates. When `supply` is large relative to `amount * 1e18`, or for the remainder, the lost dust stays in the contract with no sweep path (`rescue`‑style function absent on Staking). Repeated small `notifyReward` calls against a large supply can round to zero (`delta == 0`) while still transferring tokens in via `safeTransferFrom`, permanently stranding them.

**Recommendation:** Reject `notifyReward` when computed `delta == 0` (i.e., `amount * 1e18 < supply`), or carry a remainder accumulator. Consider an owner `rescue` for stranded non‑reward dust (guarded so it can't touch staked principal).

---

### 3.3 Staking — `deregisterRewardToken` never shrinks the settlement loop
**Severity: Low** · `contracts/src/token/Staking.sol:188,235`

`deregister` only flips `isRewardToken[token] = false`; the token stays in `rewardTokens[]` forever (intentionally, so historical balances remain claimable). But `_settle` and `_update` iterate the **full** `rewardTokens` array on every stake/unstake/transfer. The list is capped at `MAX_REWARD_TOKENS = 16`, so gas is bounded — but a fully‑churned set of 16 dead tokens permanently taxes every transfer of `stVIRIO`, and the cap counts dead tokens against live ones (you can't register a 17th even if 16 are dead).

**Recommendation:** Track a separate "active for registration" count, or allow true removal once a token's `rewardPerTokenStored` is fully settled/zeroed. At minimum document that the cap includes deregistered tokens.

---

### 3.4 Subscription vs Payroll — inconsistent period anchoring (drift)
**Severity: Low (correctness/spec)** · `VirioSubscriptionManager.sol:193` vs `VirioPayrollManager.sol:375`

The two managers compute the next due time differently:

- **Subscription:** `nextChargeAt = block.timestamp + sub.period` — resets from the *charge* time. A late charge pushes the whole schedule forward (drift). Invariant #6 in the header actually says this ("resets from charge time"), so it's intentional — but it contradicts the payroll model and the general "additive, drift‑free" language used elsewhere.
- **Payroll:** `nextPayAt = r.nextPayAt + plan.period` — additive, drift‑free. A late execution keeps the original cadence and can immediately become due again.

This is a real product‑level asymmetry: a subscriber who is charged late effectively gets a longer period for free, while a payroll recipient does not. Worse, the payroll "catch‑up" is silent — if a keeper misses N periods, the recipient becomes chargeable N times in a row with no cap on catch‑up frequency (each call still respects `nextPayAt += period`, so N back‑to‑back executions can drain N periods of pay in one block once overdue).

**Recommendation:** Decide on one model deliberately and document the rationale per contract. If catch‑up draining is undesirable for payroll, clamp `nextPayAt = max(nextPayAt + period, block.timestamp)` or cap catch‑up to one period.

---

### 3.5 Managers use single‑step `transferOwnership`; token contracts use `Ownable2Step`
**Severity: Low** · `VirioSubscriptionManager.sol:270`, `VirioPayrollManager.sol:277`

`VIRIO`, `Staking`, `FeeDistributor`, `SafetyModule` all use OpenZeppelin `Ownable2Step` (good — accept‑on‑claim prevents handing ownership to a typo'd address). But the two managers hand‑roll single‑step `transferOwnership` with no `acceptOwnership`. A fat‑fingered `newOwner` permanently bricks `setFeeRecipient` / fee tuning.

**Recommendation:** Make the managers consistent — either adopt `Ownable2Step` or add a two‑step accept. These contracts control fee parameters and the fee recipient, so the asymmetry is worth closing.

---

### 3.6 Delegate7702 — period spend state survives revocation; re‑init nonce semantics
**Severity: Low** · `contracts/src/VirioSubscriptionDelegate7702.sol:158,93`

`revoke()` does `delete config` and `++authEpoch`, but `spentInPeriod[pid]` is **not** cleared. A subsequent re‑initialization (new `initWithSig`) starts with `config.manager == address(0)` so init is allowed again, but the *period spend ledger* persists. If the same EOA re‑initializes within the same `periodDuration` window with the same period boundaries, previously‑spent amounts still count against `maxPerPeriod`. This is arguably safe‑by‑default (more restrictive), but it's surprising and under‑documented, and if `periodDuration` changes on re‑init the `currentPeriodId()` math shifts under the old ledger.

Separately, `initWithSig` checks `init.nonce != authEpoch`. After a revoke, `authEpoch` has incremented, so an old signature (signed against the previous epoch) is correctly rejected — good. But there is no expiry binding between the *signed period parameters* and the epoch they were intended for beyond the nonce; document that a signature is single‑use per epoch and that signers must re‑sign after any revoke.

**Recommendation:** On `revoke()`, also reset the spend ledger for the current period (or namespace `spentInPeriod` by `authEpoch`, e.g. `mapping(uint256 epoch => mapping(uint256 period => uint256))`). Document the re‑init story explicitly.

---

### 3.7 Delegate7702 — `ecrecover` malleability / zero‑address guard
**Severity: Low** · `contracts/src/VirioSubscriptionDelegate7702.sol:205`

`_recoverSigner` uses raw `ecrecover` with no check that `s` is in the lower half‑order range and no explicit `signer != address(0)` guard. The downstream check `signer != address(this)` saves it here (a zero or malleated recovery won't equal `address(this)` unless the real owner signed), so it is not exploitable as written. But the repo's own doctrine says "Reject malleable signatures" and "verify the recovered signer is exactly who you expect — never non‑zero." Use OpenZeppelin `ECDSA.recover`, which enforces low‑`s` and rejects `address(0)`, rather than hand‑rolled assembly.

**Recommendation:** Replace the inline assembly recovery with OZ `ECDSA.tryRecover` / `recover`.

---

### 3.8 VIRIO — rate‑limit `ratePerSecond` truncation and "limits too high" cap
**Severity: Low / Informational** · `contracts/src/token/VIRIO.sol:184,110`

`ratePerSecond = newMax / RATE_LIMIT_DURATION` truncates; for small `newMax` (< 86 400 wei over a 1‑day window) the refill rate rounds to zero and the bridge limit never refills passively — it only resets when `setLimits` is called again. For an 18‑decimal token with realistic bridge caps this is a non‑issue, but worth a comment. The `> type(uint256).max / 2` guard prevents overflow in `elapsed * ratePerSecond`; fine.

Also note `mint()` and `burn()` are callable by **any** address — they're gated only by the per‑bridge limit, which is zero for unconfigured addresses (`_currentLimit` returns 0 when `maxLimit == 0`, so `_useMinterLimits` reverts `IXERC20_NotHighEnoughLimits`). That is the correct xERC20 pattern, but it means the security of the entire supply rests on the owner never calling `setLimits` for a malicious/compromised bridge. Make that trust assumption explicit in deployment docs.

---

### 3.9 FeeDistributor — `distributeMany` silently swallows per‑token failures
**Severity: Informational (by design)** · `contracts/src/token/FeeDistributor.sol:119`

`distributeMany` wraps each `this.distribute(token)` in `try/catch {}` so one unregistered/odd token doesn't block the rest. This matches the "batch must fail soft per item" rule. The only caution: a token that *should* distribute but reverts for a transient reason (e.g. staking paused) is silently skipped with no event — an off‑chain keeper can't tell "nothing to do" from "tried and failed." Consider emitting a `DistributeSkipped(token, reason)` or returning a success bitmap.

Also `rescue()` (line 155) is owner‑only and can pull *any* token to *any* address — including fee tokens mid‑accumulation. It's guarded by `onlyOwner` and can't reenter an in‑flight `distribute` (different tx), but it is a broad trusted‑owner power; ensure the owner is the multisig/DAO and document it.

---

### 3.10 `MockUSDC` lives under `src/` and is compiled as a deployable artifact
**Severity: Informational** · `contracts/src/test-helpers/MockUSDC.sol`

`MockUSDC` is under `src/`, not `test/`, so `forge build` emits it as a normal artifact and the SDK/dashboard could import it. It has an unrestricted public `mint`. Harmless on testnet, but it shouldn't be deployable from a production build. Move it to `test/` or a `mocks/` path excluded from the production profile, and make sure no deploy script can reach it on mainnet.

---

### 3.11 Subscription/Payroll — flat fee can exceed amount only caught after state writes
**Severity: Informational** · `VirioSubscriptionManager.sol:214`, `VirioPayrollManager.sol:393`

`if (amount < execFee + protocolFee) revert InvalidAmount();` is checked **after** `sub.totalSpent += amount` and `nextChargeAt` are written, but before any transfer. Because the whole tx reverts, no state persists — correct. The subtle risk: an owner who raises `protocolFlatFee` above a plan's `amount` silently bricks every charge for that plan (always reverts `InvalidAmount`), and subscriptions can't self‑heal. Consider validating fee changes against active plans, or document that flat‑fee increases can strand low‑value plans until cancelled.

---

### 3.12 Minor / hygiene (contracts)

- **`IVirioSubscriptionManager` declares `SpendCapExceeded` and `IVirioPayrollManager` declares `TransferFailed` errors that are never used** (`interfaces/IVirioSubscriptionManager.sol:25`, `interfaces/IVirioPayrollManager.sol:77`). Dead declarations — remove them (doctrine: no dead code).
- **`EXECUTOR_FEE_BPS()` view duplicates the public `executorFeeBps` getter** purely for interface compliance. Acceptable, but the naming (constant‑style `UPPER_CASE` for a mutable value) is misleading — it suggests immutability that doesn't exist.
- **`charge()` / `executePayroll()` emit no event on the spend‑cap auto‑cancel transfer path** beyond `Cancelled`/`RecipientRemoved`. An indexer sees the cancel but no "final partial charge" — fine, since no charge happens, but worth confirming the dashboard handles "cancelled with zero final charge" correctly.
- **`getPlanRecipients` / `getDueRecipients` loop unbounded `_planRecipientIds`** in `view` functions. They're `view` (no gas to callers via `eth_call`), but a plan with thousands of recipients can exceed RPC `eth_call` gas/time limits and break the dashboard. Paginate.

---

## 4. TypeScript / Off‑chain Findings

### 4.1 Trust‑boundary validation: decoded logs and event args cast with `as unknown`
**Severity: Medium (doctrine: validate at boundaries)**
`packages/sdk/src/indexer.ts:54`, `packages/sdk/src/Virio.ts:369,468`, `packages/dashboard/lib/chain-reads.ts:89`

RPC `getLogs` results and event args are cast straight through `as unknown as DecodedLog[]` / `as never` with no runtime shape check. Chain/RPC data is exactly the "untrusted until validated" boundary the CLAUDE.md doctrine calls out. A malformed or unexpected log silently produces wrong data downstream (and `as never` defeats the type system entirely).

**Recommendation:** Narrow with explicit type guards (`isVirioLog(log)`), or a tiny hand‑rolled validator. Avoid `as never`.

### 4.2 API metadata endpoints store unvalidated, unbounded user strings
**Severity: Medium** · `packages/dashboard/app/api/plans/route.ts:42`

`POST /api/plans` does `String(b.name ?? "")` with no length cap or sanitization and stores it in an in‑memory map. Unbounded strings → memory DoS; if any consumer renders these without escaping, stored‑XSS surface. Validate length and content at the boundary.

### 4.3 Scheduler webhook dispatch lacks idempotency key
**Severity: Low** · `packages/scheduler/src/Scheduler.ts:90`

Charges are idempotent on‑chain, but webhook delivery isn't deduplicated — a retried tick can re‑POST the same logical event. The event already has an `id`; send it as `x-virio-idempotency-key` so receivers can dedupe. (Webhook HMAC verification itself correctly uses `timingSafeEqual` — good.)

### 4.4 Scheduler `extractNextChargeAt` fallback invents a timestamp
**Severity: Low** · `packages/scheduler/src/Scheduler.ts:115`

On a failed chain read it returns `now + 86_400` — a guessed one‑day delay that can desync local state from the chain. Prefer leaving the stored value unchanged and retrying, rather than writing a fabricated time.

### 4.5 Dead / deprecated API routes returning 410
**Severity: Informational** · `app/api/plans/[id]/activate`, `.../deactivate`, `app/api/subscriptions/[id]/cancel`

These return HTTP 410 Gone. Doctrine says delete dead code — remove the routes (git remembers) rather than shipping tombstones.

### 4.6 Config can load a raw private key from JSON
**Severity: Low** · `packages/sdk/src/config.ts:131`, `packages/dashboard/lib/local-config.ts`

`VIRIO_PRIVATE_KEY` env or `raw.privateKey` from a JSON file are both accepted. The `.env.example` warns to use a dedicated EOA, and the key only ever signs `charge()` (a permissionless call — low value at risk), but loading keys from on‑disk JSON invites accidental commits. Warn (or refuse) when a key comes from a file rather than env, and confirm those JSON paths are git‑ignored.

---

## 5. Tooling, Build & Process

- **No CI.** There is no `.github/workflows`. The doctrine ("Tests and types pass before review") is unenforced. Add a pipeline running `forge test`, `forge fmt --check`, `yarn typecheck`, and the e2e script on every PR. This is the single highest‑leverage improvement.
- **Hardhat + Foundry coexist.** `package.json` has both a `compile:contracts` (hardhat) and `compile` (forge), plus `types/hardhat.d.ts` stubs and a `hardhat.config.ts`. Two build systems for one contract set is exactly the "two things to learn, two to misread" the doctrine warns against. Pick Foundry (the source of truth per CLAUDE.md) and delete the Hardhat surface unless it has a specific job.
- **No coverage / invariant testing.** The unit + scenario tests are good and readable, but there are no Foundry **invariant/fuzz** tests on the money paths (fee split conservation: `merchantAmt + execFee + protocolFee == amount`; `stVIRIO.totalSupply() == VIRIO balance`; reward accounting never pays out more than was notified). These invariants are stated in the contract headers — encode them as `invariant_` tests.
- **`fs_permissions = read-write on ./`** in `foundry.toml` is broad. Scope it to the specific paths scripts actually need.
- **I could not run `forge test` in this environment** (Foundry binary unavailable, network‑restricted). The findings above are from static reading. Re‑run the suite + gas report locally to confirm nothing here is already covered by a test.

---

## 6. What's Done Well

- **Non‑custodial by construction.** Funds move customer→merchant/executor/fee directly; no pooled balance to drain. This caps the blast radius of every finding above.
- **CEI + reentrancy guards** consistently applied on all external‑call paths; effects precede interactions everywhere I checked.
- **Custom errors, events on every state transition, denormalized subscription snapshots** so a plan change can't retroactively alter an existing subscription.
- **`_safeTransferFrom` handles non‑bool‑returning tokens** (USDT‑style) correctly via low‑level `call` + optional decode.
- **`planId` binds `block.chainid`** — cross‑chain replay is considered.
- **Spend‑cap auto‑cancel instead of revert** keeps the permissionless executor's tx from failing on a capped sub — good keeper ergonomics.
- **TS is genuinely strict**, money is `bigint` end‑to‑end, conversion to `number` only at the display edge, and `"use client"` is pushed to the leaves. The doctrine is mostly lived, not just documented.

---

## 7. Prioritized Action List

**Do first (correctness / value leakage):**
1. Fix the `Staking.notifyReward` sandwich vector — stream rewards or enforce a cooldown (§3.1).
2. Reject zero‑`delta` / dust `notifyReward` to stop stranding tokens (§3.2).
3. Decide and document the subscription‑vs‑payroll period model; clamp payroll catch‑up if draining is unwanted (§3.4).
4. Add CI gating `forge test` + `yarn typecheck` on every PR (§5).

**Do next (consistency / hardening):**
5. `Ownable2Step` (or two‑step) on both managers (§3.5).
6. Use OZ `ECDSA.recover` in the 7702 delegate; reset/namespace `spentInPeriod` on revoke (§3.6, §3.7).
7. Validate chain/RPC logs and API inputs at the boundary; drop `as never` (§4.1, §4.2).
8. Add invariant/fuzz tests for fee conservation and staking 1:1 (§5).

**Cleanup (hygiene / doctrine):**
9. Remove unused interface errors, dead 410 routes, and the second build system (§3.12, §4.5, §5).
10. Move `MockUSDC` out of `src/`; paginate unbounded view loops; scope `fs_permissions` (§3.10, §3.12, §5).

---

*End of report.*
