---
title: Core Concepts
description: The mental model behind Virio — plans, subscriptions, permissions, execution windows, executors, fees, and settlement.
section: Build
order: 1
---

Virio is intentionally small. A handful of concepts compose into subscriptions, payroll, and metered billing. Read this once and the rest of the docs become predictable.

## Plans

A **plan** is a merchant's pricing definition stored onchain: a token, a gross amount per charge, and a period.

- **Why it exists:** plans decouple pricing from individual customers. One plan serves unlimited subscribers.
- **Amount is gross and fee-inclusive.** A `usdc(49)` plan pulls 49 USDC per charge; fees come out of that amount, not on top.
- **Period is seconds.** Use the `PERIOD` constants (`PERIOD.MONTHLY` = `2_592_000n`).

```ts
const { planId } = await virio.plans.create({
  amount: usdc(49),
  period: PERIOD.MONTHLY,
});
```

The `planId` is deterministic: `keccak256(merchant ‖ nonce ‖ chainId)`. Including the chain ID prevents cross-chain replay.

:::warning
**Common mistake:** treating `amount` as a net payout. Fees are deducted from the gross, so set `amount` to what the customer pays. Also ensure `amount` exceeds the total fee (≈ 1 USDC flat + 0.35%) or `charge()` reverts `InvalidAmount`.
:::

## Subscriptions

A **subscription** is a customer's onchain agreement to a plan. At `subscribe()` time the plan's parameters are **denormalized** (copied) into the subscription, so it keeps working even if the merchant later changes or deactivates the plan.

```ts
const { subscriptionId } = await virio.subscriptions.subscribe({
  planId,
  totalSpendCap: usdc(588), // optional lifetime cap; omit for unlimited
});
```

- `subscriptionId` = `keccak256(planId ‖ customer)` — one subscription per (plan, customer) pair.
- A new subscription's `nextChargeAt` is the current timestamp, so it's **immediately chargeable**.

## Permissions

Virio never takes custody. Funds move only when the customer has granted permission. There are two complementary mechanisms:

### ERC-20 allowance (default)

The customer calls `approve()` to let the manager pull up to `amount` of the token. This is the standard path and works with every wallet.

```ts
await virio.approve(usdc(588)); // headroom for ~12 charges
```

- **Why headroom:** each charge consumes allowance. Approve enough for the charges you expect, or re-approve before it runs out.
- **Best practice:** approve an amount aligned with `totalSpendCap` so the onchain cap and the allowance agree.

### EIP-7702 delegation (advanced)

For wallets that support EIP-7702, the `SubscriptionDelegate7702` contract enforces a **per-period spend cap** at the wallet itself and supports instant, epoch-based revocation. See [Smart Contracts](/docs/contracts#subscriptiondelegate7702).

## Execution windows

Each subscription has a `nextChargeAt` timestamp. A charge is only valid once `block.timestamp >= nextChargeAt`; otherwise it reverts `TooEarlyToCharge`.

After a successful charge, `nextChargeAt += period` — **additive, not `now + period`** — so cadence never drifts even if a charge lands late.

:::diagram subscription-states
:::

## Executors

An **executor** is any wallet that calls `charge()`. Settlement is permissionless: the first executor to charge a due subscription earns the executor fee (0.1% of gross). You can run your own executor, rely on a third party, or use the bundled `@virio/scheduler`.

:::diagram executor-flow
:::

- **Why permissionless:** no single party can censor settlement, and merchants don't depend on Virio running infrastructure.
- **Idempotent by construction:** duplicate or racing charges simply revert `TooEarlyToCharge`; the customer is never double-charged.

## Protocol fees

Every charge splits the gross amount onchain in a single transaction:

| Recipient | Share |
| --- | --- |
| Executor | `amount × 10 / 10000` (0.1%) |
| Protocol | `amount × 25 / 10000 + 1 USDC` flat |
| Merchant | the remainder |

There is no monthly fee and no markup added on top of the customer's charge.

## Spend caps & retries

- **Lifetime cap:** set `totalSpendCap` at subscribe time. When a charge would exceed it, the subscription **auto-cancels** (emits `Cancelled`) instead of reverting — the executor's transaction still succeeds.
- **Retries:** a failed charge (e.g. insufficient allowance) simply reverts and leaves `nextChargeAt` unchanged, so the executor retries on the next tick. There is no penalty; the charge becomes valid again as soon as the customer tops up their allowance.

:::note
**Best practice:** monitor for repeated charge failures on a subscription and prompt the customer to re-approve before treating it as churned.
:::

## Settlement

Settlement is a direct `transferFrom`: customer → merchant, executor, and protocol, atomically. There is **no escrow and no intermediate custody** — if any leg fails, the whole charge reverts and no funds move. This is what makes executors interchangeable and the protocol non-custodial.
