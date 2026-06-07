---
title: Smart Contracts
description: The onchain surface — VirioSubscriptionManager, VirioPayrollManager, and the EIP-7702 delegate.
section: Protocol
order: 1
---

The protocol is deliberately minimal: settlement is a pure function of onchain state, which is what makes executors interchangeable and the system non-custodial. All contracts are written in Solidity `^0.8.24`.

## Deployed addresses

| Contract | Chain | Address |
| --- | --- | --- |
| VirioSubscriptionManager | Sepolia | `0xe1d71fefaa333b354819877c284976e4fad4d911` |
| VirioPayrollManager | Sepolia | `0x5256ddc57163596882e03ce054ce4ddadc5f04eb` |
| Test USDC (MockUSDC) | Sepolia | `0x9564d59ba3be46c3f2565ca0c9bf09df131cb604` |

The managers deploy to the same address on every chain via CREATE2.

## VirioSubscriptionManager

A pull-based ERC-20 subscription protocol. Merchants create plans, customers subscribe, and any address can charge a due subscription and earn the executor fee.

### Design invariants

- `charge()` is **permissionless** and follows Checks-Effects-Interactions with a `nonReentrant` guard.
- Subscriptions are **denormalized** at subscribe time — they keep working if the plan changes.
- `nextChargeAt += period` (additive, drift-free).
- Spend-cap breach **auto-cancels** rather than reverting.
- Settlement is a direct `transferFrom` with **no custody**.

### Functions

#### `createPlan(address token, uint256 amount, uint256 period) → bytes32 planId`

Creates a plan; `msg.sender` becomes the merchant.

- **Reverts:** `ZeroAddress` (token), `InvalidAmount` (amount 0), `InvalidPeriod` (period 0).
- **Emits:** `PlanCreated`.

#### `subscribe(bytes32 planId, uint256 totalSpendCap) → bytes32 subscriptionId`

Subscribes `msg.sender`. `totalSpendCap` of `0` means unlimited.

- **Reverts:** `PlanNotActive`, `AlreadySubscribed`.
- **Emits:** `Subscribed`.

#### `charge(bytes32 subscriptionId)`

Permissionless. Charges a due subscription, splitting the gross amount between merchant, executor (`msg.sender`), and protocol.

- **Reverts:** `NotSubscribed`, `TooEarlyToCharge`, `InvalidAmount` (amount below total fees), or `"transferFrom failed"`.
- **Emits:** `ChargeExecuted` — or `Cancelled` if the spend cap is exceeded.
- **Gas:** one storage write plus up to three ERC-20 transfers.

#### `cancel(bytes32 subscriptionId)`

Cancels a subscription. Callable by the customer **or** merchant. Emits `Cancelled`.

#### `deactivatePlan(bytes32 planId)`

Merchant-only. Marks a plan inactive (existing subscriptions continue). Emits `PlanDeactivated`.

#### Views

`getPlan(planId) → Plan`, `getSubscription(subscriptionId) → Subscription`, `computeSubId(planId, customer) → bytes32`, plus public fee getters `executorFeeBps`, `protocolFeeBps`, `protocolFlatFee`, `feeRecipient`.

#### Owner functions

`setFeeRecipient`, `transferOwnership`, `setExecutorFeeBps`, `setProtocolFeeBps`, `setProtocolFlatFee` (all `onlyOwner`; bps capped at 10000).

### Events

```solidity
event PlanCreated(bytes32 indexed planId, address indexed merchant, address token, uint256 amount, uint256 period);
event Subscribed(bytes32 indexed subscriptionId, bytes32 indexed planId, address indexed customer, uint256 totalSpendCap);
event ChargeExecuted(bytes32 indexed subscriptionId, address indexed executor, address indexed customer, uint256 gross, uint256 merchantAmount, uint256 executorFee, uint256 protocolFee, uint256 nextChargeAt);
event Cancelled(bytes32 indexed subscriptionId, address indexed caller);
event PlanDeactivated(bytes32 indexed planId, address indexed merchant);
```

### Fee math

```solidity
execFee     = amount * executorFeeBps / 10_000;       // 0.1%
protocolFee = amount * protocolFeeBps / 10_000 + protocolFlatFee; // 0.25% + 1 USDC
merchantAmt = amount - execFee - protocolFee;         // reverts if amount < fees
```

### ID derivation

```solidity
planId         = keccak256(abi.encodePacked(merchant, nonce, block.chainid));
subscriptionId = keccak256(abi.encodePacked(planId, customer));
```

### Calling the contract

:::code-group
```solidity tab="Solidity"
IVirioSubscriptionManager mgr = IVirioSubscriptionManager(0xe1d7...);
bytes32 planId = mgr.createPlan(usdc, 49e6, 30 days);
bytes32 subId  = mgr.subscribe(planId, 0);
mgr.charge(subId);
```
```ts tab="viem"
import { createWalletClient, http, parseAbi } from "viem";
const abi = parseAbi([
  "function createPlan(address,uint256,uint256) returns (bytes32)",
  "function subscribe(bytes32,uint256) returns (bytes32)",
  "function charge(bytes32)",
]);
await wallet.writeContract({
  address: "0xe1d71fefaa333b354819877c284976e4fad4d911",
  abi, functionName: "charge", args: [subscriptionId],
});
```
```ts tab="ethers"
import { Contract } from "ethers";
const mgr = new Contract(address, abi, signer);
const tx = await mgr.charge(subscriptionId);
await tx.wait();
```
:::

## VirioPayrollManager

Automated, bot-executable ERC-20 payroll. An employer creates a plan, adds recipients, and pre-approves the contract; keeper bots run payroll each period and earn the executor fee. Same fee model and CEI/reentrancy guarantees as the subscription manager.

### Payroll functions

| Function | Access | Purpose |
| --- | --- | --- |
| `createPlan(token, period) → planId` | any | Caller becomes employer. |
| `addRecipient(planId, wallet, amount, spendCap) → recipientId` | employer | Add one recipient. |
| `updateRecipient(planId, recipientId, newAmount, newSpendCap)` | employer | Effective next cycle. |
| `removeRecipient(planId, recipientId)` | employer | Remove a recipient. |
| `executePayroll(planId, recipientId)` | **permissionless** | Pay one due recipient. |
| `getDueRecipients(planId) → bytes32[]` | view | Recipients currently payable. |
| `getPlanRecipients(planId) → Recipient[]` | view | Full roster. |

## SubscriptionDelegate7702

An [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) delegation target. When an EOA designates this contract as its delegate (a Type 4 transaction), `address(this)` **is** the EOA — the wallet's own code — while all token balances stay with the EOA. This enforces recurring permissions at the wallet itself.

### Why it exists

The default ERC-20 allowance is coarse: it's a single number with no time dimension. The delegate adds a **per-period spend cap** and **instant, epoch-based revocation** that the wallet enforces, independent of any subscription's own cap.

### Delegate functions

#### `initWithSig(DelegateInit init, bytes sig)`

Initializes the delegate from **EIP-712 signed** parameters. The signer must be `address(this)` (the EOA), which prevents front-running.

`DelegateInit` = `{ manager, token, maxPerPeriod, periodDuration, nonce, expiry }`.

- **Reverts:** `AlreadyInitialized`, `Expired`, `NonceUsed`, `ZeroAddress`, `InvalidSignature`.
- **Emits:** `Initialized`.

#### `executeTransfer(address token, address to, uint256 amount)`

Manager-only. Transfers tokens from the EOA to `to`, enforcing the per-period cap.

- **Reverts:** `NotManager`, `WrongToken`, `PeriodCapExceeded`, revocation mismatch.
- **Emits:** `TransferExecuted`. Uses `transfer()` (the EOA is the holder), not `transferFrom`.

#### `revoke()`

Caller must be `address(this)` — the EOA revokes its own delegation. Increments `authEpoch`, invalidating all prior authorizations. Emits `Revoked`.

#### Views

`isInitialized() → bool`, `currentPeriodId() → uint256`, `remainingPeriodAllowance() → uint256`.

### Security model

- **Per-period cap:** `spentInPeriod[periodId] + amount ≤ maxPerPeriod`, where `periodId = block.timestamp / periodDuration`.
- **Revocation:** stored `initEpoch` must equal the current `authEpoch`; bumping the epoch invalidates everything atomically.
- **Token whitelist:** only `config.token` can be moved, only by `config.manager`.

See [Security](/docs/security) for the full threat model and integration checklists.
