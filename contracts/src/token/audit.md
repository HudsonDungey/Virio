# VIRIO token-contract audit

**Date:** 2026-09-21  
**Scope:** VIRIO.sol, Staking.sol, FeeDistributor.sol, SafetyModule.sol,
GenesisTokenomics.sol, IXERC20.sol, and DeployToken.s.sol.  
**Method:** Manual source and deployment-path review plus Slither. This is a source audit only:
no Base deployment addresses or deployed bytecode were supplied.

## Conclusion

The findings below were recorded before remediation. See the update immediately below for the
current state. A final independent security review is still required before public genesis.

## Remediation update — 2026-09-21

The following changes were implemented after this audit:

- Added GenesisAllocationVault and immutable TokenVesting contracts. The 1B Base mint now goes to
  the vault, which can initialize only once and requires the exact fixed-supply balance before
  atomically funding all ten published buckets. Founder, team and advisor amounts are transferred
  only to immutable schedule-specific vesting wallets.
- Removed the VIRIO_GENESIS_TO owner fallback. The deployment script deploys the allocation vault
  first and mints directly to it.
- Deployment now starts with the single-signature broadcast key as temporary setup owner, so
  Staking reward-token registration succeeds. It creates a 48-hour TimelockController with
  Vultisig as proposer/executor, then transfers all Ownable2Step token-suite contracts to that
  timelock. Vultisig must execute each acceptOwnership call through the timelock after the delay.
- Treasury VIRIO is allocated directly to the timelock. The unrestricted FeeDistributor rescue
  function was removed. Fee distribution now works with acquisition disabled, routing the
  proposed 15% reserve portion to the timelocked treasury instead.
- Removed non-functional genesis LP amount/quote inputs from the deployment path. The whole 50M
  Protocol Launch Liquidity allocation goes to an explicit liquidity-custody address; DEX pool
  creation remains a separate, reviewed operation.

The bridge finding remains open by design: cross-chain conservation depends on a future reviewed
bridge adapter. All bridge limits remain zero at Base genesis.

## Findings

### Critical — no allocation custody or vesting contract enforces the published tokenomics

**Affected:** VIRIO.sol:71-79, GenesisTokenomics.sol, DeployToken.s.sol:39-53

VIRIO mints the complete 1B supply to one arbitrary genesis recipient. The tokenomics library only
returns constants and unlock calculations; it neither receives tokens nor restricts transfers.
There is no vesting wallet, allocation distributor, treasury timelock, or airdrop distributor in
contracts/src.

DeployToken permits VIRIO_GENESIS_TO to be omitted, in which case the entire supply is minted to
VIRIO_OWNER. The documented founder, team, advisor, community and treasury restrictions therefore
have no on-chain enforcement.

**Impact:** Any recipient of the initial mint can transfer the full supply immediately. The
founder's zero-liquid-at-genesis requirement is not enforceable.

**Recommendation:** Block genesis deployment until independently deployed and reviewed contracts
exist for allocation custody, per-beneficiary vesting, community distribution, treasury multisig
and 48-hour timelock. Require VIRIO_GENESIS_TO (no owner fallback), validate it against allocation
custody, transfer the documented amounts in the deployment plan, and assert balances/schedules.

### High — deployment script reverts when the intended owner is a multisig

**Affected:** DeployToken.s.sol:39, 56, 69-71

The script deploys Staking with VIRIO_OWNER as owner, then calls
staking.registerRewardToken(feeToken) from the broadcast signer (PRIVATE_KEY). These are only the
same address if the deployer key is also the owner. With the intended multisig owner, the final
call reverts with OwnableUnauthorizedAccount and reverts the broadcast. The comment claiming the
deployer remains owner is incorrect: ownership is assigned in the constructor to VIRIO_OWNER.

**Recommendation:** Deploy with a temporary deployment administrator and transfer ownership after
initialization, or give Staking constructor parameters for initial reward tokens. Test the real
multisig-owner deployment path on a Base fork.

### High — the claimed cross-chain 1B invariant is not contract-enforced

**Affected:** VIRIO.sol:87-89, 104-115

The home chain begins with 1B VIRIO, while any owner-configured bridge can call mint up to its
minting rate limit. The token does not know whether another chain burned tokens first. A
compromised or incorrectly configured bridge can inflate supply up to its limit; repeating over
time refills that limit. This is an xERC20 endpoint, not a mathematical aggregate-supply proof.

**Recommendation:** Keep bridge limits at zero at genesis. Before expansion, use reviewed bridge
adapters, conservative caps, monitoring and a removal/pause procedure. Document that supply
conservation depends on bridge correctness.

### High — genesis LP inputs do not create or custody liquidity

**Affected:** DeployToken.s.sol:44-47, 85-86

GENESIS_LP_TOKEN_AMOUNT and GENESIS_LP_QUOTE_AMOUNT are checked/logged only. The script does not
transfer VIRIO to a liquidity manager, transfer quote assets, create a pool, mint LP positions, or
put those positions under multisig/timelock custody. The 50M allocation bound is operational only.

**Recommendation:** Implement a separate reviewed liquidity module, or remove these variables
until it exists. It should cap the transfer at 50M, create the Base pool and transfer the LP
position to the timelocked controller in one auditable flow.

### Medium — owner can redirect or rescue protocol fees without an on-chain delay

**Affected:** FeeDistributor.sol:144-177, SafetyModule.sol:28-31

The FeeDistributor owner can immediately replace sinks, enable mechanisms and rescue any token,
including protocol fee tokens. SafetyModule permits the owner to withdraw any token to any address
immediately. Neither contract implements the documented 48-hour timelock; protection exists only
if the owner address itself is a correctly configured timelock.

**Recommendation:** Make an audited timelock the initial owner. Restrict rescue so it cannot
withdraw registered fee tokens or documented reserve assets, or route this through delayed
emergency controls. Test that the timelock is the only privileged caller.

### Medium — fee distribution cannot operate while buyback is disabled

**Affected:** FeeDistributor.sol:100-103

Distribute requires both feeDistributionEnabled and protocolBuybackEnabled. Enabling fee
distribution while leaving acquisition disabled causes every distribution to revert and locks fees
in the distributor. This contradicts the separate activation controls.

**Recommendation:** Separate paths. When distribution is enabled but acquisition is disabled,
retain the 15% portion in a defined reserve or send it to the timelocked treasury. Emit the
selected treatment and test every flag combination.

### Low — deregistered reward tokens cannot be claimed through claim(token)

**Affected:** Staking.sol:129-130, 185-191

Deregistering leaves accrued balances intact, but claim(token) rejects a token that is no longer
active. ClaimAll still pays historical rewards because it iterates the retained list, so funds are
not permanently locked; the single-token path and its comment are inconsistent.

**Recommendation:** Separate known-token from active-token status, or permit claim(token) when a
previously registered token has accrued balance.

### Informational — rate-limit precision and batch failure visibility

**Affected:** VIRIO.sol:184, 202; FeeDistributor.sol:128-140

Rate per second uses integer division. Limits below 86,400 base units never refill, and other
limits refill slightly below their stated daily maximum. This is negligible for normal
18-decimal limits but should be tested.

Slither reports that distributeMany deliberately suppresses failures. This makes batch calls
tolerant but hides disabled/misconfigured-token failures. Emit a failure event or return
per-token results for operational visibility.

## Positive observations

- Base-only initial minting is enforced by HOME_CHAIN_ID == 8453.
- Genesis bridge limits are zero by default.
- Supply and allocation totals are covered by GenesisTokenomicsTest.
- Fee distribution and acquisition flags default to false.
- Staking settles reward accrual before stVIRIO mint, burn and transfer.
- The unstake cooldown is capped at seven days.

## Required tests before genesis

There are no unit or invariant tests for VIRIO, Staking, FeeDistributor, SafetyModule, the
deployment script, or vesting because vesting contracts do not yet exist. Add tests for:

1. allocation custody, every vesting cliff/schedule and zero founder liquidity at TGE;
2. Base fork deployment with a multisig/timelock owner;
3. bridge rate limits, zero-limit genesis and compromised-bridge containment;
4. staking rewards across stake, transfer, unstake, deregistration and rounding;
5. fee-distributor flags, sink updates, rescue restrictions and timelock delay;
6. Safety Module withdrawal authorization and delayed execution;
7. liquidity allocation cap and LP-position custody.

## Tooling

GenesisTokenomicsTest passed: 5/5. Slither completed against the contracts project. Its
token-scope output also flagged the deliberately swallowed error in distributeMany and the
expected timestamp comparisons; the actionable results are recorded above.

## Status

This report does not modify production Solidity. Remediate the Critical and High findings, add
the missing contracts/tests, then obtain an independent security review before public genesis.
