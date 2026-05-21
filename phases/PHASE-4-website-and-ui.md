# Phase 4 — Website / UI

**Goal:** the product dashboard + token/airdrop UX are **smooth, correct, and production-grade** —
fast, reliable reads, no event-cache bugs, clear claim/stake flows, and a marketing site that
explains the protocol and tokenomics.

**Exit criteria:** dashboard correctly reflects on-chain state under load; subscription/payroll
flows work end-to-end on mainnet; airdrop claim + claim-and-stake UX works against the deployed
`AirdropDistributor`; marketing/docs site live.

Built on the existing Next.js app in `packages/dashboard`.

---

## 4.1 Fix the known data-layer bugs (must-do)

From [`../thingstoworkon.md`](../thingstoworkon.md) — these are correctness bugs, not polish:

- [ ] **Idempotent event ingestion:** store `PlanCreated` by `planId`, subscriptions by `subId`,
      charges by `txHash`/`txHash+logIndex` — not append-only arrays
      (`packages/dashboard/lib/chain-reads.ts`).
- [ ] **Serialize `syncEvents()`** with an in-flight mutex so concurrent API calls share one sync
      (fixes duplicate plans).
- [ ] **Stop polling plans** every 2s/10s; fetch on load, after create/deactivate, and manual
      refresh only (`packages/dashboard/components/dashboard-shell.tsx`).
- [ ] **Decouple the scheduler** from read endpoints — don't `ensureSchedulerStarted()` on
      `/api/plans` GET; run it from one bootstrap path / dedicated worker.
- [ ] Keep scheduler focused on `dueSubscriptions()` → `chargeOnce(subId)`.

## 4.2 Core product UX

- [ ] Plan creation / subscription / payroll flows, end-to-end on mainnet.
- [ ] Wallet connect, multichain switching (Ethereum/Base/Arbitrum), correct chain-local reads.
- [ ] Accurate stats (TPV, active relationships, charges) sourced from the de-duped indexer.
- [ ] Merchant fee-discount tiers surfaced (stake → lower bps / flat fee, per `TOKENOMICS.md` §4).
- [ ] Error states, loading states, empty states; mobile-responsive.

## 4.3 Token & staking UX

- [ ] Staking view: stake/unstake, stVIRIO balance, cooldown status.
- [ ] **Live USDC yield**: earned-per-reward-token, claim, projected APR
      (extend `packages/dashboard/components/virio/`).
- [ ] Fee-split + buyback transparency (60/25/15).
- [ ] Public-sale page (open, no allowlist) if hosting the sale.

## 4.4 Airdrop claim UX (depends on Phase 3 addresses)

- [ ] **Eligibility checker:** wallet → allocation, or reason code if excluded
      (from the engine's published list).
- [ ] **Claim vs. claim-and-stake** toggle with **projected USDC APR shown at the decision point**
      (this is anti-dump System 5 — make the hold-vs-sell math explicit).
- [ ] Vesting/tranche timeline, **monthly-window countdown**, forfeiture warnings (System 3).
- [ ] Referral dashboard + **public leaderboard** (activated referees, not raw signups).
- [ ] Generate + verify merkle proofs client-side against the published root.
- [ ] Airdrop **ops dashboard** (internal): root status, claimed/staked/forfeited split,
      sell-pressure vs. buyback (see [`../airdrop/07`](../airdrop/07-kpis-and-monitoring.md)).

## 4.5 Marketing & docs site

- [ ] Landing page: what Virio is, the fee→yield loop, multichain story.
- [ ] Tokenomics page (from `TOKENOMICS.md`), airdrop page (from `airdrop.md`).
- [ ] Docs: how to subscribe, run payroll, stake, claim the airdrop.
- [ ] Audit reports + deployed-address registry linked.

## 4.6 Quality bar

- [ ] **Verify in a real browser** — golden path + edge cases for each flow; watch for regressions.
- [ ] Lighthouse/perf pass; core flows fast on mid-tier mobile.
- [ ] Type-check + lint + any UI tests green.
- [ ] Load test the read APIs to confirm the de-dup/serialization fixes hold under concurrency.
- [ ] Accessibility pass on the claim + stake flows (these handle money).

## Definition of done

- [ ] Event-cache bugs fixed; reads correct under concurrent load.
- [ ] Product, staking, and airdrop-claim flows work end-to-end against mainnet contracts.
- [ ] Claim-and-stake with projected APR live; referral leaderboard live.
- [ ] Marketing/docs site published with audits + addresses.
</content>
