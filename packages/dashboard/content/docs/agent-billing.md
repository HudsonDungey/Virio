---
title: Agent Billing & x402
description: How AI agent spending and x402 fit into Virio — the design, what exists today, and what deliberately does not.
section: Protocol
order: 6
---

Two capabilities people ask about, covered together because the honest answer for both is *"designed, not shipped"*.

## Agent billing

An AI agent that pays for APIs, compute and services needs a spending budget it cannot exceed. That is the same problem Virio's authorization layer already solves — so agent billing is **not a separate payment protocol**.

```
  Wallet owner
       │ authorizes
       ▼
  AI agent  ─── constrained by ───▶  Agent policy
       │                              USDC only
       │                              $250/month, $10 max per transaction
       │                              approved services only
       │                              expires in 30 days
       ▼
  Virio authorization ──▶ registry caps ──▶ recurring / metered modules
       │
       ▼
  APIs · compute · SaaS · services
```

An agent policy is a **template for authorizations**. The agent opens authorizations within it; each one is then bound by the registry's ordinary per-charge, period and lifetime caps. Everything an agent spends is already covered by the machinery that bounds a human's subscription.

### What exists today

`IVirioAgentPolicy.sol` — an interface, with the struct, the events and the call shapes. That is all.

**Nothing implements it. Nothing is deployed. `AGENT_DELEGATION_ENABLED` is `false`.**

### Why it stops there

A module that opens authorizations on an owner's behalf needs `authorizeFor(owner, …)` in the registry — a function that would let a registered contract bind an owner's funds without the owner signing that specific authorization.

That is a materially larger trust surface than anything else in this protocol, and it deserves its own security review rather than being slipped in alongside metered billing. **The registry deliberately has no such function.**

The interface exists so the eventual shape is fixed now, while changing it is cheap.

### The order things would ship in

1. The policy module, on testnet, with allowlisted merchants only.
2. Merchant allow/denylists, per-service sub-limits, category limits.
3. EIP-7702 / session keys, so an agent can spend from the owner's own EOA.

Step 3 is a strictly larger surface again. `VirioSubscriptionDelegate7702` already exists in the repository and remains experimental and unreviewed — treat any delegated-wallet execution as a major security surface, not a convenience feature.

## x402

**Virio does not replace x402 and does not compete with it.** They answer different questions:

| | Question |
| --- | --- |
| **x402** | How does a client pay for *this request*, right now, over HTTP? |
| **Virio** | What is this payer allowed to spend *over time*, and how is a relationship of many requests billed and settled? |

The useful composition is both: x402 carries the per-request payment event, Virio carries the authorization, the budget and the aggregation. x402 alone knows nothing about a payer's monthly ceiling.

```ts
// Before doing the work, check the request fits the payer's Virio budget.
const { ok, reason } = await adapter.withinBudget({ authorizationId, amount });

// After x402 settles the payment, record it as Virio usage.
await adapter.recordPayment({ authorizationId, meterId, requestId });
```

`X402Adapter` also quotes a 402 response from a meter's price, so the price an x402 client sees is the same one the meter charges on chain — one source of pricing truth.

### What it does not do

**It does not verify or settle x402 payments.** That needs a facilitator and EIP-3009 support, and settling another protocol's payments is not something to ship untested.

`recordPayment()` records usage that x402 *already paid for*. It does not then settle the same usage on chain — that would double-charge.

### Status

`X402_ADAPTER_ENABLED` is `false`. The wire types in `packages/sdk/src/x402/types.ts` follow the published x402 specification, but **they were not verified against a live facilitator**. Re-check them against the current spec before enabling this anywhere real.

Nothing in the billing engine imports the adapter. The core protocol stays protocol-agnostic, and the adapter can be rewritten when the spec moves without touching anything else.
