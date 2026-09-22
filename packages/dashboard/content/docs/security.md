---
title: Security
description: Threat model, protocol guarantees, and integration checklists for merchants, frontends, and executors.
section: Protocol
order: 2
---

Virio is non-custodial by design — the protocol never holds funds, and every authorization is explicit and revocable. This page documents the guarantees the contracts provide and the responsibilities that fall to integrators.

## Security model

| Property | How it's enforced |
| --- | --- |
| **Non-custodial** | Funds move via direct `transferFrom`/`transfer` at charge time. No escrow, no pooled balances. |
| **Explicit consent** | A charge can only pull up to the customer's ERC-20 allowance (or the per-period cap on an EIP-7702 delegate). |
| **Revocable** | Customers cancel onchain, or set allowance to 0, or bump the delegate epoch — instantly. |
| **Permissionless settlement** | Anyone can `charge()`; no privileged executor can censor or be a single point of failure. |
| **Deterministic fees** | Fee math is fixed in the contract and emitted on every charge for verification. |

## Attack surfaces & mitigations

### Reentrancy

`charge()` and `executePayroll()` use a `nonReentrant` guard and strict Checks-Effects-Interactions ordering: all state is mutated **before** any external token call, so a malicious token cannot re-enter into an inconsistent state.

### Replay

- **Cross-chain replay** is prevented by including `block.chainid` in `planId`.
- **Charge replay** is impossible because timing is enforced onchain: a second `charge()` before `nextChargeAt` reverts `TooEarlyToCharge`.
- **Webhook replay** is your responsibility — deduplicate on `event.id` and reject stale `createdAt` values (see [Webhooks & Events](/docs/webhooks#replay-attack-prevention)).

### Nonce & signature handling (EIP-7702 delegate)

The `SubscriptionDelegate7702` initialization is EIP-712 signed and bound to:

- **`nonce` must equal `authEpoch`** — a signature for an old epoch can't be replayed after revocation.
- **`expiry`** — initialization signatures are time-boxed.
- **signer must be `address(this)`** — only the EOA itself can authorize its delegate, preventing front-running.

### Merchant-signed usage (metered billing)

Metered billing settles from statements the merchant signs over off-chain usage. **A signature proves the merchant attested to the usage; it does not prove the usage occurred.** This is not trustless usage verification and should not be described as such.

The on-chain protections are the meter's immutable unit price, the per-settlement / period / lifetime caps, the expiry, and revocation. A dishonest merchant can overstate usage *up to those caps*; it cannot exceed them, change the price, bill a revoked payer, or settle a window twice. Set caps to the most you would accept losing to a merchant you stop trusting.

Statement replay is blocked twice over: the merchant's nonce is burned, and a per-(meter, authorization) watermark rejects any window overlapping one already settled. Signatures are verified with OpenZeppelin `SignatureChecker` — ERC-1271 is accepted, malleable signatures are not, and the recovered signer must be **exactly** the meter's merchant, never merely non-zero.

See [Metered Billing](/docs/metered-billing) for the full verification list.

### Spend limits

Two independent caps protect customers: the subscription's `totalSpendCap` (lifetime) and the delegate's `maxPerPeriod` (per window). Breaching the lifetime cap auto-cancels; breaching the per-period cap reverts `PeriodCapExceeded`.

## Revocation

A customer can stop future charges in any of these ways, all without involving the merchant or Virio:

1. **Cancel** the subscription (`cancel`) — sets it inactive.
2. **Set allowance to 0** — `approve(manager, 0)`; the next charge reverts.
3. **Revoke the authorization** (billing stack) — `revoke()` on the registry stops every billing module at once, so one call ends both halves of a hybrid plan.
4. **Tighten limits instead of revoking** — `restrict()` lowers a cap or shortens an expiry. It can only ever tighten; there is no function that raises a limit.
5. **Revoke the delegate** (EIP-7702) — `revoke()` bumps `authEpoch` and invalidates all authorizations atomically.

## Owner controls

The managers have an `owner` that can tune fees and the fee recipient. The owner **cannot** touch user funds, move subscriptions, or charge on a user's behalf — its powers are limited to fee configuration and ownership transfer. Run ownership behind a multisig or timelock in production.

:::warning
**Known limitation in `VirioSubscriptionManager`.** Its `setExecutorFeeBps` and `setProtocolFeeBps` accept any value up to 10,000 — that is, 100%. Against a customer who has already approved the contract, a compromised owner key could therefore take far more per charge than the customer expected. The contract is immutable, so this cannot be fixed in place; it is a reason to hold ownership behind a multisig, and a reason the fee configuration is worth monitoring.

`VirioAuthorizationRegistry` closes this: total fees are capped at `MAX_TOTAL_FEE_BPS` (5%) and the flat fee at 10 USDC, both far above the 0.35% + $1 default. Attempting to set more reverts.
:::

### Emergency controls on the billing stack

The registry admits billing modules by address and can set one to `Paused`, which stops it settling without touching any payer's authorization. Pausing metered billing leaves recurring running, and vice versa — there is deliberately no single global switch.

No owner action can redirect or seize a payer's funds. Pausing stops settlement; it does not reroute it.

## Upgradeability

The current contracts are **non-upgradeable** — there is no proxy and no admin that can change settlement logic. This maximizes predictability: deployed bytecode is the contract. New behavior ships as new deployments, and integrators migrate explicitly.

## Auditing

These contracts have not yet completed a published third-party audit. Before mainnet deployment with real funds:

- Commission an independent audit and resolve findings.
- Pin and verify the exact deployed bytecode and addresses.
- Start with conservative `totalSpendCap` and `maxPerPeriod` limits.

:::warning
Treat any address in these docs as an example. Always confirm the contract address and verify its source onchain before approving token spend against it.
:::

## Merchant checklist

- Set `amount` greater than the total fee (≈ 1 USDC flat + 0.35%) so charges never revert `InvalidAmount`.
- Reconcile against onchain `ChargeExecuted` events as the source of truth — never rely solely on webhooks.
- Monitor subscriptions for repeated charge failures (allowance ran out) and prompt re-approval.
- Run the executor/owner keys in a secrets manager; never commit them.

## Frontend checklist

- Request an allowance aligned with `totalSpendCap`, not an unbounded `MaxUint256`, unless the user opts in.
- Show the per-charge amount, period, and total cap before the user signs.
- Surface a one-click cancel/revoke path.
- Validate the chain and contract address before sending any transaction.

## Executor checklist

- Make `tick()` idempotent and safe to run concurrently — the contract guards timing, but avoid wasting gas on guaranteed reverts by checking `isDue()` / `getDueRecipients()` first.
- Handle reverts by reason: ignore `TooEarlyToCharge`, retry transient RPC errors with backoff, alert on `transferFrom failed`.
- Persist scheduler state in a durable store (not `MemoryStorage`) so restarts don't drop schedules.
- Cap gas price and add circuit breakers so a chain congestion event can't drain the executor wallet.
