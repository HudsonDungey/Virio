# Phase 1 — Smart Contract Finalisation

**Goal:** every contract the protocol needs at launch is feature-complete, fully tested,
internally reviewed, gas-considered, and **freeze-ready** for an external audit. Nothing in this
phase should require new external capital.

**Exit criteria:** code freeze on the contract suite; 100% of intended features implemented; full
test suite green; internal review + threat model done; audit scope document written.

---

## 1.1 Inventory — what exists vs. what's missing

### Already built (verify + harden, don't rewrite)
- [ ] `token/VIRIO.sol` — confirm 1B cap, xERC20 rate limits, ERC20Votes wiring.
- [ ] `token/Staking.sol` — confirm `stake`/`stakeFor`/`unstake`/cooldown, Synthetix
      `rewardPerToken` math, multi-reward-token support, `stakeFor` usable by `AirdropDistributor`.
- [ ] `token/FeeDistributor.sol` — confirm 60/25/15 split, `distribute`/`distributeMany`,
      staking pre-approval path.
- [ ] `token/SafetyModule.sol` — confirm it can receive buyback VIRIO; decide if v1 minimal holder
      is enough for launch or needs buyback-execution logic.
- [ ] `VirioSubscriptionManager.sol` / `VirioPayrollManager.sol` — confirm fee math (0.1% executor,
      0.25% protocol, $1 flat), `charge()` due-timing, event coverage for the airdrop engine.
- [ ] `SubscriptionDelegate7702.sol` — confirm ERC-7702 delegate flow.

### Missing — must be built this phase
- [ ] **`AirdropDistributor`** — full spec in [`../airdrop/05`](../airdrop/05-architecture-and-contracts.md).
      Merkle claim, 10-tranche vesting, `claimAndStake` + bonus, monthly roots, forfeiture recycling.
- [ ] **Vesting contracts** for the insider/sale schedules in `TOKENOMICS.md`:
      Team (12-mo cliff, 36-mo linear), Creator (6/24), Investor (12/24), Advisors (6/24),
      Public Sale (25% TGE, 9-mo linear). Decide: one parameterised vesting contract vs. several.
- [ ] **Buyback executor** — if the 15% buyback is on-chain (DEX swap → SafetyModule) rather than
      operator-driven. Decide on-chain vs. operator and document the trust assumption.
- [ ] **Treasury/multisig + timelock** config (4-of-7 Safe + 48h timelock per `TOKENOMICS.md` §8).

## 1.2 Refinements to land before freeze

- [ ] **Access control:** every privileged function behind multisig + timelock; enumerate the
      full admin surface (esp. `AirdropDistributor.setRoot`, `FeeDistributor` setters, `Staking`
      reward-token registration, `SafetyModule.withdraw`).
- [ ] **Reentrancy / CEI:** audit all external-call paths (`FeeDistributor.distribute`,
      `Staking.claim`, buyback swaps).
- [ ] **xERC20 bridge limits:** per-bridge mint/burn ceilings set sanely for day-one LayerZero V2.
- [ ] **Pause / guardian:** confirm emergency stop coverage where it matters; document what is and
      isn't pausable.
- [ ] **Events:** ensure every state change the **airdrop engine** and **dashboard indexer** need
      is emitted (plans, subscribes, charges, payroll runs, stake/unstake, claims).
- [ ] **Indexer correctness:** the airdrop engine and dashboard must ingest idempotently — design
      around the event-cache race documented in [`../thingstoworkon.md`](../thingstoworkon.md).
- [ ] **Upgradeability decision:** immutable vs. proxy per contract — document and justify.

## 1.3 Testing (Foundry primary, Hardhat secondary)

- [ ] Unit tests for every contract; keep `contracts/test/*.t.sol` green
      (`Scenarios.t.sol`, `VirioPayrollManager.t.sol`, `VirioSubscriptionManager.t.sol`).
- [ ] New: `AirdropDistributor.t.sol` — vesting math, double-claim, wrong-root rejection,
      `claimAndStake` → `Staking` → yield, bonus clawback, forfeiture recycling, full 10-month sim.
- [ ] New: vesting-contract tests (each schedule's cliff + linear release).
- [ ] **Invariant/fuzz tests:** supply conservation (Σ across chains = 1B), fee-split sums to 100%,
      no claim exceeds vested, staked rewards never exceed deposited.
- [ ] **Fork tests** against mainnet USDC + a real DEX for the buyback path.
- [ ] Coverage target ≥ 90% on the token + airdrop contracts.
- [ ] Gas snapshots (`forge snapshot`) for claim/stake/charge hot paths.

## 1.4 Internal review & audit prep

- [ ] Threat model written (per `TOKENOMICS.md` risks: bridge drain, LP rug surface, insider
      unlocks, airdrop sybil/dump).
- [ ] Internal/peer review of every contract; resolve findings.
- [ ] Static analysis (Slither/Aderyn) clean or triaged.
- [ ] **Audit scope doc** prepared for Spearbit + Trail of Bits (`TOKENOMICS.md` §8): contract
      list, commit hash, invariants, known assumptions.
- [ ] NatSpec complete on public/external functions.
- [ ] **Code freeze** tag cut — this is the artifact Phase 3 audits.

## Definition of done

- [ ] All launch contracts implemented (existing + AirdropDistributor + vesting + buyback decision).
- [ ] Test suite green, coverage + invariants + fork tests in place.
- [ ] Admin surface enumerated and behind multisig + timelock.
- [ ] Threat model + audit scope written; frozen commit tagged.
</content>
