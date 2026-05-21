# 05 — Architecture & Contracts

Two new components; everything else already exists in the repo.

```
                       ┌─────────────────────────────────────────────┐
   on-chain product    │  Points & Sybil Engine  (NEW, off-chain svc) │
   events ────────────►│  • indexes Subscription/Payroll events       │
   (Subscription,      │  • tracks referral graph (own DB)            │
    Payroll, Staking)  │  • scores + sybil-filters                    │
                       │  • builds monthly merkle trees               │
                       └───────────────┬─────────────────────────────┘
                                       │ publishes rootₘ + methodology
                                       ▼
                       ┌─────────────────────────────────────────────┐
                       │  AirdropDistributor  (NEW, on-chain)         │
                       │  • holds 100M VIRIO                          │
                       │  • currentRoot, tgeTimestamp                 │
                       │  • claim() / claimAndStake()                 │
                       │  • per-tranche vesting + windows             │
                       │  • recycleForfeited()                        │
                       └───┬───────────────┬───────────────┬─────────┘
                           │ stakeFor      │ (yield via)    │ (buyback via)
                           ▼               ▼                ▼
                     Staking.sol     FeeDistributor.sol   SafetyModule.sol
                     (EXISTING)        (EXISTING)           (EXISTING)
```

## Existing contracts it plugs into (no economic changes)

| Contract | Path | Used for |
|---|---|---|
| `Staking` | `contracts/src/token/Staking.sol` | `claimAndStake` calls `stakeFor(recipient, amount)` → mints stVIRIO to claimant |
| `FeeDistributor` | `contracts/src/token/FeeDistributor.sol` | Routes 60% fees → stakers in USDC (`distribute`/`notifyReward`) |
| `SafetyModule` | `contracts/src/token/SafetyModule.sol` | Receives the 15% buyback (standing bid) |
| `VIRIO` | `contracts/src/token/VIRIO.sol` | The token being distributed |
| `VirioSubscriptionManager` | `contracts/src/VirioSubscriptionManager.sol` | Activity source for eligibility/gating |
| `VirioPayrollManager` | `contracts/src/VirioPayrollManager.sol` | Activity source for eligibility/gating |

> Note: `Staking.stakeFor(address recipient, uint256 amount)` already exists
> (`contracts/src/token/Staking.sol:111`), which is exactly the hook `claimAndStake` needs — the
> distributor stakes on behalf of the claimant. Confirm `Staking` accepts deposits from an
> arbitrary `msg.sender` for an arbitrary `recipient` (it does), and that the distributor
> pre-approves `Staking` for the VIRIO it stakes.

## NEW — `AirdropDistributor` (on-chain)

### Responsibilities
- Custody the 100M VIRIO (funded at deploy in Phase 3).
- Store `currentRoot` (updated monthly) and immutable `tgeTimestamp`.
- Verify merkle proofs and enforce per-wallet vesting.
- Offer two claim paths: `claim` (to wallet) and `claimAndStake` (to `Staking`, + bonus).
- Enforce per-tranche windows and recycle forfeitures.

### State (sketch)
```solidity
IERC20  public immutable virio;
IStaking public immutable staking;        // contracts/src/token/Staking.sol
uint256 public immutable tgeTimestamp;

bytes32 public currentRoot;               // rootₘ, updated each month by owner/keeper
uint256 public currentMonth;              // m, 0-indexed from TGE

mapping(address => uint256) public alreadyClaimed;     // base tokens claimed
mapping(address => uint256) public bonusStaked;        // bonus subject to clawback
mapping(address => uint256) public bonusUnlockAt;      // min-stake-duration deadline
uint256 public bonusPool;                              // funded by community slice + forfeitures
```

### Core math (System 1)
```
elapsedMonths  = (block.timestamp - tgeTimestamp) / 30 days
vestedTranches = min(elapsedMonths + 1, 10)            // tranche 1 unlocks at TGE
maxClaimable   = totalAllocation * vestedTranches / 10
claimableNow   = maxClaimable - alreadyClaimed[wallet]
```

### Functions (sketch)
```solidity
// to wallet, no bonus
function claim(bytes32[] proof, uint256 totalAllocation, uint256 amount) external;

// to Staking.sol, + bonus from bonusPool, bonus locked for min duration
function claimAndStake(bytes32[] proof, uint256 totalAllocation, uint256 amount) external;

// owner/keeper: publish next monthly root (System 3)
function setRoot(bytes32 root, uint256 month) external onlyOwner;

// keeper: sweep tokens for tranches that expired unclaimed / ineligible → bonusPool
function recycleForfeited() external;

// fund the bonus pool from the community slice (and forfeitures accrue automatically)
function fundBonusPool(uint256 amount) external onlyOwner;
```

### Leaf format
`leaf = keccak256(abi.encodePacked(wallet, totalAllocation))`
Standard sorted-pair OpenZeppelin `MerkleProof.verify`. Consider double-hashed leaves
(`keccak256(bytes.concat(keccak256(...)))`) per OZ's second-preimage guidance.

### Claw-back rule (System 2)
- `claimAndStake` records `bonusStaked[wallet] += bonus` and `bonusUnlockAt[wallet]`.
- If the claimant unstakes from `Staking` before `bonusUnlockAt`, the bonus is reclaimed back to
  `bonusPool`. The **base tranche is never clawed back.**
- Mechanism: tag the bonus portion in the distributor and check the claimant's stVIRIO position
  on bonus-release; if they exited early, return the bonus to the pool. (Exact enforcement —
  hook vs. on-release check — is a design decision for Phase 1; see open questions.)

### Trust & admin surface
- `setRoot` is privileged → must be a **multisig + timelock** (matches treasury controls in
  `TOKENOMICS.md` §8). A malicious root could mis-allocate, so this is the highest-risk surface.
- Consider a **guardian pause** and a **published root-change delay** so the community can review
  each monthly root before it activates.
- All 100M is held by the contract; add a `rescue` only for non-VIRIO tokens, never for the
  airdrop principal.

## NEW — Points & Sybil Engine (off-chain service)

### Responsibilities
- Ingest `Subscription`/`Payroll` events (reuse the existing event-cache/indexer pattern from
  `packages/`; **note the idempotency bug flagged in `thingstoworkon.md`** — the engine's
  ingestion must be idempotent and concurrency-safe by design).
- Maintain the referral graph in its own DB.
- Run scoring (doc 02) + sybil filters (doc 03).
- Build the merkle tree and **publish `rootₘ` on-chain + methodology/list off-chain.**

### Suggested shape
- A package under `packages/` (e.g. `packages/airdrop-engine`) sharing types with the SDK.
- Deterministic, reproducible scoring: given public chain data + the published referral graph,
  anyone can rebuild the same root. Commit the scoring code.
- Outputs per month: `rootₘ`, `allocations.json` (wallet → totalAllocation), `proofs/`,
  `excluded.json` (wallet → reason code), `methodology.md`.

## Open questions for Phase 1

- **Bonus clawback enforcement:** real-time hook into `Staking.unstake` vs. snapshot check at
  bonus release. Hook is stricter but couples the contracts; snapshot is simpler. Decide and
  document.
- **Monthly root cadence vs. gas/ops:** confirm a keeper can reliably `setRoot` + `recycleForfeited`
  on each chain (the suite is multichain — does the airdrop run per-chain or canonical on one chain?).
  **Recommendation:** run the `AirdropDistributor` on **one canonical chain** (Ethereum) to avoid
  cross-chain root reconciliation; claimants bridge VIRIO afterward via xERC20 if they want.
- **Forfeiture redistribution:** to bonus pool only, or also pro-rata to loyal claimers? Affects
  leaf format (pro-rata top-up needs per-month allocation deltas).
</content>
