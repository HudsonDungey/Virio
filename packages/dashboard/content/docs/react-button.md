---
title: Drop-in Button
description: Add crypto subscriptions to any React app with one component — WalletConnect, plan lookup, approvals and signing handled for you.
section: Build
order: 3
---

`@virio/sdk/react` is a WalletConnect-powered React component that turns a plan id into a working subscription checkout. It feels like Stripe Checkout: the customer clicks a button, connects a wallet, and the subscription becomes active — no wallet config, no wagmi, no transaction handling on your side.

## Installation

```bash
npm install @virio/sdk
```

`react` and `react-dom` are peer dependencies (React 18+). WalletConnect and QR generation come bundled.

## Two steps

Wrap your app once, then drop the button wherever you sell:

```tsx
import { VirioProvider, VirioButton } from "@virio/sdk/react";

export default function App() {
  return (
    <VirioProvider rpcUrl={process.env.NEXT_PUBLIC_RPC_URL!}>
      <VirioButton planId="0x123…" />
    </VirioProvider>
  );
}
```

That is the whole integration. The merchant supplies only an **RPC URL** and a **plan id** — token, amount, recipient, interval and chain all come from the contract, which is the source of truth.

The default label is **Subscribe with Crypto**. Override it with children:

```tsx
<VirioButton planId="0x123…">Get Pro</VirioButton>
```

## What happens on click

```text
Subscribe with Crypto → Connect Wallet → Wallet Connected
→ Preparing Subscription → Signature Request → Subscription Active
```

1. The connect screen offers two paths: **Continue with Wallet** (mobile deep link) and **Connect on another device** (QR code).
2. On connect, the SDK loads the plan, switches the wallet to the right chain if needed, and — because `autoSign` defaults to `true` — immediately requests the required signatures: an ERC-20 approval (only if the current allowance is too low) followed by `subscribe`. No second button.
3. On confirmation the success screen shows and `onSuccess` fires with the subscription id.

## `<VirioProvider>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rpcUrl` | `string` | — | RPC endpoint for the chain the contract lives on. **Required.** |
| `chain` | `string \| number` | `"base"` | Chain name (`"base"`, `"sepolia"`, …) or id. |
| `contractAddress` | `Address` | canonical deployment | VirioSubscriptionManager address. |
| `projectId` | `string` | Virio's shared project | WalletConnect Cloud project id. Set your own for branded session metadata. |
| `appName` | `string` | `"Virio"` | Name shown in the user's wallet during connection. |

## `<VirioButton>` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `planId` | `string` | — | The plan to subscribe to. **Required.** |
| `children` | `ReactNode` | `"Subscribe with Crypto"` | Button label. |
| `className` / `style` | — | — | Override the default styling. |
| `disabled` | `boolean` | `false` | Disable the button. |
| `autoConnect` | `boolean` | `true` | Skip the connect screen when a session is already restored. |
| `autoSign` | `boolean` | `true` | Start signing automatically after connecting. Set `false` to show a summary with a manual confirm button. |
| `onConnect` | `(address: string) => void` | — | Fired when the wallet connects. |
| `onPending` | `(txHash: string) => void` | — | Fired for each transaction as it is broadcast. |
| `onSuccess` | `(subscriptionId: string) => void` | — | Fired when the subscription is active. |
| `onError` | `(error: Error) => void` | — | Fired on connection or signature failure. |

## `useVirio()`

Read connection state or drive connect/disconnect from your own UI:

```tsx
import { useVirio } from "@virio/sdk/react";

const { connected, address, chainId, connect, disconnect } = useVirio();
```

## Sessions, chains and errors

- **Persistence** — WalletConnect sessions are stored and restored automatically, so a returning customer stays connected across refreshes.
- **Wrong chain** — the SDK requests a network switch before signing.
- **Rejections** — a cancelled connection shows *Connection Cancelled*; a cancelled signature shows *Signature Cancelled*; an expired pairing shows *Connection Expired* with a retry.

## Accessibility

The modal is a labelled dialog with focus trapping, `Esc` to close, full keyboard navigation and reduced-motion support.
