---
title: Quickstart
description: Accept recurring stablecoin subscriptions on testnet in under ten minutes.
section: Getting started
order: 2
---

This guide takes you from zero to a charged subscription using the real `@virio/sdk`. Every snippet is copy-paste ready and runs against the Sepolia testnet deployment.

## 1. Install

:::code-group
```bash tab="npm"
npm install @virio/sdk
```
```bash tab="yarn"
yarn add @virio/sdk
```
```bash tab="pnpm"
pnpm add @virio/sdk
```
:::

## 2. Initialize the client

The client is config-driven. Give it a contract address, a chain, your own RPC URL, and a signing key. There are **no API keys** — the private key is a normal wallet key used to sign onchain transactions.

```ts title="virio.ts"
import { Virio } from "@virio/sdk";

export const virio = new Virio({
  // VirioSubscriptionManager on Sepolia
  contractAddress: "0xe1d71fefaa333b354819877c284976e4fad4d911",
  chain: "sepolia",
  rpcUrl: process.env.RPC_URL,        // e.g. an Alchemy or Infura URL
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  // Test USDC on Sepolia (6 decimals)
  usdcAddress: "0x9564d59ba3be46c3f2565ca0c9bf09df131cb604",
});
```

:::note
Use env vars for runtime config in production. `RPC_URL` and `PRIVATE_KEY` can be supplied through `VIRIO_RPC_URL` and `VIRIO_PRIVATE_KEY`.
:::

## 3. Create a plan

A plan defines the token, the **gross amount** per charge (in the token's smallest unit), and the **period** in seconds. Use the `usdc()` and `PERIOD` helpers so you never hand-count decimals.

```ts
import { usdc, PERIOD } from "@virio/sdk";

const { planId, txHash } = await virio.plans.create({
  amount: usdc(49),        // 49 USDC, fee-inclusive
  period: PERIOD.MONTHLY,  // 2_592_000 seconds (30 days)
});

console.log(planId); // 0x… deterministic plan id
```

## 4. Approve and subscribe

The customer approves the manager to spend their USDC, then subscribes. Approve enough to cover the charges you expect — here, twelve months of headroom.

```ts
// 1. Approve the manager to pull USDC (run as the customer's wallet)
await virio.approve(usdc(588)); // 12 × 49 USDC

// 2. Subscribe to the plan
const { subscriptionId } = await virio.subscriptions.subscribe({ planId });
```

A new subscription is **immediately chargeable** — its first `nextChargeAt` is the current block timestamp.

## 5. Execute the first charge

`charge()` is **permissionless**: any wallet may call it, and the caller earns the executor fee. In development you can charge directly.

```ts
const hash = await virio.subscriptions.charge(subscriptionId);

// Read the resulting onchain state
const sub = await virio.subscriptions.get(subscriptionId);
console.log(sub.totalSpent);   // 49000000n
console.log(sub.nextChargeAt); // now + 30 days (unix seconds)
```

On a 49 USDC charge the splits are deterministic and verifiable onchain:

| Component | Formula | Amount |
| --- | --- | --- |
| Executor fee | `amount × 10 / 10000` | 0.049 USDC |
| Protocol fee | `amount × 25 / 10000 + 1 USDC` | 1.1225 USDC |
| Merchant net | remainder | 47.8285 USDC |

## 6. Automate with the scheduler

In production you don't call `charge()` by hand — you run the executor (`@virio/scheduler`), which finds due subscriptions and charges them on a cron. Calling `tick()` repeatedly is safe: the contract enforces timing and reverts `TooEarlyToCharge` rather than double-charging.

```ts title="executor.ts"
import { Scheduler, MemoryStorage } from "@virio/scheduler";
import { virio } from "./virio";

const storage = new MemoryStorage();

await storage.upsertSubscription({
  subscriptionId,
  planId,
  customer: "0xCustomer…",
  merchant: "0xMerchant…",
  token: "0x9564d59ba3be46c3f2565ca0c9bf09df131cb604",
  chainId: 11155111,
  amount: usdc(49).toString(),
  webhookUrl: "https://your-app.com/api/webhooks/virio",
  webhookSecret: process.env.WEBHOOK_SECRET!,
  nextChargeAt: Math.floor(Date.now() / 1000),
  active: true,
});

const scheduler = new Scheduler({
  storage,
  clients: { 11155111: virio }, // one client per chainId
});

setInterval(() => scheduler.tick(), 60_000);
```

:::warning
`MemoryStorage` is for development and tests only — state is lost on restart. In production, implement the `SchedulerStorage` interface against a database so state survives restarts and you can run multiple executor replicas. See [Webhooks & Events](/docs/webhooks).
:::

## 7. Handle webhook events

After each successful charge the scheduler POSTs a signed event to your `webhookUrl`. Verify the `x-virio-signature` header before trusting the payload.

```ts title="app/api/webhooks/virio/route.ts"
import { verifyWebhook } from "@virio/sdk";

export async function POST(req: Request) {
  const payload = await req.text(); // raw body — do not parse first
  const signature = req.headers.get("x-virio-signature") ?? "";

  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  if (event.type === "subscription.charged") {
    // grant access, send a receipt, update your records…
  }
  return new Response("ok");
}
```

## Frontend (React + wagmi)

In the browser, pass the user's connected wallet client instead of a private key. Everything else is identical.

```tsx title="SubscribeButton.tsx"
"use client";
import { Virio, usdc } from "@virio/sdk";
import { useWalletClient } from "wagmi";

export function SubscribeButton({ planId }: { planId: `0x${string}` }) {
  const { data: walletClient } = useWalletClient();

  async function subscribe() {
    if (!walletClient) return;
    const virio = new Virio({
      contractAddress: "0xe1d71fefaa333b354819877c284976e4fad4d911",
      chain: "sepolia",
      walletClient,
    });
    await virio.approve(usdc(588));
    await virio.subscriptions.subscribe({ planId });
  }

  return <button onClick={subscribe}>Subscribe — 49 USDC / mo</button>;
}
```

## From the command line (cast)

Reads and writes are plain contract calls, so [Foundry's](https://book.getfoundry.sh) `cast` works too:

```bash
# Read a subscription's onchain state
cast call 0xe1d71fefaa333b354819877c284976e4fad4d911 \
  "getSubscription(bytes32)" $SUBSCRIPTION_ID \
  --rpc-url $RPC_URL

# Charge a due subscription (earns the executor fee)
cast send 0xe1d71fefaa333b354819877c284976e4fad4d911 \
  "charge(bytes32)" $SUBSCRIPTION_ID \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Next steps

- Understand the model in [Core Concepts](/docs/concepts).
- Browse every method in the [SDK Reference](/docs/sdk).
- Read the contract surface in [Smart Contracts](/docs/contracts).
- Harden your integration with the [Security](/docs/security) checklists.
