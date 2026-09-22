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

## Entry points

One package, several entrypoints — import only what your stack needs:

| Import | What it gives you |
| --- | --- |
| `@virio/sdk` | The core `Virio` client documented on this page. |
| `@virio/sdk/react` | Native React components: `<VirioProvider>`, `<VirioButton>`, `useVirio()`. |
| `@virio/sdk/vue` | Native Vue plugin (`VirioVue`) registering the `<virio-button>` element. |
| `@virio/sdk/angular` | Native Angular bindings (`defineVirioAngularElements`). |
| `@virio/sdk/web` | Framework-neutral `<virio-button>` Web Component + `openVirioCheckout()`. |
| `@virio/sdk/checkout` | Headless `VirioCheckout` controller for fully custom checkout UIs. |
| `@virio/sdk/node` | Node-only config-file loading: `loadConfig()`, `virioFromConfigFile()`. |

`@virio/sdk/vanilla` remains as a deprecated alias of `/web`. The framework entrypoints are covered in [Drop-in Button](/docs/react-button); the rest of this page documents the core client.

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

You can also build from a config object (`Virio.fromConfig(options)`). In Node, `virioFromConfigFile()` from `@virio/sdk/node` builds a client from a `virio.config.json` file (with `VIRIO_RPC_URL` / `VIRIO_PRIVATE_KEY` env overrides) instead of inline options.

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

## Prepared transactions

Every write has a `prepare*` counterpart that returns calldata instead of sending it — for wallets the SDK doesn't manage (wagmi `sendTransaction`, safes, batching, agents that inspect before signing). Each returns a `PreparedTransaction`: `{ to, data, value, label, functionName, args }`.

```ts
virio.plans.prepareCreate(params);
virio.plans.prepareDeactivate(planId);
virio.subscriptions.prepareSubscribe(params);
virio.subscriptions.prepareCancel(subscriptionId);
virio.subscriptions.prepareCharge(subscriptionId);
virio.prepareApprove(amount, token?, spender?);
```

All are pure calldata encoding — no network calls, no wallet needed.

### `prepareCheckout(params, customer?)`

Plans a complete checkout in one call: reads the plan and the customer's current allowance, then returns the exact transaction list to sign — the approval (only if the allowance is short) followed by `subscribe`.

```ts
const checkout = await virio.subscriptions.prepareCheckout({ planId }, customer);
checkout.needsApproval;      // boolean
checkout.subscriptionId;     // computed locally, known before signing
for (const tx of checkout.transactions) {
  await walletClient.sendTransaction({ to: tx.to, data: tx.data });
}
```

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

Configuration and usage mistakes throw typed `VirioError` subclasses with a machine-readable `code` — `MissingWalletError` (`MISSING_WALLET`), `MissingTokenError`, `MissingAccountError`, `MissingContractError`, `EventNotFoundError`. Onchain reverts surface as viem errors; inspect the revert reason to decide whether to retry.

```ts
import { VirioError } from "@virio/sdk";

try {
  await virio.subscriptions.charge(subscriptionId);
} catch (err) {
  if (err instanceof VirioError) {
    // client misconfiguration — e.g. MISSING_WALLET: no signer for a write
    throw err;
  }
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

## Programmable billing

The `virio.billing` surface talks to the authorization registry and its modules — a separate deployment from `virio.plans` / `virio.subscriptions`, which still drive the original subscription manager. Configure it with the three addresses:

```ts
const virio = new Virio({
  contractAddress, chain, rpcUrl,
  billing: { authorizationRegistry, recurringBilling, meteredBilling },
});
```

Omit `billing` and everything else works exactly as before; `virio.billing` throws only if you use it unconfigured.

### One call per billing relationship

```ts
// Recurring
await virio.billing.create({
  type: "recurring",
  amount: "29.00",
  interval: "month",
  token: "USDC",
});

// Metered
await virio.billing.create({
  type: "metered",
  meter: { unit: "api_request", pricePerUnit: "0.002" },
  settlement: { interval: "day" },
  limits: { monthlyCap: "100" },
  token: "USDC",
});

// Hybrid — base + usage against ONE authorization, sharing one cap
await virio.billing.create({
  type: "hybrid",
  base: { amount: "20", interval: "month" },
  usage: { unit: "api_request", includedUnits: 10_000, pricePerUnit: "0.001" },
  limits: { monthlyCap: "50" },
  token: "USDC",
});
```

`maxPerCharge` is mandatory onchain. Omit it and the SDK derives the tightest value your terms can need — it never defaults to something open-ended.

### The lower-level calls

`create()` is a composition, not a wall. Everything it uses is public:

```ts
virio.billing.authorize(params)                 // the authorization itself
virio.billing.restrict(id, limits)              // tighten; never loosens
virio.billing.revoke(id)
virio.billing.remaining(id)                     // headroom under each cap
virio.billing.listAuthorizations(address, role)
virio.billing.listSettlements(filter)

virio.billing.createPlan / subscribe / cancel / charge / chargeable
virio.billing.createMeter / disableMeter / signStatement / settleStatement / settleable

virio.billing.prepareAuthorize(params)          // calldata, no signing
virio.billing.prepareRevoke(id)
```

`prepare*` returns calldata without touching the chain, so wallets and agents can inspect exactly what they are about to sign.

## Usage

```ts
await virio.usage.record({
  authorizationId,
  meter: meterId,
  quantity: 1,
  idempotencyKey: requestId,   // required — a retry must bill once
});

await virio.usage.recordBatch(events);

const usage = await virio.usage.get({ authorizationId, meterId, period: "current" });
// { units, billableUnits, unitPrice, accruedAmount, periodCap, remainingCap, eventCount }

const signed = await virio.usage.signNextStatement({ authorizationId, meterId });
if (signed) await virio.billing.settleStatement(signed);
```

`signNextStatement` returns `null` when nothing is billable, so a quiet period costs no transaction. Storage sits behind a `UsageStore` interface; the default is in-memory, and production should back it with a real database.
