---
title: Billing Architecture
description: How Virio separates authorization, billing and settlement, and why recurring, metered and hybrid billing are three configurations of one protocol.
section: Protocol
order: 4
---

Virio is **open programmable billing infrastructure for stablecoins**. It gives applications, wallets and agents programmable payment authorization for recurring, usage-based and hybrid billing.

The whole design rests on one separation:

> **Billing** determines what is owed.
> **Authorization** determines what may be charged.
> **Settlement** moves the money.

Keeping those apart is what makes three billing models feel like one protocol rather than three products.

## The stack

```
  Applications      humans · SaaS · APIs · AI agents · wallets
        ↓
  Virio SDK         virio.billing · virio.usage
        ↓
  Billing modules   recurring        metered        (hybrid = both)
        ↓           what is owed
  Authorization     per-charge limit · period cap · lifetime cap
     registry       validity window · revocation · billing type
        ↓           what may be charged
  Execution         permissionless executors
        ↓
  Settlement        USDC and other supported stablecoins
        ↓
  Base
```

## Why the split matters

Before this, spend limits lived inside the subscription contract. That worked for one billing model. A second model would have needed its own copy of the limit logic — and two copies of a spend cap is how a payer ends up charged twice.

Now there is exactly one place money moves: `VirioAuthorizationRegistry.settle()`. A billing module computes an amount and calls it. The registry re-checks every payer-defined limit **from its own storage** before transferring.

The consequence is worth stating plainly: **a billing module cannot collect more than the payer authorized, even if the module's own accounting is wrong.** Correctness of the limits does not depend on the correctness of any module.

## Authorizations

An authorization is a payer's standing permission for one merchant:

| Field | Meaning |
| --- | --- |
| `payer`, `merchant`, `token` | who, to whom, in what |
| `billingType` | `RECURRING`, `METERED` or `HYBRID` |
| `maxPerCharge` | largest single settlement — always set, never unlimited |
| `periodSpendCap` | ceiling per period; `0` = uncapped |
| `totalSpendCap` | lifetime ceiling; `0` = uncapped |
| `periodStart`, `periodDuration` | the spend window |
| `validAfter`, `validUntil` | when it works at all |
| `spentThisPeriod`, `totalSpent` | what has been used |
| `active` | revoked or not |

Two properties are load-bearing:

- **Limits only ever tighten.** `restrict()` lets a payer lower a cap or shorten an expiry. There is no function that raises one. Loosening means authorizing again, which re-prompts the payer.
- **Periods are additive.** `periodStart` advances by whole periods (`periodStart += n × periodDuration`), so a settlement that arrives late never shifts the grid. A month is a month, whenever it gets billed.

Creating an authorization moves no money and grants no allowance. The payer must also `approve()` the registry on the ERC-20. Both are required; neither implies the other.

## Billing modules

A module answers one question — what is owed — and holds no funds:

- **`VirioRecurringBilling`** — plans and due dates. `charge()` is permissionless; the caller earns the executor fee.
- **`VirioMeteredBilling`** — meters and merchant-signed usage statements. `settle()` is permissionless too.

The registry admits modules by address and can pause one without touching any payer's authorization. Adding a billing model means deploying a module and registering it — the authorization layer does not change.

## Hybrid billing has no contract

This is the part most worth understanding.

A hybrid plan — "$20/month, 10,000 requests included, $0.001 each after that, $50/month maximum" — is **one `HYBRID` authorization that both modules settle against**.

```
  recurring module ──┐
                     ├──▶ one HYBRID authorization ──▶ one $50/month ceiling
  metered module   ──┘
```

The base charge and the overage draw on the same `spentThisPeriod`. Whichever module gets there first consumes the shared budget, and neither can spend past the ceiling — because neither module enforces it. The registry does.

There is no third contract, no duplicated payment logic, and no way for the two halves to disagree about how much has been spent.

## Execution

Executors are permissionless: anyone may call `charge()` or `settle()` and earn the executor fee. Before spending gas they read current state and ask the contract whether the call would succeed (`chargeable()`, `settleable()`, `canSettle()`).

Those checks are an **economic filter, not a safety net**. Double-charge protection, spend caps, replay protection and authorization validity are enforced on chain. An executor that skipped every check would waste gas — it could not overcharge anyone.

Two executors racing the same item is expected. The first advances the state the second depends on, so the loser's transaction reverts. Exactly one settlement lands.

## Relationship to the deployed subscription manager

`VirioSubscriptionManager` is deployed, immutable and **unchanged**. Merchants using it keep charging with no action required. The billing stack is a separate deployment that sits alongside it.

See [Migration](/docs/migration) for what moving across involves and what it costs.

## What is not here

Stated plainly rather than implied:

- **Agent spending policies** — interface only, nothing implemented or deployed.
- **EIP-7702 / session keys** — experimental, feature-flagged off, not reviewed.
- **x402 settlement** — the adapter maps x402 events onto Virio usage; it does not verify or settle x402 payments.
