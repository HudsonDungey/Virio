# Virio examples

Three reference integrations, one per billing model. Each is a runnable script,
not a snippet — they create real plans and meters and settle real transactions
against a testnet deployment.

```
01-saas-subscription.ts   $20 USDC/month                       recurring
02-ai-api-metered.ts      $0.002/request, $100/mo, daily        metered
03-ai-saas-hybrid.ts      $20/mo + $0.001/req over 10,000       hybrid
```

## Setup

Deploy the billing stack to Base Sepolia and export what it prints:

```bash
yarn deploy:billing:base-sepolia
```

```bash
export VIRIO_RPC_URL="https://sepolia.base.org"
export VIRIO_AUTHORIZATION_REGISTRY=0x...
export VIRIO_RECURRING_BILLING=0x...
export VIRIO_METERED_BILLING=0x...

# Two funded Base Sepolia keys. The merchant publishes prices and signs usage
# statements; the payer authorizes spending and gets charged.
export MERCHANT_PRIVATE_KEY=0x...
export PAYER_PRIVATE_KEY=0x...
```

Then:

```bash
yarn build                                     # build the SDK first
node --import tsx examples/01-saas-subscription.ts
```

## What these show

Each example runs the full loop — publish, authorize, charge, then read the
result back from chain — so you can see where money moves and where it does
not. They print the authorization's remaining budget at each step, because
that is the number a customer cares about and the one the protocol enforces.

**These run against testnet and spend testnet USDC.** Read each script before
running it; none of them asks for confirmation.
