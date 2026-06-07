# Virio Protocol Smart Contract Audit Notes

## Executive Summary

Severity counts:
- Critical: 0
- High: 0
- Medium: 1
- Low: 4
- Informational: 1

Top 3 issues by impact:
1. Fee-on-transfer reward tokens can over-credit staking rewards and later make claims fail.
2. Deregistered reward tokens cannot be claimed individually.
3. Zero delegate period creates a lifetime cap.

Overall risk rating: Medium. The subscription manager's core flow is simple and mostly matches its stated invariants. The token-side contracts are not yet covered by tests in this repo and should not be treated as mainnet-ready until the staking, fee-distribution, xERC20 limit, and 7702 delegate edge cases below are covered.

Token-contract mainnet note: I would block `Staking`, `FeeDistributor`, and `VIRIO` from mainnet deployment until dedicated tests exist and the reward-accounting / limit-overflow findings are addressed. `SafetyModule` is minimal and acceptable if the owner address is a governance-controlled multisig or DAO.

---

```
[SEVERITY: Medium]
Contract: contracts/src/token/Staking.sol:158-167
Title: Fee-on-transfer reward tokens over-credit rewards
Description:
  `notifyReward` calculates `rewardPerToken` from the requested `amount`, not the actual balance delta received by the staking contract. A fee-on-transfer or rebasing reward token can cause the contract to account more claimable rewards than it actually holds.
Impact:
  Later reward claims can revert or drain unrelated reward-token balances if the contract has prior surplus. This can break reward distribution for all stakers of that token.
PoC sketch:
  Register a mock reward token that burns 1% on transfer, stake VIRIO, notify `100e18`, then assert the staking contract received `99e18` while `earned(user, token)` reports `100e18`.
Suggested fix:
  Measure `balanceBefore` and `balanceAfter` around `safeTransferFrom` and use the actual received amount for `delta`; reject zero received.
```

```
[SEVERITY: Low]
Contract: contracts/src/token/Staking.sol:129-136
Title: Deregistered reward tokens cannot be claimed individually
Description:
  `claim(rewardToken)` reverts when `isRewardToken[rewardToken]` is false, but `deregisterRewardToken` explicitly leaves historical accruals in the iteration list so they remain claimable. `claimAll` still pays them, so this is an interface-level lockout rather than a full funds lock.
Impact:
  Wallets, SDK calls, or users that claim one token at a time cannot withdraw accrued rewards after governance deregisters that token.
PoC sketch:
  Register a reward token, accrue rewards, deregister it, then call `claim(token)` and expect `UnknownRewardToken` while `claimAll()` succeeds.
Suggested fix:
  Allow `claim` for any token present in `rewardTokens`, or add a separate historical-membership mapping distinct from `isRewardToken`.
```

```
[SEVERITY: Low]
Contract: contracts/src/VirioSubscriptionDelegate7702.sol:93-123,174-177
Title: Zero delegate period creates a lifetime cap
Description:
  `initWithSig` accepts `periodDuration == 0`, and `currentPeriodId` maps that case to period id `0`. This converts the documented per-period cap into a single lifetime cap for the delegated EOA.
Impact:
  A user can unintentionally create an authorization that stops working forever after `maxPerPeriod` is spent, requiring revocation and re-initialization instead of normal period reset behavior.
PoC sketch:
  Initialize the delegate with `periodDuration = 0` and `maxPerPeriod = 100`, execute two transfers totaling 100, warp far forward, then assert a third transfer of 1 still reverts with `PeriodCapExceeded`.
Suggested fix:
  Reject zero `periodDuration` in `initWithSig` unless a lifetime-cap mode is explicitly documented and surfaced in the UI.
```

```
[SEVERITY: Low]
Contract: contracts/src/token/VIRIO.sol:103-115,144-149
Title: Large bridge limits can make rate-limit reads overflow
Description:
  `setLimits` allows limits up to `type(uint256).max / 2`, but `_currentLimit` multiplies unbounded elapsed time by `ratePerSecond` before capping to `maxLimit`. With a very large configured limit, waiting long enough can make `elapsed * ratePerSecond` overflow and revert.
Impact:
  A misconfigured bridge can become unable to mint, burn, or report current limits after enough elapsed time. This is owner-triggered, but it can freeze bridge operations until limits are reset.
PoC sketch:
  Set a bridge minting limit near `type(uint256).max / 2`, warp several rate-limit windows, then call `mintingCurrentLimitOf(bridge)` or `mint` and expect an arithmetic overflow revert.
Suggested fix:
  In `_currentLimit`, return `maxLimit` immediately when `elapsed >= RATE_LIMIT_DURATION`, or cap elapsed before multiplying.
```

```
[SEVERITY: Low]
Contract: contracts/src/token/FeeDistributor.sol:93-113
Title: Fee-on-transfer distribution tokens skew the 60/25/15 split
Description:
  `distribute` computes splits from the distributor's starting balance and then performs three token movements. Fee-on-transfer tokens can make recipients receive less than the computed split, and the final `notifyReward` may revert if prior transfers reduce the distributor balance below the approved staker amount.
Impact:
  Distribution for non-vanilla ERC20s can revert or produce materially different effective percentages than the immutable split promises.
PoC sketch:
  Send a fee-on-transfer token to `FeeDistributor`, register it in staking, call `distribute`, and assert either a revert at `notifyReward` or treasury/buyback/staker received amounts below the event's computed values.
Suggested fix:
  Restrict supported fee tokens to standard ERC20s, or calculate each leg from observed balance deltas and document that fee-on-transfer tokens are unsupported.
```

```
[SEVERITY: Informational]
Contract: contracts/src/VirioSubscriptionDelegate7702.sol:205-215
Title: EIP-712 recovery does not reject malleable signatures
Description:
  `_recoverSigner` calls `ecrecover` directly without enforcing `s` in the lower half order or constraining `v` to 27/28. The epoch nonce and signer equality check prevent an obvious replay escalation, but this still violates the repo's signature hygiene guidance.
Impact:
  Signature uniqueness is not guaranteed, which can complicate off-chain indexing, signature deduplication, and future changes that assume canonical signatures.
PoC sketch:
  Produce a valid `initWithSig` signature and its high-s malleated twin, then show both recover `address(this)` for the same digest before initialization.
Suggested fix:
  Use OpenZeppelin `ECDSA.recover` or manually enforce canonical `s` and valid `v`.
```

## Positive Observations

- `VirioSubscriptionManager.charge` updates `nextChargeAt` and `totalSpent` before transfers and relies on revert atomicity for transfer failures (`contracts/src/VirioSubscriptionManager.sol:180-207`).
- Subscription ids and payroll recipient ids are deterministic from `(planId, account)`, and plan ids include `block.chainid` (`contracts/src/VirioSubscriptionManager.sol:101`, `contracts/src/VirioPayrollManager.sol:113-115`).
- Payroll recipient removal uses O(1) swap-and-pop and clears the removed index (`contracts/src/VirioPayrollManager.sol:392-402`).
- `SafetyModule` has only owner-gated token withdrawal and no additional state surface (`contracts/src/token/SafetyModule.sol:22-27`).

## Untested Code Paths Checked

I reviewed `contracts/test/VirioSubscriptionManager.t.sol`, `contracts/test/VirioPayrollManager.t.sol`, and `contracts/test/Scenarios.t.sol`.

- `VirioSubscriptionDelegate7702` has no tests covering initialization, revocation, period caps, zero `periodDuration`, or signature malleability.
- Token contracts under `contracts/src/token/` have no tests in `contracts/test/*.t.sol`: `VIRIO`, `Staking`, `FeeDistributor`, and `SafetyModule` are untested in this suite.
- `VirioPayrollManager.t.sol` does not cover swap-and-pop removal of a middle recipient from a multi-recipient list.
- `VirioSubscriptionManager.t.sol` and `Scenarios.t.sol` cover revoked allowance, cap auto-cancel, additive timing, merchant/customer cancellation, and deactivated-plan behavior; I did not list those as gaps.

## Recommended Next Work

1. Add first-pass token test files for `Staking`, `FeeDistributor`, `VIRIO`, and `VirioSubscriptionDelegate7702`; these contracts currently carry meaningful launch risk because their edge cases are not exercised.
2. Add payroll coverage for swap-and-pop removal of a middle recipient from a multi-recipient list.
