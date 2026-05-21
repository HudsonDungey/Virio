# 03 — Sybil Resistance

> The biggest dump risk is sybil farmers who only ever intended to sell. **The cheapest
> anti-dump measure is not allocating to mercenaries in the first place** (this is also
> "System 7" in the anti-dump stack — see [`04-anti-dump-design.md`](./04-anti-dump-design.md)).

All filtering is **off-chain and transparent**: the chain only ever sees the final merkle root,
but the methodology and the filtered eligibility list are published for anyone to audit. Rules
are frozen and published *before* the season and tunable month-to-month (`TOKENOMICS.md` §8).

## Defense layers (cheapest → most involved)

### 1. Minimum real-usage floor
A wallet earns nothing until it crosses a usage floor (≥1 executed charge of ≥ $X, ≥1 active
relationship). Because real charges cost real money (the protocol takes 0.25% + $1/charge),
faking usage at scale is **self-taxing** — the sybil pays Virio fees to farm Virio.

### 2. Funding-graph / clustering analysis
Detect one actor running many wallets:
- **Common funder:** wallets funded from the same CEX-withdrawal address or hot wallet.
- **Fan-out/fan-in:** a tree of wallets funded by one source, or sweeping back to one sink.
- **Behavioural fingerprint:** identical timing, identical charge amounts, same merchant on both
  sides of a subscription (self-dealing).
- **Address-graph clustering** over the funding + interaction graph; clusters above a size/score
  threshold are collapsed to a single effective identity (allocation shared, not multiplied).

### 3. Referral-quality gating
- Referrer credited **only** when the referee crosses the activation floor (doc 02).
- **Self-referral / circular-referral** detection (A→B→A, or referees that only ever transact
  with the referrer) → zeroed.
- Referee must reach activity **independently** of the referrer's own funds where detectable.

### 4. Caps
- **Per-wallet cap** on total allocation.
- **Per-referrer cap** on the referral bucket (doc 02).
Caps bound the damage any single undetected sybil cluster can do.

### 5. Churn clawback
If a referee (or self-farmed wallet) hits the activation threshold and then **immediately churns**
— stops charging right after qualifying — the associated points are clawed back before the next
root. This kills "activate once, then dump" farming.

### 6. Timing heuristics
- Bursts of qualifying activity right before a snapshot, then silence → down-weighted.
- Wallets created en masse in a narrow window with identical funding → flagged for clustering.

## How it plugs into the pipeline

```
ingest events ──► score (doc 02) ──► SYBIL FILTERS (this doc) ──► caps + floor ──► merkle rootₘ
                                          │
                                          └─ outputs: filtered list + reason codes (published)
```

Filters run **before each monthly root**, not just once. A wallet that looks clean at TGE but
behaves like a farmer in month 3 simply doesn't appear in `root₃` — and forfeits the rest of its
allocation (System 3). This makes sybil resistance an ongoing gate, not a one-time check.

## Appeals & transparency

- Each excluded wallet gets a **reason code** (below floor / clustered / churned / capped /
  self-referral).
- A published appeals window before each root lets borderline cases contest with evidence
  (e.g. "shared CEX withdrawal, but independent businesses").
- The scoring + filtering scripts are open-sourced so results are reproducible from public chain
  data + the published referral graph.

## Known limits (be honest about these)

- **Off-chain trust:** users must trust the engine ran the published rules. Mitigation:
  open-source code + reproducible roots + published filtered list.
- **Sophisticated sybils** with funded, behaviourally-diverse wallets can pass. Mitigation: the
  usage floor makes this expensive, and monthly gating means they must keep paying fees to keep
  qualifying — at which point they're real users.
- **False positives** on legitimately related users (e.g. a family or a small office). Mitigation:
  the appeals window and conservative cluster thresholds.

## Pre-season checklist

- [ ] Filter thresholds and cluster parameters frozen and published.
- [ ] Reason-code taxonomy defined.
- [ ] Appeals process + window published.
- [ ] Scoring/filtering code open-sourced and roots reproducible from public data.
- [ ] Dry-run on testnet data to calibrate false-positive rate.
</content>
