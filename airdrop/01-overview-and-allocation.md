# 01 — Overview & Allocation

## The thesis

Most airdrops pay strangers to show up once and leave. Virio's pays the **people who actually
build the network**: merchants and payers who run real subscription/payroll activity, and the
referrers who bring them. Eligibility is **earned and verifiable on-chain**, not claimed by
filling a form.

Two design commitments flow from that:

1. **Product first, token second.** The product is live and a usage season runs *before* TGE.
   We snapshot real behaviour, then make the airdrop claimable at/after TGE. Nobody is rewarded
   for speculation that hasn't happened yet.
2. **Retention is a mechanism, not a hope.** Vesting, claim-and-stake bonuses, use-it-or-lose-it
   tranches, real USDC yield, and sybil filtering are layered so that *holding/using* is the
   higher-EV choice. See [`04-anti-dump-design.md`](./04-anti-dump-design.md).

## Allocation (100,000,000 VIRIO = 10% of supply)

| Bucket | Share | Tokens | Earned by |
|---|---|---|---|
| Real product users | 60% | 60,000,000 | Active subscriptions/payroll, charges actually executed. Retroactive floor for testnet + OG community. |
| Product referrals | 35% | 35,000,000 | Inviting users who themselves become active (qualified usage, not raw signups). |
| Community & social | 5% | 5,000,000 | Quests, content, ambassadors, bug/feedback bounties. |

The weighting is deliberate: **95% of the airdrop is gated on real economic activity** (usage +
referrals that convert to usage). The 5% social slice is small on purpose so the program can't
be gamed by engagement farming.

### Where the bonus pool comes from

The claim-and-stake bonus (System 2) and use-it-or-lose-it recycling (System 3) need a source.
It is **not new supply** — total stays 100M. The bonus pool is funded by:
- the **5% community slice** (or a portion of it), and/or
- **recycled forfeitures** from wallets that miss windows or churn.

This keeps the cap intact and makes the program self-funding over its 10-month life: the more
mercenaries forfeit, the larger the reward for loyal stakers.

## Sequencing & release

```
   pre-TGE                         TGE                 +1mo  +2mo ...        +9mo
 ┌──────────────┐   snapshot(s)  ┌──────────┐
 │ usage season │ ─────────────► │ root₁    │ tranche1  t2    t3   ...        t10
 │ + referrals  │                │ claimable│  10%     +10%  +10%            =100%
 └──────────────┘                └──────────┘
        ▲                              │
        └ retroactive floor for        └ each month a fresh rootₘ gates the next tranche
          testnet/OG/early Discord       on continued eligibility (System 3)
```

- **Per-protocol release:** 1% of *total supply* unlocks each month for 10 months (matches
  `TOKENOMICS.md`).
- **Per-wallet vesting:** each eligible wallet's allocation vests in **10 equal tranches of 10%**.
- Tranche 1 unlocks **at TGE**; tranches 2–10 unlock monthly thereafter.

## What this is NOT

- **Not sale access.** The eligibility allowlist has nothing to do with buying tokens. The
  public sale is open with no allowlist and no private rounds (`TOKENOMICS.md` §7).
- **Not a holder reward.** There are no pre-TGE holders to snapshot. Holders/stakers are paid
  separately and continuously via fee yield — see below.

## Why holders don't need an airdrop

In a product-first launch there is nothing to "reward holders" for at TGE. Holder value is
structural and ongoing, straight from `TOKENOMICS.md`:
- **stVIRIO earns 60% of protocol fees in USDC**, continuously, on the chain the fee was earned.
- **15% of fees fund an on-market buyback** → standing VIRIO bid → Safety Module.
- **Merchant fee discounts** for staked VIRIO create non-speculative demand.

The airdrop's job is **user acquisition**; fee yield's job is **retention**. Keeping them
separate prevents the airdrop from becoming a disguised inflation event.
</content>
