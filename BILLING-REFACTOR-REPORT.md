# Virio programmable billing — engineering report

Virio moves from a recurring-subscription protocol to open programmable billing
infrastructure for stablecoins, adding metered and hybrid billing without
touching the deployed subscription contract.

Branch `claude/virio-billing-refactor-4skjd3` · 65 files, +9,616 / −41.

---

## 1. Architecture: before and after

**Before.** `VirioSubscriptionManager` held everything — plans, subscriptions,
spend caps, fee split, token transfers. That is a reasonable shape for one
billing model. It does not extend to a second: metered billing would have needed
its own copy of the spend-cap logic, and two copies of a spend cap is how a payer
ends up charged twice.

**After.** Three concerns separated, with one place money moves:

```
  Applications      humans · SaaS · APIs · AI agents · wallets
        ↓
  Virio SDK         virio.billing · virio.usage
        ↓
  Billing modules   recurring        metered        (hybrid = both)
        ↓           what is owed
  Authorization     per-charge · period cap · lifetime cap · window
     registry       revocation · billing type
        ↓           what may be charged  →  and the transfer
  Execution         permissionless executors
        ↓
  Settlement        USDC / supported stablecoins  →  Base
```

The load-bearing property: **a billing module cannot collect more than the payer
authorized, even if the module's own accounting is wrong.** The registry
re-checks every limit from its own storage on every settlement. Correctness of
the caps does not depend on the correctness of any module.

`VirioSubscriptionManager` is untouched and still running. The new stack is a
separate deployment beside it.

---

## 2. Contracts

### New

| Contract | Responsibility |
| --- | --- |
| `VirioAuthorizationRegistry` | Payer authorizations, limit enforcement, the fee split, and every token transfer. The only place money moves. |
| `VirioRecurringBilling` | Plans, subscriptions, due dates. Module #1. |
| `VirioMeteredBilling` | Meters and EIP-712 merchant-signed usage statements. Module #2. |
| `IVirioBillingModule` | The whole contract a module owes the registry: its billing type and its registry. |
| `IVirioAgentPolicy` | **Interface only.** Nothing implements it, nothing is deployed. |

### Hybrid billing has no contract

This is the design decision worth the most scrutiny, so it is stated plainly:
a hybrid plan is **one `HYBRID` authorization that both modules settle
against**. The base charge and the overage draw on the same `spentThisPeriod`,
so a "$50/month absolute maximum" is enforced across both halves by the
registry — not by either module, and not by a third contract duplicating their
logic.

`VirioHybridBilling.t.sol` proves it: usage that fills the month blocks the base
charge, and vice versa.

### Deliberate differences from the deployed manager

1. **Spend limits moved out of the subscription** onto a reusable
   `Authorization`. That is what makes hybrid billing possible at all.
2. **A cap breach reverts instead of auto-cancelling.** The old manager silently
   cancelled a subscription at its lifetime cap. Reaching a ceiling is not the
   same as wanting to leave, and having an executor destroy the relationship on
   the payer's behalf is the wrong default.
3. **Per-merchant counters removed.** They cost an SSTORE per charge to store
   numbers the `Settled` event already carries.
4. **`nextChargeAt` still re-anchors on the charge time** — unchanged, and
   deliberately so. A late executor produces one catch-up charge, not one per
   missed period.

### Two hardening changes

**Fees are bounded.** The legacy manager let the owner set `executorFeeBps` or
`protocolFeeBps` to 10,000 — 100%. Against a payer who had already approved the
contract, that made "the owner cannot take user funds" false in the limit. The
registry caps total fees at 5% and the flat fee at 10 USDC, both far above the
0.35% + $1 default. The legacy contract is immutable, so this could not be fixed
in place; it is documented in the security docs instead.

**Emergency controls cannot seize funds.** The owner can pause a module, which
stops settlement without touching any authorization. Pausing metered leaves
recurring running. There is no global switch, and no owner function moves a
payer's tokens.

### Gas

Storage was packed so `spentThisPeriod` and `totalSpent` share one slot, making
the settlement hot path a single SSTORE. Measured, not assumed:

| Path | Gas |
| --- | --- |
| Legacy manager, first charge | 230,449 |
| New stack, first charge (module + registry) | **173,767** |
| New stack, steady-state charge (warm slots) | **108,475** |
| Metered settlement, first settlement | 234,494 |

25% cheaper on a first charge and less than half at steady state, *despite*
adding a cross-contract call. Executors are paid a fraction of a small charge,
so settlement gas is the binding economic constraint on this protocol.

---

## 3. Authorization model

| Field | Meaning |
| --- | --- |
| `payer`, `merchant`, `token` | who, to whom, in what |
| `billingType` | `RECURRING` / `METERED` / `HYBRID` |
| `maxPerCharge` | largest single settlement — mandatory, never unlimited |
| `periodSpendCap` / `periodDuration` / `periodStart` | the spend window |
| `totalSpendCap` | lifetime ceiling, survives period rollovers |
| `validAfter` / `validUntil` | when it works at all |
| `spentThisPeriod` / `totalSpent` | what has been used |
| `active` | revoked or not |

Two properties matter most:

- **Limits only tighten.** `restrict()` lowers a cap or shortens an expiry.
  There is no function that raises one — loosening means authorizing again,
  which re-prompts the payer.
- **Periods are additive.** `periodStart += n × periodDuration`, computed in
  O(1). A late settlement never shifts the grid, and an authorization dormant
  for years still settles in constant gas.

Revocation is callable by payer or merchant and stops every module at once —
one lever for one consent. Creating an authorization moves no money and grants
no allowance; the ERC-20 approval is separate and both are required.

---

## 4. Metering trust model

Stated as plainly in the docs as here, because this is the one place Virio is
not trustless and saying otherwise would be false.

**On-chain:** meters and their immutable unit price, settlement statements,
nonces, window watermarks, spend caps, expiry, revocation, and every transfer.

**Off-chain:** individual usage events. A transaction per API call would cost
far more than the call is worth.

**Who you trust:** the merchant, to count honestly. It signs an EIP-712
statement asserting "this authorization used N units between T0 and T1".
**That proves attestation, not usage.**

What bounds the damage, all enforced on chain:

- the meter's unit price is immutable — repricing requires a new meter;
- per-settlement, per-period and lifetime caps;
- expiry and revocation;
- `amount == units × unitPrice`, verified on chain;
- windows cannot overlap a settled one, or reach into the future;
- the merchant's nonce is burned;
- the signature must recover to **exactly** the meter's merchant, via
  OpenZeppelin `SignatureChecker` (ERC-1271 accepted, malleable signatures not).

A dishonest merchant can overstate usage **up to the payer's caps**. It cannot
exceed them, change the price, bill a revoked payer, or settle a window twice.
Set caps to the most you would accept losing to a merchant you stop trusting.

Stronger verification — independent attestation, TEE-signed counters, dispute
windows — is deferred, not delivered.

---

## 5. Executors

`chargeable()`, `settleable()` and `canSettle()` let an executor decide with one
`eth_call` whether a transaction would succeed, and return the error selector
when it would not.

These are an **economic filter, not a safety net.** Double-charge protection,
spend caps, replay protection and authorization validity are enforced on chain.
An executor that skipped every check would waste gas, not overcharge anyone.

Two executors racing the same item is expected: the first advances the state the
second depends on, so the loser reverts. Tested explicitly for both recurring
charges and metered statements.

Shipped: `BillingExecutor` in `@virio/scheduler` for SDK users, and a standalone
zero-dependency `ops/executor-vps/virio-billing-executor.mjs` matching the
existing VPS convention. Both run alongside the subscription-manager executor,
not instead of it.

---

## 6. SDK

```ts
await virio.billing.create({ type: "recurring", amount: "29.00", interval: "month", token: "USDC" });

await virio.billing.create({
  type: "metered",
  meter: { unit: "api_request", pricePerUnit: "0.002" },
  settlement: { interval: "day" },
  limits: { monthlyCap: "100" },
  token: "USDC",
});

await virio.billing.create({
  type: "hybrid",
  base: { amount: "20", interval: "month" },
  usage: { unit: "api_request", includedUnits: 10_000, pricePerUnit: "0.001" },
  limits: { monthlyCap: "50" },
  token: "USDC",
});
```

`create()` is a composition, not a wall — `authorize`, `restrict`, `revoke`,
`remaining`, `createPlan`, `subscribe`, `charge`, `createMeter`, `signStatement`,
`settleStatement` and the `prepare*` calldata builders are all public. An
integrator needing direct protocol access is never forced through the high-level
path.

`maxPerCharge` is mandatory on chain. Omit it and the SDK derives the tightest
value the terms can need; it never defaults to something open-ended.

**Usage:**

```ts
await virio.usage.record({ authorizationId, meterId, quantity: 1, idempotencyKey: requestId });
const usage = await virio.usage.get({ authorizationId, meterId, period: "current" });
// { units, billableUnits, unitPrice, accruedAmount, periodCap, remainingCap, eventCount }
const signed = await virio.usage.signNextStatement({ authorizationId, meterId });
```

`idempotencyKey` is required — a retried API request bills once. Every input
behind an amount is kept, so a payer can audit `1,827 × $0.002 = $3.654` rather
than trust a total.

Existing `virio.plans` / `virio.subscriptions` calls are unchanged. Billing
addresses are optional; `virio.billing` throws only if used unconfigured.

---

## 7. UI

**Authorizations** — every recurring, metered and hybrid authorization in one
place, with spend against each cap and a revoke button that stops all modules.

**Usage** — settled metered and hybrid billing. It states explicitly that
unsettled usage is not shown because it does not exist on chain. Showing an
accrued figure there would mean inventing one.

---

## 8. Database and indexing

**No database was added.** The existing architecture is on-chain state plus
in-process event indexing, and introducing Postgres for this would have been a
large dependency for state the chain already holds.

- **Canonical:** on-chain. Authorizations, meters, subscriptions, settled spend.
- **Derived:** `lib/billing-reads.ts` indexes `AuthorizationCreated`, `Settled`
  and `MeterCreated`, mirroring the existing `chain-reads.ts` exactly.
- **Off-chain records:** usage events, behind a `UsageStore` interface with an
  in-memory default — the same shape as `@virio/scheduler`'s `SchedulerStorage`.
  It is not durable, and losing it costs unbilled revenue rather than an
  over-charge. Production should back it with a real database; the interface
  exists for that.

---

## 9. Tests

**181 passing, 0 failing** (was 68 passing, 2 failing).

| Suite | Tests |
| --- | --- |
| `VirioAuthorizationRegistryTest` | 45 |
| `VirioMeteredBillingTest` | 30 |
| `VirioRecurringBillingTest` | 26 |
| `VirioHybridBillingTest` | 10 |
| Pre-existing suites | 70 |

Covered: authorization lifecycle and every limit; period rollover at exact
boundaries and after a 100-period gap; validity windows inclusive/exclusive;
revocation and restriction (including that limits cannot be raised); module
gating, billing-type compatibility and per-module pausing; forged signatures,
modified quantity/price/amount, retargeted statements, exact replay, reused
nonce on a fresh window, overlapping and partially-overlapping windows, future
and inverted windows, stale statements; per-settlement/period/lifetime cap
breaches; executor races on both paths; revoked allowance and insufficient
balance; the hybrid shared ceiling from both directions.

Three fuzz suites assert the accounting invariants directly:
`spentThisPeriod ≤ periodSpendCap`, `totalSpent ≤ totalSpendCap`, and that
combined hybrid spend never exceeds the monthly maximum.

### Two pre-existing failures, fixed

`main` had two failing tests before any of this work. Both asserted *additive*
charge scheduling while the contract re-anchors on the charge time — which is
what its own documented invariant 6 says, and the behaviour that stops a late
executor billing a backlog all at once. The tests were wrong, not the contract;
they now assert the real behaviour and say why it matters.

### What could not be run

**The TypeScript build and typecheck did not run.** `registry.npmjs.org` is
blocked by this environment's egress policy (`x-deny-reason: host_not_allowed`),
so dependencies could not be installed. The SDK, scheduler and example sources
were checked with a standalone `tsc` under `strict`, `noUnusedLocals` and
`noUnusedParameters`: the only errors are `Cannot find module 'viem'`, and the
same `parseEventLogs` implicit-any that the pre-existing code already has.
That is not a substitute for `yarn typecheck` — **run it before merging.**

The dashboard was not built or rendered for the same reason.

---

## 10. Security notes and known risks

- **The new contracts are unaudited.** Deploy to Base Sepolia, run real traffic,
  and do not enable on mainnet on the strength of a test suite.
- **Merchant-signed usage is a trust assumption**, bounded by caps. Section 4.
- **Modules are trusted by the registry.** A registered module passes through
  the executor address that receives the fee. The owner's allowlist is that
  trust boundary; registering a hostile module would be an owner compromise.
- **Only vetted stablecoins.** The registry uses `SafeERC20`, so non-standard
  and non-returning tokens are handled — but a **fee-on-transfer or rebasing
  token would break the accounting**, because the merchant would receive less
  than the amount charged against the cap. Nothing enforces a token allowlist
  on chain today; treat the token as a merchant's responsibility and keep to
  USDC and equivalents.
- **The legacy manager's unbounded fee setters** cannot be fixed (immutable).
  Hold ownership behind a multisig.
- **`VirioSubscriptionDelegate7702` remains experimental and unreviewed.**

---

## 11. Migration

**Nothing breaks and no action is required.** The deployed subscription and
payroll managers are immutable and unmodified; existing plans, subscriptions,
caps and integrations keep working.

This change adds contracts, a deploy script and tests. **It deploys nothing.**
Run `yarn deploy:billing:base-sepolia` and set the printed addresses.

Note the chain difference: existing contracts are on **Ethereum** Sepolia, new
modules target **Base** Sepolia. The dashboard talks to one chain at a time —
`VIRIO_NETWORK` picks it (and is now validated rather than cast, since an
unknown value silently falling back is how a write lands on the wrong contract).

Moving a customer means the customer re-authorizes. There is no on-chain
migration path and there should not be one: a contract that could move a
customer's authorization between deployments without their signature would be
worse to own than the inconvenience it saves.

Feature flags, with defaults that say what has been reviewed:

```
NEXT_PUBLIC_RECURRING_BILLING_ENABLED=true
NEXT_PUBLIC_METERED_BILLING_ENABLED=true
NEXT_PUBLIC_HYBRID_BILLING_ENABLED=true
NEXT_PUBLIC_AGENT_DELEGATION_ENABLED=false   # no implementation exists
NEXT_PUBLIC_X402_ADAPTER_ENABLED=false       # experimental, unverified
```

---

## 12. Deferred work

Listed because pretending otherwise would be the failure mode here.

- **Agent spending policies** — `IVirioAgentPolicy.sol` is an interface. Nothing
  implements it, nothing is deployed. It would need `authorizeFor(owner, …)` on
  the registry, the one function that lets a contract bind an owner's funds
  without their signature on that specific authorization. That deserves its own
  security review, so the registry deliberately has no such function.
- **EIP-7702 / session keys** — not started beyond the existing experimental
  delegate. Strictly larger surface than agent policies.
- **x402 production integration** — the adapter maps x402 payment events onto
  Virio usage and quotes 402 responses from a meter's price. It does **not**
  verify or settle x402 payments. Its wire types follow the published spec but
  were **not verified against a live facilitator** — the relevant docs hosts
  were unreachable from this environment. Re-check before enabling.
- **Advanced usage verification** — independent attestation, TEE-signed
  counters. Section 4.
- **Dispute mechanisms** — none. A payer's remedy today is revocation and their
  caps.
- **Multichain expansion** — Base Sepolia only for the new stack.
- **Durable usage storage** — interface shipped, in-memory implementation only.
- **A published third-party audit** — not done.

---

## 13. Files

**Contracts** — `src/billing/{VirioAuthorizationRegistry,VirioRecurringBilling,VirioMeteredBilling}.sol`,
five interfaces, four test suites plus `BillingTestBase.sol`, `script/DeployBilling.s.sol`.

**SDK** — `src/billing/{abi,types,client}.ts`, `src/usage/{store,MemoryUsageStore,client}.ts`,
`src/x402/{types,adapter}.ts`; `Virio.ts`, `index.ts`, `indexer.ts` extended.

**Scheduler** — `src/BillingExecutor.ts`.

**Dashboard** — `lib/{billing-abis,billing-config,billing-reads,billing-actions,networks}.ts`,
`app/api/{authorizations,settlements}/route.ts`,
`components/pages/{authorizations,usage}-page.tsx`, nav and chain wiring.

**Ops** — `virio-billing-executor.mjs`, `executor.env.base-sepolia.example`.

**Docs** — `billing-architecture`, `metered-billing`, `migration`, `agent-billing`;
`introduction`, `sdk`, `security`, `contracts` updated.

**Examples** — three runnable scripts, one per billing model.
