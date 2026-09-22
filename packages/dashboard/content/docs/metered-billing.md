---
title: Metered Billing
description: Usage-based billing on Virio — meters, off-chain accounting, merchant-signed settlement statements, and exactly who you have to trust.
section: Build
order: 4
---

Metered billing charges for what a customer actually used: API requests, inference calls, tokens, compute seconds, storage, messages, jobs, or any unit you define.

```ts
const billing = await virio.billing.create({
  type: "metered",
  meter: { unit: "api_request", pricePerUnit: "0.002" },
  settlement: { interval: "day" },
  limits: { monthlyCap: "100" },
  token: "USDC",
});
```

That authorizes: **$0.002 per API request, settled daily, at most $100 a month.**

## Read this first: the trust model

Virio's metered billing is **not trustless usage verification**, and this documentation will not describe it as such.

Individual usage events stay off chain. Putting an API call on chain would cost far more gas than the call is worth. To settle, the merchant signs an EIP-712 statement asserting *"this authorization used N units between T0 and T1"*.

**That signature proves the merchant attested to the usage. It does not prove the usage happened.**

What protects the customer is enforced on chain, and it is real:

| Protection | How |
| --- | --- |
| **Fixed price** | A meter's `unitPrice` is immutable. Repricing requires a new meter, so an existing authorization can never be silently repriced. |
| **Per-settlement cap** | `maxPerCharge` — no single statement can exceed it. |
| **Period cap** | `periodSpendCap` — no month can exceed it, however many statements arrive. |
| **Lifetime cap** | `totalSpendCap` — survives period rollovers. |
| **Expiry** | `validUntil`, after which nothing settles. |
| **Revocation** | The payer can revoke at any time, and every module stops. |
| **Auditability** | Units, unit price and window are all in the settlement event. |

So: a dishonest merchant can overstate usage **up to those caps**. It cannot exceed them, invent a different price, bill a revoked customer, or settle the same window twice. Set your caps to the most you are willing to lose to a merchant you stop trusting.

Stronger usage verification — attestations from independent parties, TEE-signed counters, dispute windows — is deferred work, not something this release provides.

## Meters

A meter is a merchant's published price for one unit:

```ts
const { meterId } = await virio.billing.createMeter({
  unit: "api_request",        // hashed on chain; the label lives off chain
  unitPrice: 2_000n,          // $0.002 at 6 decimals
  includedUnitsPerPeriod: 0n, // the free allowance in hybrid plans
  settlementInterval: 86_400n // advisory cadence for executors
});
```

The unit label is stored as `keccak256("api_request")`. Free-form strings on chain cost gas for data no contract reads, so the readable label is served by the SDK and indexer.

There is deliberately **no `updateMeter` for price**. `disableMeter()` retires one; changing a price means creating a new meter. That removes an entire class of "the merchant quietly raised the price" concerns.

## Recording usage

```ts
await virio.usage.record({
  authorizationId,
  meterId,
  quantity: 1,
  idempotencyKey: requestId,
});
```

`idempotencyKey` is mandatory. An API request retried five times must not produce five billable events, and the SDK enforces that rather than hoping callers get it right. Batching works too:

```ts
await virio.usage.recordBatch(events);
```

Each event is validated and de-duplicated independently, so one duplicate never discards the rest of a batch.

Usage lives in a `UsageStore`. The default is in-memory — fine for development, and it loses unsettled usage on restart, which costs you revenue rather than over-charging a customer. Production deployments should implement the interface against a real database.

## Reading the accrual

```ts
const usage = await virio.usage.get({ authorizationId, meterId, period: "current" });
```

```json
{
  "units": 1827,
  "billableUnits": 1827,
  "unitPrice": 2000,
  "accruedAmount": "3.654",
  "periodCap": "100",
  "remainingCap": "96.346",
  "eventCount": 1827
}
```

Every input behind the amount is returned, not just the total: 1,827 × $0.002 = $3.654. A customer can check that arithmetic. An opaque final amount would not be auditable, so Virio does not store one.

## Settling

```ts
const signed = await virio.usage.signNextStatement({ authorizationId, meterId });
if (signed) await virio.billing.settleStatement(signed);
```

`signNextStatement` returns `null` when nothing is billable — a quiet period costs no transaction.

The window starts at the on-chain watermark (`lastSettledEnd`) so consecutive statements abut exactly: no gap loses usage, no overlap bills it twice.

On chain, `settle()` verifies all of this before any money moves:

1. the meter is active
2. the meter and authorization name the same merchant
3. the tokens match
4. `unitPrice` equals the meter's immutable price
5. `amount == units × unitPrice`
6. `periodEnd > periodStart`
7. `periodEnd` is not in the future
8. the merchant's nonce is unused
9. the window does not overlap a settled one
10. the signature recovers to **exactly** the meter's merchant
11. — then the registry checks per-charge, period and lifetime caps, the validity window, revocation, and that the module is not paused.

Signatures are checked with OpenZeppelin's `SignatureChecker`, so a merchant may sign from a multisig (ERC-1271), and malleable signatures are rejected.

## Settlement fees

A settlement pays the executor fee and the protocol fee out of the gross, the same as a recurring charge. The protocol's flat fee is significant on small settlements — at a $1 flat fee, a $3.65 daily settlement gives up more than a quarter of its value.

**Settle less often when amounts are small.** Weekly instead of daily on a low-volume meter keeps far more of the revenue. A settlement that cannot cover its own fees is rejected outright.
