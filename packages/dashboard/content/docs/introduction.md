---
title: Introduction
description: What Virio is, why recurring stablecoin payments matter, and how the protocol fits together.
section: Getting started
order: 1
---

Virio is **wallet-native recurring payments and programmable billing infrastructure for stablecoins**. It turns subscriptions, payroll, and metered billing into a single onchain primitive that any application can integrate.

Everything is **100% onchain, public, and permissionless**. There are no API keys, no accounts, and no hosted services. You integrate with your own RPC endpoint and the `@virio/sdk` framework, signing with your own wallet.

:::diagram architecture
:::

## Why recurring stablecoin payments

Card and bank rails were not designed for internet-native, global, programmable money:

- **Chargebacks and reversals** make settlement probabilistic for up to 180 days.
- **2.9% + 30¢** card fees compound on every recurring charge.
- **Geographic gates** block businesses and customers in much of the world.
- **Opaque payouts** settle on T+2 banking schedules you do not control.

Stablecoins settle in seconds, globally, for fractions of a cent — but they lack the one primitive subscriptions depend on: a way to **pull** a recurring payment with the payer's prior consent. Virio is that primitive.

## Why wallet-native permissions

A customer signs **once** to authorize a plan. From that point, the protocol can pull each scheduled payment within the limits the customer approved — and the customer can revoke at any time, directly from their wallet.

- **Consent is explicit and onchain.** The customer approves a spend allowance (and optionally a per-period or lifetime cap).
- **No custody.** Funds move directly from the customer to the merchant at charge time. Virio never holds balances.
- **Revocable.** Cancelling is a single wallet transaction; no support ticket, no dark patterns.

## Core building blocks

| Concept | What it is |
| --- | --- |
| **Plan** | A merchant's pricing definition: token, gross amount, and period. |
| **Subscription** | A customer's onchain agreement to a plan. Created once, charged on schedule. |
| **Charge** | A permissionless settlement of a due subscription that splits fees onchain. |
| **Executor** | Any wallet (or the bundled scheduler) that calls `charge()` and earns a fee. |
| **Payroll** | Recurring outbound distributions that reuse the same execution model. |

## Payment lifecycle

:::diagram payment-lifecycle
:::

1. A merchant creates a **plan** (`createPlan`).
2. A customer **approves** the token allowance and **subscribes** (`subscribe`).
3. Each period, an **executor** calls `charge()` — funds settle and fees split onchain.
4. The customer or merchant can **cancel** at any time.

## Supported chains

The manager contract deploys to the same address on every chain via CREATE2. The SDK ships with first-class support for:

| Chain | Chain ID | Network |
| --- | --- | --- |
| Ethereum | 1 | Mainnet |
| Base | 8453 | Mainnet |
| Arbitrum One | 42161 | Mainnet |
| Sepolia | 11155111 | Testnet |
| Base Sepolia | 84532 | Testnet |
| Arbitrum Sepolia | 421614 | Testnet |
| Anvil / Hardhat | 31337 | Local |

## Supported stablecoins

Virio is token-agnostic — any standard ERC-20 works. USDC is the default and its canonical address is built into the SDK per chain:

| Chain | USDC address |
| --- | --- |
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Arbitrum | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| Sepolia | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |

:::note
New to Virio? Go straight to the [Quickstart](/docs/quickstart) — you can accept recurring stablecoin subscriptions on testnet in under ten minutes.
:::
