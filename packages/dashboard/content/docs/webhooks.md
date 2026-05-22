---
title: Webhooks & Events
description: React to settlement in real time — onchain events plus optional self-hosted signed webhooks.
section: Build
order: 3
---

Virio gives you two ways to react to activity. Both are under your control; neither requires registering with Virio or holding a Virio-issued credential.

1. **Onchain events** — the source of truth, read directly from the chain.
2. **Self-hosted webhooks** — the executor you run POSTs signed events to your own backend.

## Onchain events (source of truth)

Every state change emits an event. Read them with the SDK — either live with `watch()` or historically with the list helpers.

```ts
// Live
const unwatch = virio.watch("ChargeExecuted", (logs) => {
  for (const log of logs) grantAccess(log.args.subscriptionId);
});

// Historical
const charges = await virio.getCharges({ customer: "0x…" });
```

| Event | Emitted when |
| --- | --- |
| `PlanCreated` | A merchant creates a plan. |
| `Subscribed` | A customer subscribes to a plan. |
| `ChargeExecuted` | A subscription is successfully charged. |
| `Cancelled` | A subscription is cancelled (by user, merchant, or spend-cap auto-cancel). |
| `PlanDeactivated` | A merchant deactivates a plan. |

Because events are onchain, they are tamper-proof and replayable — you can rebuild your entire billing state from history at any time.

## Self-hosted webhooks

When you run the scheduler, it can POST a signed JSON event to a URL you choose after each successful charge. **You pick the secret**; `signWebhook` / `verifyWebhook` are plain HMAC-SHA256 helpers so your backend can trust deliveries from your own scheduler.

### Event payload

```json
{
  "id": "evt_1717000000000_3",
  "type": "subscription.charged",
  "createdAt": 1717000000,
  "data": {
    "subscriptionId": "0x…",
    "planId": "0x…",
    "customer": "0x…",
    "merchant": "0x…",
    "amount": "47828500",
    "fee": "0",
    "txHash": "0x…",
    "nextChargeAt": 1719592000,
    "chainId": 8453
  }
}
```

Event `type` is one of `subscription.created`, `subscription.charged`, `subscription.cancelled`, or `plan.deactivated`. Amounts are strings in the token's smallest unit to avoid JSON number loss.

### Signature verification

Verify against the **raw** request body, before parsing. `verifyWebhook` uses a constant-time comparison to prevent timing attacks.

```ts title="app/api/webhooks/virio/route.ts"
import { verifyWebhook } from "@virio/sdk";

export async function POST(req: Request) {
  const payload = await req.text();
  const signature = req.headers.get("x-virio-signature") ?? "";

  if (!verifyWebhook(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(payload);
  switch (event.type) {
    case "subscription.charged":
      await grantAccess(event.data.subscriptionId);
      break;
    case "subscription.cancelled":
      await revokeAccess(event.data.subscriptionId);
      break;
  }
  return new Response("ok");
}
```

:::warning
Never compare signatures with `===` or `.includes()` — use `verifyWebhook`, which is constant-time. And always verify against the unparsed body; re-serializing JSON changes the bytes and breaks the signature.
:::

### Replay-attack prevention

Each event carries a unique `id` and a `createdAt` timestamp. To be safe against replays:

- **Deduplicate** on `event.id` — store processed ids and ignore repeats.
- **Reject stale events** whose `createdAt` is older than a few minutes.
- **Make handlers idempotent** — granting access twice should be a no-op.

### Retry recommendations

The default dispatcher treats any non-2xx response as a failure. Because the **charge already succeeded onchain**, a webhook failure must never roll it back. Recommended:

- Return `2xx` quickly; do heavy work asynchronously.
- Implement a redelivery queue with exponential backoff in your own dispatcher.
- Reconcile against onchain `ChargeExecuted` events as the source of truth, so a dropped webhook never causes a permanent gap.

```ts
const scheduler = new Scheduler({
  storage,
  clients,
  dispatch: async (url, payload, signature) => {
    // your queue with retries / backoff
    await enqueueDelivery({ url, payload, signature });
  },
});
```

## Production storage

`MemoryStorage` is for development. In production, implement `SchedulerStorage` against a database so executor state is durable and horizontally scalable:

```ts
interface SchedulerStorage {
  upsertSubscription(sub: StoredSubscription): Promise<void>;
  getDueSubscriptions(nowSeconds: number): Promise<StoredSubscription[]>;
  updateNextChargeAt(subscriptionId: Hex, nextChargeAt: number): Promise<void>;
  deactivate(subscriptionId: Hex): Promise<void>;
}
```

Populate storage by indexing `Subscribed` and `Cancelled` events, then let `tick()` charge due rows.

## Local development

Use `virio.watch()` against a local Anvil node for an instant feedback loop with no public endpoint, or point `webhookUrl` at a tunneling tool to test real HTTP delivery:

```bash
# expose your local handler for the scheduler to POST to
npx untun http://localhost:3000
```
