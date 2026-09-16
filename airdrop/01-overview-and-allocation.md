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
2. **Meaningful participation is the criterion.** Long-duration streaming and sybil filtering
   reward sustained, verifiable contribution rather than cheaply manufactured activity.

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

This keeps the cap intact and returns unused allocations to future community participation.

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

- **Per-protocol release:** 10M VIRIO may be claimed at genesis; the remaining 90M streams from
  month 3 through month 24.
- **Per-wallet vesting:** claims are participation-based and may be streamed, capped or withheld
  after sybil and quality review.

## What this is NOT

- **Not sale access.** There is no VIRIO public-sale allocation.
- **Not a holder reward.** There are no pre-TGE holders to snapshot.

## Why holders don't need an airdrop

The airdrop's job is community bootstrap. Fee distribution and other staking mechanisms are
separate proposed functionality and are disabled until security review approves them.
</content>
