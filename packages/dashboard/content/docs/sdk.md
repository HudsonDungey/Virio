---
title: SDK Reference
description: Every method, option, and type in the @virio/sdk TypeScript client.
section: Build
order: 2
---

`@virio/sdk` is a fully-typed, viem-based client for the Virio subscription protocol. It works in Node and the browser, server-side with a private key or client-side with a wallet client.

## Installation

```bash
npm install @virio/sdk
```

## Constructing a client

```ts
import { Virio } from "@virio/sdk";

const virio = new Virio({
  contractAddress: "0x…",
  chain: "base",
  rpcUrl: process.env.RPC_URL,
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
});
```

You can also build from a config object (`Virio.fromConfig(options)`) or a JSON file (`Virio.fromConfigFile({ path?, chain? })`, default `./virio.config.json`).

### Options

| Option | Type | Description |
| --- | --- | --- |
| `contractAddress` | `Address` | The VirioSubscriptionManager address. Required. |
| `chain` | `Chain \| string \| number` | viem chain, friendly name (`"base"`, `"sepolia"`, `"anvil"`), or chain id. Required. |
| `rpcUrl` | `string` | Your RPC endpoint (e.g. Alchemy). Used to build the internal clients. |
| `usdcAddress` | `Address` | Payment token. Defaults to the chain's canonical USDC when known. |
| `account` | `Address` | Default account for reads like `getBalance()`. |
| `privateKey` | `Hex` | Server-side signing key for write calls. |
| `walletClient` | `WalletClient` | Pre-built wallet client (e.g. wagmi) for write calls in the browser. |
| `publicClient` | `PublicClient` | Pre-built read client; one is created from `rpcUrl` otherwise. |
| `deploymentBlock` | `bigint \| number` | First block scanned by list helpers and event watchers. |

:::note
Provide **either** `privateKey` (server) **or** `walletClient` (browser) for write operations. Read-only methods need neither.
:::

## Helpers

```ts
import { usdc, fromUsdc, formatUsdc, PERIOD, intervalToPeriod } from "@virio/sdk";

usdc(49);              // 49000000n   (49 USDC, 6 decimals)
fromUsdc(49000000n);   // 49
formatUsdc(49000000n); // "49.00"
PERIOD.MONTHLY;        // 2592000n
intervalToPeriod("month"); // 2592000n
```

`PERIOD` exposes `MINUTE`, `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY` (30d), and `ANNUALLY` (365d). Use `parseUnits` / `formatUnits` for non-USDC tokens.

## Resource namespaces

The client groups operations Stripe-style. `virio.products` is an alias of `virio.plans`.

```ts
virio.plans.create(params)      // → { txHash, planId }
virio.plans.get(planId)         // → Plan
virio.plans.list(merchant?)     // → PlanRecord[]
virio.plans.deactivate(planId)  // → Hash

virio.subscriptions.subscribe(params)        // → { txHash, subscriptionId }
virio.subscriptions.get(subscriptionId)      // → Subscription
virio.subscriptions.list(address, role?)     // → SubscriptionRecord[]
virio.subscriptions.charge(subscriptionId)   // → Hash
virio.subscriptions.cancel(subscriptionId)   // → Hash
virio.subscriptions.isDue(subscriptionId)    // → boolean
```

## Reads

### `getPlan(planId)`

Fetch a plan's onchain state. Returns a [`Plan`](#types).

```ts
const plan = await virio.getPlan(planId);
plan.amount; // 49000000n
```

### `getSubscription(subscriptionId)`

Fetch a subscription's onchain state. Returns a [`Subscription`](#types).

### `isDue(subscriptionId)`

Returns `true` if the subscription is active and `nextChargeAt <= now`.

### `computeSubscriptionId(planId, customer)`

Compute the deterministic subscription id locally, without a network call. Mirrors the contract's `keccak256(planId ‖ customer)`.

### `getFees()`

Read the protocol fee configuration.

```ts
const fees = await virio.getFees();
// { executorFeeBps: 10, protocolFeeBps: 25, protocolFlatFee: 1000000n, feeRecipient: "0x…" }
```

### Token balances

```ts
await virio.getBalance(account?, token?);          // bigint
await virio.getBalanceFormatted(account?, token?); // "1234.56"
await virio.getAllowance(owner?, spender?, token?);// bigint (spender defaults to the manager)
await virio.getDecimals(token?);                   // number (cached)
```

Account defaults to the configured `account` (or wallet); token defaults to the chain's USDC.

## Lists (event-indexed)

These reconstruct history from contract events, scanning from `deploymentBlock`.

### `getSubscriptions(address, role?)`

List subscriptions involving an address. `role` is `"customer"`, `"merchant"`, or `"any"` (default). Returns [`SubscriptionRecord[]`](#types) (state merged with id + planId).

### `getPlans(merchant?)`

List plans, optionally filtered to one merchant. Returns `PlanRecord[]`.

### `getCharges(filter?)`

Charge history from `ChargeExecuted` logs. Filter by `{ subscriptionId?, customer? }`.

```ts
const charges = await virio.getCharges({ subscriptionId });
charges[0].merchantAmount; // 47828500n
```

## Writes

All writes require a wallet (`privateKey` or `walletClient`) and wait for the transaction receipt before resolving.

### `createPlan({ token?, amount, period })`

Creates a plan; the caller becomes the merchant. Returns `{ txHash, planId }`.

| Param | Type | Notes |
| --- | --- | --- |
| `token` | `Address?` | Defaults to configured USDC. |
| `amount` | `bigint` | Gross per charge, smallest unit. |
| `period` | `bigint` | Seconds between charges. |

### `subscribe({ planId, totalSpendCap? })`

Subscribes the calling wallet. Returns `{ txHash, subscriptionId }`. Approve the manager first (see below).

### `approve(amount, token?, spender?)`

Approves the manager (or `spender`) to spend `amount` of the token. Returns the tx `Hash`. `approveToken(token, amount)` is an equivalent alias.

### `charge(subscriptionId)`

Charges a due subscription. **Permissionless** — the caller earns the executor fee. Returns `Hash`.

### `cancel(subscriptionId)`

Cancels a subscription. Callable by the customer **or** the merchant. Returns `Hash`.

### `deactivatePlan(planId)`

Deactivates a plan (merchant only). Existing subscriptions are unaffected. Returns `Hash`.

## Events

`watch()` polls the RPC and invokes your callback with decoded logs. Returns an unsubscribe function. Useful as a local alternative to webhooks in development.

```ts
const unwatch = virio.watch("ChargeExecuted", (logs) => {
  for (const log of logs) console.log(log.args);
});
// later: unwatch();
```

Event names: `PlanCreated`, `PlanDeactivated`, `Subscribed`, `ChargeExecuted`, `Cancelled`.

## Error handling & retries

The SDK surfaces viem errors directly. Wrap writes and inspect the revert reason to decide whether to retry.

```ts
try {
  await virio.subscriptions.charge(subscriptionId);
} catch (err) {
  const msg = String(err);
  if (msg.includes("TooEarlyToCharge")) {
    // not due yet — safe to ignore, retry next tick
  } else if (msg.includes("transferFrom failed")) {
    // insufficient allowance/balance — prompt the customer to re-approve
  } else {
    throw err; // unexpected — surface it
  }
}
```

- **Idempotency:** charging is safe to retry. Timing is enforced onchain, so a premature retry reverts rather than double-charging.
- **Backoff:** for transient RPC errors, retry with exponential backoff. For revert reasons like `TooEarlyToCharge`, wait until the subscription is due instead.

## Webhook helpers

For signing and verifying your own self-hosted webhook deliveries. See [Webhooks & Events](/docs/webhooks).

```ts
import { signWebhook, verifyWebhook, buildEvent } from "@virio/sdk";
```

## Types

```ts
interface Plan {
  merchant: Address; token: Address;
  amount: bigint; period: bigint; active: boolean;
}

interface Subscription {
  customer: Address; merchant: Address; token: Address;
  amount: bigint; period: bigint;
  nextChargeAt: bigint; totalSpendCap: bigint; totalSpent: bigint;
  active: boolean;
}

interface Fees {
  executorFeeBps: number; protocolFeeBps: number;
  protocolFlatFee: bigint; feeRecipient: Address;
}
```

`PlanRecord` and `SubscriptionRecord` extend these with their onchain `id` (and `planId` for subscriptions). `Charge` mirrors the `ChargeExecuted` event.
