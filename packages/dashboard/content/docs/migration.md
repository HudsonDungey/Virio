---
title: Migration
description: What the programmable billing stack means for existing Virio deployments, integrations and customers — and what, if anything, you need to do.
section: Protocol
order: 5
---

## Nothing breaks

`VirioSubscriptionManager` is deployed, **immutable, and has not been modified**. It cannot be: it is non-upgradeable bytecode, which is the point of deploying it that way.

If you are using it today:

- Your plans, subscriptions and spend caps are untouched.
- `charge()` keeps working, executors keep earning, customers keep paying.
- Your SDK calls (`virio.plans`, `virio.subscriptions`) are unchanged.
- **No action is required.**

The programmable billing stack is a **separate deployment** that runs alongside it. Both are live at once.

## What was actually deployed where

| Contract | Chain | Status |
| --- | --- | --- |
| `VirioSubscriptionManager` | Ethereum Sepolia | deployed, immutable, unchanged |
| `VirioPayrollManager` | Ethereum Sepolia | deployed, immutable, unchanged |
| `VirioSubscriptionDelegate7702` | Ethereum Sepolia | deployed, experimental, unchanged |
| `VirioAuthorizationRegistry` | Base Sepolia | **new — not yet deployed by this change** |
| `VirioRecurringBilling` | Base Sepolia | **new — not yet deployed by this change** |
| `VirioMeteredBilling` | Base Sepolia | **new — not yet deployed by this change** |

Worth being exact: this change adds the contracts, the deploy script and the tests. It does not deploy anything. Run `yarn deploy:billing:base-sepolia` and paste the printed addresses into your environment.

Note the chain difference. The existing deployment is on **Ethereum** Sepolia; new billing modules target **Base** Sepolia, matching where Virio settles in production. They are separate networks — an existing subscription is not visible to the new stack and does not need to be.

## Moving a subscription across

There is no on-chain migration path, and there should not be one: a contract that could move a customer's authorization from one deployment to another without their signature would be a much worse thing to own than the inconvenience it saves.

Moving a customer means the customer re-authorizes:

1. Merchant creates a plan on `VirioRecurringBilling`.
2. Customer approves `VirioAuthorizationRegistry` on the token.
3. Customer authorizes with their spend limits, then subscribes.
4. Either party cancels the old subscription on `VirioSubscriptionManager`.

Do it in that order. Cancelling first leaves a gap in the merchant's revenue; cancelling last means at worst one overlapping charge, which is visible and refundable off chain.

The SDK does all four in the examples — see `examples/01-saas-subscription.ts`.

## What changes if you do move

Three behaviours are deliberately different. None is accidental.

**Spend limits move out of the subscription.** They live on a reusable `Authorization`, which is what lets one authorization back both a base subscription and metered usage (hybrid billing). A subscription now references an authorization rather than carrying its own cap.

**A cap breach reverts instead of auto-cancelling.** The old manager silently cancelled a subscription when it hit its lifetime cap. The new module reverts with a typed error. A cap hit is a condition the payer should see and decide about — reaching a ceiling is not the same as wanting to leave, and having the executor destroy the relationship on your behalf is the wrong default.

**Per-merchant counters are gone.** `getMerchantStats()` cost an SSTORE on every charge to store numbers the `Settled` event already carries. The dashboard derives the same figures from events.

One behaviour is deliberately the **same**: `nextChargeAt` still re-anchors on the charge time, so a late executor produces one catch-up charge, not one per missed period. An executor outage cannot bill a customer three times when it comes back.

## Two hardening changes

**Fees are now bounded.** The legacy manager let the owner set `executorFeeBps` or `protocolFeeBps` to 10,000 — 100%. Against an existing approval and authorization, that made "the owner cannot take user funds" false in the limit. The registry caps total fees at `MAX_TOTAL_FEE_BPS` (5%) and the flat fee at 10 USDC, both far above the 0.35% + $1 default.

**Emergency controls cannot seize funds.** The owner can pause a module, which stops settlement. There is no owner function that moves a payer's tokens, and pausing redirects nothing.

## Executors

Existing executors keep running against the subscription manager and need no changes.

To settle the new stack, run a second executor — `BillingExecutor` from `@virio/scheduler`, configured in `ops/executor-vps/executor.env.base-sepolia.example`. It handles recurring charges and metered settlements on Base Sepolia. The two run side by side.

## Feature flags

Everything new is flagged, and the defaults say what has and has not been reviewed:

```
NEXT_PUBLIC_RECURRING_BILLING_ENABLED=true
NEXT_PUBLIC_METERED_BILLING_ENABLED=true
NEXT_PUBLIC_HYBRID_BILLING_ENABLED=true
NEXT_PUBLIC_AGENT_DELEGATION_ENABLED=false   # no implementation exists
NEXT_PUBLIC_X402_ADAPTER_ENABLED=false       # experimental, unreviewed
```

Leave the billing addresses unset and the dashboard behaves exactly as it does today — the billing pages return empty rather than erroring.

## Testnet first

The new modules have not been audited. Deploy them to Base Sepolia, run real traffic through them, and do not enable them on mainnet on the strength of a test suite alone.
