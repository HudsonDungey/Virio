# Pulse — operations

Every command runs from the repo root. Pick a section:

- [Contracts](#contracts) — `forge` deploy / test / cast snippets
- [Web (dashboard)](#web-dashboard) — Next.js dev / config / Sepolia wiring
- [Full local stack](#full-local-stack) — anvil + deploy + dashboard in three terminals
- [Yarn script reference](#yarn-script-reference)

Deep architecture / API / file map: [`HOW-TO-OPERATE.md`](./HOW-TO-OPERATE.md).

---

## One-time install

```bash
yarn install
(cd contracts && forge install foundry-rs/forge-std --no-commit --no-git)   # if lib/forge-std missing
```

Required toolchain: `node` ≥ 20, `yarn` 4.x, `foundry` (`forge`, `anvil`, `cast`).

---

## Contracts

### Build

```bash
yarn compile           # forge build
```

### Test

```bash
yarn test:contracts    # all forge tests, -vv
yarn test:scenarios    # multi-plan / multi-customer / executor-bot scenarios
yarn test:gas          # forge test --gas-report
```

What's covered:

| File | What it tests |
|---|---|
| `contracts/test/PulseSubscriptionManager.t.sol` | Focused unit tests — createPlan validation, subscribe lifecycle, charge happy-path balance deltas + event, period enforcement, cancel by customer / merchant / stranger, deactivation, allowance revocation, spend cap auto-cancel. |
| `contracts/test/Scenarios.t.sol` | End-to-end sweep — 5 plans across 2 merchants, 5 customers subscribing to 2–3 plans each, 2 executor bots alternating charges across time, cancellation flows (customer, merchant, stranger revert), plan deactivation, spend-cap auto-cancel, re-subscribe after self-cancel, late-charge additive period anchoring. Full event capture via `vm.expectEmit`. |

Run a single test with `forge test --match-test <name>`. Use `-vvvv` for execution traces.

### Deploy — local anvil

```bash
yarn anvil            # terminal A: chain on 127.0.0.1:8545
yarn deploy:anvil     # terminal B: MockUSDC + manager + funds 5 anvil accounts
```

The local deploy uses deterministic CREATE addresses, already wired in `packages/dashboard/lib/deployments.json` — no manual config.

### Deploy — Sepolia

First-time setup (once):

```bash
cp contracts/.env.example contracts/.env
# edit contracts/.env — set PRIVATE_KEY (0x-prefixed) and SEPOLIA_RPC_URL (full Alchemy URL)
```

Then:

```bash
yarn deploy:sepolia              # broadcast only
yarn deploy:sepolia:verify       # + Etherscan verification (needs ETHERSCAN_API_KEY in .env)
```

The script prints `manager`, `usdc`, `feeRecipient`, `deploymentBlock` — paste those into `packages/dashboard/pulse.local.json` (see [Web](#web-dashboard) below).

### cast snippets — read & write directly

Set these env vars once per shell:

```bash
# Local
export RPC=http://127.0.0.1:8545
export MGR=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
export USDC=0x5FbDB2315678afecb367f032d93F642f64180aa3
export PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil[0]

# Sepolia (after sourcing contracts/.env)
source contracts/.env
export RPC=$SEPOLIA_RPC_URL
export MGR=0x...   # from pulse.local.json
export USDC=0x...  # from pulse.local.json
export PK=$PRIVATE_KEY
```

**Force-charge a subscription** (executor earns the bot fee):
```bash
SUB=0x...   # subscriptionId
cast send $MGR "charge(bytes32)" $SUB --private-key $PK --rpc-url $RPC
```

**Mint MockUSDC** (Sepolia or anvil — MockUSDC is open-mint):
```bash
cast send $USDC "mint(address,uint256)" 0xYourAddress 100000000 \
  --private-key $PK --rpc-url $RPC
# 100000000 = 100 USDC (6 decimals)
```

**Read USDC balance**:
```bash
cast call $USDC "balanceOf(address)(uint256)" 0xYourAddress --rpc-url $RPC
```

**Inspect ChargeExecuted events**:
```bash
cast logs --address $MGR \
  "ChargeExecuted(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)" \
  --from-block 0 --rpc-url $RPC
```

**Time-travel** (anvil only):
```bash
cast rpc evm_increaseTime 3600 --rpc-url $RPC
cast rpc evm_mine          --rpc-url $RPC
```

---

## Web (dashboard)

### Run

```bash
yarn dev               # next dev on :3001
```

Open <http://localhost:3001/dashboard>. If no wallet is connected, the page blurs and a Connect Wallet dialog renders on top.

### Configuration files

`packages/dashboard/.env.local` — secrets and runtime keys (gitignored):

```bash
NEXT_PUBLIC_ALCHEMY_KEY=             # JUST the key, not the full URL
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
EXECUTOR_PRIVATE_KEY=0x...            # SECOND Sepolia EOA, funded with a little ETH
```

`packages/dashboard/pulse.local.json` — onchain wiring (gitignored):

```jsonc
{
  "network": "sepolia",            // or "anvil"
  "rpc": { "alchemyKey": "...", "fullUrlOverride": null },
  "walletConnectProjectId": "...",
  "contracts": {
    "manager":      "0x...",       // from forge deploy output
    "usdc":         "0x...",
    "feeRecipient": "0x..."
  },
  "deploymentBlock": 10862547,     // Sepolia block of the deploy tx
  "merchant": { "address": "0x...", "label": "My Merchant" }
}
```

Starting fresh:
```bash
cp packages/dashboard/.env.local.example       packages/dashboard/.env.local
cp packages/dashboard/pulse.local.example.json packages/dashboard/pulse.local.json
```

### Typecheck & build

```bash
yarn typecheck         # @pulse/sdk + @pulse/scheduler
yarn build             # compiles workspace packages
```

### Reset dev processes

```bash
yarn reset             # kills anvil + next dev
```

---

## Full local stack

Three terminals, one command each:

```bash
# A — chain
yarn anvil

# B — deploy contracts + fund 5 accounts
yarn deploy:anvil

# C — dashboard
yarn dev
```

Open <http://localhost:3001/dashboard>. Import an anvil private key into MetaMask (any of the 5 well-known keys; the deploy script funds the first 5). Add custom network: RPC `http://127.0.0.1:8545`, chain id `31337`. Done.

---

## Yarn script reference

| Command | Action |

|---|---|
| `yarn anvil` | Local chain on `127.0.0.1:8545`, chain id 31337 |
| `yarn deploy:anvil` | Deploy MockUSDC + manager, fund 5 anvil accounts |
| `yarn deploy:sepolia` | Deploy to Sepolia using `contracts/.env` |
| `yarn deploy:sepolia:verify` | Same + Etherscan verification |
| `yarn compile` | `forge build` |
| `yarn test:contracts` | All forge tests, `-vv` |
| `yarn test:scenarios` | Multi-plan / executor-bot scenario tests |
| `yarn test:gas` | `forge test --gas-report` |
| `yarn dev` | Dashboard on <http://localhost:3001> |
| `yarn reset` | Kill anvil + next dev |
| `yarn typecheck` | TS check across workspaces |
| `yarn test:e2e` | Scheduler e2e test |
| `yarn build` | Build sdk + scheduler |
