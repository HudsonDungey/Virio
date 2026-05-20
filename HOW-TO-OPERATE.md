# How to operate Virio

> **Just want to run it?** → [`RUN.md`](./RUN.md) has the copy-paste quickstart.
> This file is the deeper reference: what's happening on chain, the API surface, troubleshooting, the file map.

Virio runs in two modes:

- **Sepolia (real wallets, RainbowKit + wagmi)** — the main path. Your MetaMask signs every plan/subscribe/cancel; an Alchemy RPC powers reads; an off-chain executor key calls `charge()` for due subscriptions. → [Sepolia setup](#sepolia-setup) below.
- **Anvil (local testbed, server-signed)** — the older fast-feedback path. A forked local chain with five funded accounts whose keys live in `deployments.json`. → [Anvil testbed](#anvil-testbed).

Pick the mode by setting `network` in `packages/dashboard/virio.local.json` to `"sepolia"` (default) or `"anvil"`.

---

## Sepolia setup

### 1. Get keys

- **Alchemy** API key — create an app on "Ethereum Sepolia" at <https://dashboard.alchemy.com/>.
- **WalletConnect Cloud** project id — <https://cloud.reown.com/>. Required for any non-injected wallet.
- **Etherscan** API key (optional, for `--verify`) — <https://etherscan.io/myapikey>.
- A **Sepolia EOA with some ETH** for deployment (faucet: <https://sepoliafaucet.com/>). This becomes the merchant + fee recipient unless you change it.
- A **second Sepolia EOA** (also funded with a small amount of ETH) to serve as the off-chain executor that calls `manager.charge`.

### 2. Deploy contracts

```bash
cd contracts
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY \
forge script script/DeploySepolia.s.sol \
    --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY \
    --broadcast \
    -vvvv
```

The script prints addresses + the deployment block. Note all four (manager, USDC, feeRecipient, deploymentBlock).

### 3. Configure the dashboard

```bash
cd packages/dashboard
cp virio.local.example.json virio.local.json
cp .env.local.example .env.local
```

Edit `virio.local.json`:

```jsonc
{
  "network": "sepolia",
  "rpc": { "alchemyKey": "from-alchemy-dashboard" },
  "walletConnectProjectId": "from-walletconnect-cloud",
  "contracts": {
    "manager": "0x...",           // from forge script output
    "usdc":    "0x...",
    "feeRecipient": "0x..."
  },
  "deploymentBlock": 1234567,      // from forge script output
  "merchant": {
    "address": "0xYourMetaMaskAddress",
    "label": "My Merchant"
  },
  "testAddresses": []              // optional extras you want listed in /api/accounts
}
```

Edit `.env.local` (preferred over JSON for secrets):

```bash
NEXT_PUBLIC_ALCHEMY_KEY=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
EXECUTOR_PRIVATE_KEY=0x...        # the SECOND Sepolia EOA, NOT your merchant key
```

### 4. Run the dashboard

```bash
yarn workspace @virio/dashboard dev -p 3001
```

Open <http://localhost:3001>. Click **Connect Wallet** in the sidebar — MetaMask will prompt for connection and ask you to switch to Sepolia.

### 5. Use it

- **Create a plan** → triggers `manager.createPlan` signed by your MetaMask. Off-chain name/description gets POSTed to `/api/plans` keyed by the on-chain planId.
- **Subscribe** → triggers a one-time `usdc.approve(manager, max)` (if no allowance yet), then `manager.subscribe(planId, spendCap)`. Both signed by the currently-connected wallet (the customer).
- **Cancel** → triggers `manager.cancel(subId)`. Sign from either the customer or merchant wallet.
- **Charges** → the off-chain scheduler ticks every 30 s (or 1 s in test mode) and calls `manager.charge(subId)` from your EXECUTOR_PRIVATE_KEY for any sub where `nextChargeAt <= now`.

### MockUSDC notes for Sepolia

The deploy script uses `MockUSDC`, a mintable test token. Anyone can mint to themselves with:

```bash
USDC=0x...   # from virio.local.json
cast send $USDC "mint(address,uint256)" 0xYourAddress 100000000 \
    --private-key 0xYourKey \
    --rpc-url https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
# = mint 100 USDC (100 * 1e6) to 0xYourAddress
```

If you'd rather use Circle's official Sepolia USDC (`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`), edit `DeploySepolia.s.sol` to skip the MockUSDC deployment and reference that address in `virio.local.json` — you'll need to bridge in real testnet USDC from <https://faucet.circle.com/>.

---

## Anvil testbed

End-to-end guide for spinning up a local anvil chain, deploying the
`VirioSubscriptionManager` + `MockUSDC` contracts, and driving them through
the Next.js dashboard.

> **Heads up — wagmi rewire.** All writes (createPlan, subscribe, cancel, deactivate) are now signed by the **connected wallet via RainbowKit**, regardless of network. To use the funded anvil accounts in this mode, **import the anvil private keys into MetaMask** and add a custom network for `http://127.0.0.1:8545` (chain id `31337`). The "funded accounts dropdown" in the subscribe dialog has been replaced by "your connected wallet".
>
> To switch to this mode, set `"network": "anvil"` in `packages/dashboard/virio.local.json`. The dashboard reads contract addresses from `virio.local.json` regardless of network — paste the addresses the local deploy script prints under `contracts.manager` / `contracts.usdc`.
>
> The off-chain scheduler also no longer uses `anvil[0]` implicitly — set `EXECUTOR_PRIVATE_KEY` in `.env.local` to one of the anvil keys (e.g. `0xac0974…`) to enable automatic charging.

---

## What you get

- **Anvil** running on `127.0.0.1:8545`, chain id `31337`
- **MockUSDC** at `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **VirioSubscriptionManager** at `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- 5 funded accounts, each with 10 ETH and 10,000 USDC, pre-approved to the manager
- The dashboard at `http://localhost:3001` reads from and writes to the chain — no mock state

(Addresses are deterministic CREATE addresses from `anvil[0]` at nonces 0–1, so they're the same every time you redeploy on a fresh anvil.)

---

## Prerequisites

- macOS or Linux
- `foundry` toolchain (`forge`, `anvil`, `cast`) — installed at `~/.foundry/bin/`
- `node` ≥ 20
- `yarn` 4.x (the repo uses workspaces)

Quick check:
```bash
which forge anvil cast node yarn
```

---

## One-time install

From the repo root:

```bash
yarn install
forge install foundry-rs/forge-std --no-commit --no-git   # only if lib/forge-std is missing
```

---

## Start everything (3 terminals)

### Terminal A — local chain

```bash
anvil --host 127.0.0.1 --port 8545 --chain-id 31337
```

Leave it running. You'll see incoming JSON-RPC calls scroll by once the dashboard is up.

### Terminal B — deploy contracts

```bash
cd contracts
forge script script/Deploy.s.sol \
    --rpc-url http://127.0.0.1:8545 \
    --broadcast \
    --skip-simulation
```

This deploys MockUSDC and VirioSubscriptionManager, mints 10,000 USDC to each of 5 anvil accounts, and approves the manager for all of them. You should see:

```
MockUSDC                  : 0x5FbDB2315678afecb367f032d93F642f64180aa3
VirioSubscriptionManager  : 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Deployer (anvil[0])       : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
```

> The dashboard reads addresses from `packages/dashboard/lib/deployments.json`. That file is already checked in with the deterministic addresses, so you don't normally need to edit it. If anvil mining state changes or you change the deploy script, regenerate it manually with the addresses the script printed.

### Terminal C — dashboard

```bash
yarn workspace @virio/dashboard dev -p 3001
```

Open **<http://localhost:3001>**.

---

## Using the dashboard

The dashboard has four pages (sidebar on the left):

### 1. Dashboard
Live stats — `totalRevenue`, `totalFees`, `totalCharges`, `activeSubs`, `activePlans`, plus the 8 most recent transactions. All computed from on-chain `ChargeExecuted` events.

An **Income** chart sits between the stat cards and the transactions table. Use the `1D / 1W / 1M / 1Y` toggle to flip the bucketing:

| Range | Buckets | Bucket size |
|---|---|---|
| 1D | 24 | 1 hour |
| 1W | 7  | 1 day  |
| 1M | 30 | 1 day  |
| 1Y | 12 | 30 days |

Income is **merchant net** (gross minus protocol + executor fees), computed by replaying `ChargeExecuted` events bucketed by each event's block timestamp. Hover the chart for the per-bucket total + charge count. Data refreshes every 5 s. Backed by `GET /api/income-series?range=1d|1w|1m|1y`.

### 2. Products (plans)
- **Create plan**: name, description, price (in USDC), billing interval, protocol fee (bps).
    - "Test interval" intervals (under 5 minutes) are the fast-feedback path — pick "Every 30 seconds" to see charges land immediately.
    - This calls `manager.createPlan(USDC, amount, period, feeBps)` from the deployer (anvil[0]).
- **Deactivate plan**: calls `manager.deactivatePlan(planId)`. **One-way on chain** — to bring a plan back you create a fresh one.

### 3. Subscriptions
- **Subscribe**: pick a customer from the funded-accounts dropdown, pick a plan, set an optional spend cap.
    - Server-side, the API signs the `manager.subscribe(planId, totalSpendCap)` call from that customer's private key (loaded from `deployments.json`).
- **Cancel**: calls `manager.cancel(subId)` from whichever side has a key (customer first, then merchant).

### 4. Transactions
Every successful `ChargeExecuted` event from the manager. Filter by plan, customer substring, or status.

### Test-mode toggle
Top-left sidebar. Test mode makes the offchain scheduler tick every second (vs every 30 s in production mode) — handy when you want to see a 30-second plan rapid-fire 5 charges in a row.

---

## What's actually happening

1. **Plan create** → `manager.createPlan` from anvil[0]. PlanId is `keccak256(merchant, nonce, chainid)` — deterministic and chain-scoped (no cross-chain replays).
2. **Subscribe** → `manager.subscribe(planId, totalSpendCap)` from the customer. The subscription denormalizes plan params at this moment so future plan changes don't retroactively affect existing subscribers.
3. **Charge** → the dashboard's offchain scheduler ticks every 1 s / 30 s, asks the chain for all due subscriptions (`nextChargeAt <= now`), and calls `manager.charge(subId)` from anvil[0]. The contract:
    - Updates `nextChargeAt += period` (additive — no drift),
    - Adds to `totalSpent`, auto-cancels if cap exceeded,
    - Pulls `gross` from customer via `transferFrom`,
    - Splits to merchant / executor / feeRecipient in one tx,
    - Emits `ChargeExecuted`.
4. **Dashboard reads** → `viem.getLogs` from block 0 → head on every page load. Events are cached in-process; cache resets if anvil restarts.

The dashboard never custodies funds — every cent moves directly between EOAs onchain.

---

## Useful `cast` commands

### Read balances
```bash
USDC=0x5FbDB2315678afecb367f032d93F642f64180aa3
USER1=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

cast call $USDC "balanceOf(address)(uint256)" $USER1 --rpc-url http://127.0.0.1:8545
cast balance $USER1 --rpc-url http://127.0.0.1:8545
```

### Charge manually as a third-party executor
The dashboard's scheduler runs as anvil[0]; you can also charge as anvil[5] to act as an independent permissionless executor (and earn the 10 bps executor fee).

```bash
MGR=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
EXEC_PK=0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba
SUB=0x...   # subscriptionId from the dashboard

cast send $MGR "charge(bytes32)" $SUB --private-key $EXEC_PK --rpc-url http://127.0.0.1:8545
```

### Read a subscription's current state
```bash
cast call $MGR "getSubscription(bytes32)(address,address,address,uint256,uint256,uint256,uint256,uint256,uint16,bool)" \
    $SUB --rpc-url http://127.0.0.1:8545
```

### Inspect events
```bash
# All ChargeExecuted events on the manager
cast logs --address $MGR \
    "ChargeExecuted(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)" \
    --from-block 0 --rpc-url http://127.0.0.1:8545
```

### Time-travel
```bash
# Mine N blocks (advances block.timestamp too)
cast rpc evm_mine --rpc-url http://127.0.0.1:8545

# Jump the chain forward 1 hour
cast rpc evm_increaseTime 3600 --rpc-url http://127.0.0.1:8545
cast rpc evm_mine --rpc-url http://127.0.0.1:8545
```

### Mint more test USDC
```bash
cast send $USDC "mint(address,uint256)" $USER1 100000000 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --rpc-url http://127.0.0.1:8545
# = mint 100 USDC (100 * 1e6)
```

---

## Funded test accounts

All have **10,000 USDC** and **10,000 ETH** post-deploy. Private keys are the standard anvil keys (well known, **never** use on mainnet).

| Role | Address | Private key |
|---|---|---|
| Deployer / Merchant | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| User 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| User 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| User 3 | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| User 4 | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |

(Available via `GET /api/accounts` with current balances.)

---

## API endpoints

All routes live under `http://localhost:3001/api/`.

| Method | Path | Body | What it does |
|---|---|---|---|
| GET | `/accounts` | — | List funded accounts with ETH+USDC balances (no private keys) |
| GET | `/plans` | — | List plans from on-chain `PlanCreated` events |
| POST | `/plans` | `{ name, description, price, intervalLabel, intervalSeconds, feeBps, cancelAfterCharges? }` | `manager.createPlan` from deployer |
| POST | `/plans/{id}/deactivate` | — | `manager.deactivatePlan(planId)` from deployer |
| POST | `/plans/{id}/activate` | — | Returns 400 — plans can't be reactivated on chain |
| GET | `/subscriptions` | — | List subscriptions joined with charge counts |
| POST | `/subscriptions` | `{ planId, customer, spendCap? }` | `manager.subscribe(planId, totalSpendCap)` from `customer` |
| POST | `/subscriptions/{id}/cancel` | — | `manager.cancel(subId)` from whoever has the key |
| GET | `/transactions?planId&customer&status` | — | List `ChargeExecuted` events |
| GET | `/stats` | — | Aggregate revenue / fees / counts |
| GET | `/income-series?range=1d\|1w\|1m\|1y` | — | Time-bucketed merchant-net income series for the chart |
| POST | `/charge/{id}` | — | Force-execute one charge as anvil[0] (returns `TooEarlyToCharge` if not due) |
| GET | `/config` | — | Test-mode flag and interval definitions |
| POST | `/config` | `{ testMode: bool }` | Toggle scheduler speed |

---

## Troubleshooting

**Dashboard shows "fetch failed" errors and 500 responses.**
Anvil isn't running. Start it from terminal A.

**`anvil` started but the dashboard says contracts aren't there.**
You restarted anvil after deploy — the new chain is empty. Re-run the deploy script.

**Plans/subscriptions disappear after I restart anvil.**
Expected. The chain reset; events are gone. The dashboard's in-process cache also resets the moment it sees `eth_blockNumber` go backwards. Just re-create what you need.

**Charge fails with `TooEarlyToCharge`.**
Period hasn't elapsed yet. Either wait, or fast-forward time with `cast rpc evm_increaseTime <seconds>` followed by `cast rpc evm_mine`.

**"Already subscribed" when re-creating a subscription.**
Subscription IDs are deterministic: `keccak256(planId, customer)`. Cancel the existing sub first, or use a different account.

**Dashboard says `customer must be one of the funded anvil accounts`.**
The API only signs from accounts whose private keys are in `deployments.json`. Use the dropdown.

**Plan creation reverts on chain.**
Check `price > 0`, `intervalSeconds > 0`, `feeBps ≤ 10000`. The route validates these but only emits a useful error from the chain revert.

**Port 3001 in use.**
Run `yarn workspace @virio/dashboard dev -p 3002` and update your bookmarks.

**Port 8545 in use.**
`lsof -nP -iTCP:8545 -sTCP:LISTEN` to see who's holding it. Stop that process or anvil on another port (and update `deployments.json` + `lib/chain.ts`).

---

## Reset everything

```bash
# Ctrl+C all three terminals, then:
pkill -f anvil       # belt and braces
pkill -f "next dev"  # ditto

# Start fresh:
anvil --host 127.0.0.1 --port 8545 --chain-id 31337 &
(cd contracts && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --skip-simulation)
yarn workspace @virio/dashboard dev -p 3001
```

---

## File map (where to look when something breaks)

```
contracts/
├── src/
│   ├── VirioSubscriptionManager.sol        ← core settlement
│   ├── SubscriptionDelegate7702.sol         ← EIP-7702 delegate target (not wired into the dashboard yet)
│   ├── interfaces/IVirioSubscriptionManager.sol
│   └── test-helpers/MockUSDC.sol
├── script/
│   └── Deploy.s.sol                         ← one-shot local deploy
└── foundry.toml                             ← solc=0.8.24, via_ir=true, fs_permissions=["./"]

packages/dashboard/
├── lib/
│   ├── deployments.json                     ← addresses + funded accounts (read by chain.ts)
│   ├── chain.ts                             ← viem clients, ABIs, USDC unit helpers
│   ├── abis.ts                              ← manager + ERC-20 ABIs
│   ├── chain-reads.ts                       ← event-sourcing for plans/subs/txs, charge helper
│   ├── scheduler.ts                         ← offchain ticker that calls manager.charge for due subs
│   └── store.ts                             ← in-memory offchain metadata (plan name/description/etc.)
├── app/api/
│   ├── accounts/route.ts
│   ├── plans/route.ts                       ← create + list (chain-backed)
│   ├── plans/[id]/{deactivate,activate}/route.ts
│   ├── subscriptions/route.ts               ← subscribe + list (chain-backed)
│   ├── subscriptions/[id]/cancel/route.ts
│   ├── transactions/route.ts                ← ChargeExecuted firehose
│   ├── stats/route.ts                       ← aggregate
│   ├── charge/[id]/route.ts                 ← manual single-charge trigger
│   └── config/route.ts                      ← test-mode toggle
└── virio.config.json                        ← test mode + interval presets + scheduler tick ms
```
