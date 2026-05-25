"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Coins,
  Lock,
  TrendingUp,
  Users,
  Flame,
  Shield,
  Wallet,
  Percent,
  Calendar,
  Gift,
  Building2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Globe,
  Repeat,
  ArrowLeftRight,
} from "lucide-react";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { cn } from "@/lib/utils";

/* ─────────────────────────  DATA  ───────────────────────── */

interface Bucket {
  label: string;
  pct: number;
  tokens: string;
  vesting: string;
  group: "community" | "insider" | "public";
  blurb: string;
  Icon: React.ElementType;
}

const BUCKETS: Bucket[] = [
  {
    label: "Community Ecosystem",
    pct: 30,
    tokens: "300M",
    vesting: "5-yr programmatic emission",
    group: "community",
    blurb: "Rewards for the people who actually use Virio — merchants, executors, and liquidity providers.",
    Icon: Users,
  },
  {
    label: "Treasury",
    pct: 25,
    tokens: "250M",
    vesting: "Held in a Vultisig with a 48-hour timelock",
    group: "community",
    blurb: "Long-term war chest. Sits in a Vultisig with a 48-hour timelock on every spend.",
    Icon: Building2,
  },
  {
    label: "Airdrop",
    pct: 10,
    tokens: "100M",
    vesting: "1% per month for 10 months",
    group: "community",
    blurb: "Free tokens for early users. Streamed slowly so sellers don't tank the price on day one.",
    Icon: Gift,
  },
  {
    label: "Team & Future Hires",
    pct: 8,
    tokens: "80M",
    vesting: "12-mo cliff, 36-mo linear",
    group: "insider",
    blurb: "The people building Virio. Locked for a year, then drips out monthly over 3 years.",
    Icon: Users,
  },
  {
    label: "Creator",
    pct: 5,
    tokens: "50M",
    vesting: "6-mo cliff, 24-mo linear",
    group: "insider",
    blurb: "Allocation to the original creator. Smaller than the team bucket on purpose.",
    Icon: Sparkles,
  },
  {
    label: "Investor Reserve",
    pct: 5,
    tokens: "50M",
    vesting: "12-mo cliff, 24-mo linear",
    group: "insider",
    blurb: "Optional bucket for strategic partners. Anything unsold goes back to the community at month 24.",
    Icon: Wallet,
  },
  {
    label: "Insurance / Safety Module",
    pct: 5,
    tokens: "50M",
    vesting: "Held by contract",
    group: "community",
    blurb: "An on-chain rainy-day fund. Backstops the protocol if anything goes wrong.",
    Icon: Shield,
  },
  {
    label: "LP (burned on deposit)",
    pct: 5,
    tokens: "50M",
    vesting: "LP tokens burnt the moment they're minted",
    group: "community",
    blurb: "Every LP token minted from this bucket is sent straight to a dead address on deposit. Anyone can add liquidity later — but nobody can ever remove it.",
    Icon: Flame,
  },
  {
    label: "Public Sale",
    pct: 5,
    tokens: "50M",
    vesting: "25% at TGE, 9-mo linear",
    group: "public",
    blurb: "Open public sale on Virio. No allowlists, no VC sweetheart pricing, no private rounds — same terms for everyone.",
    Icon: Coins,
  },
  {
    label: "Advisors",
    pct: 2,
    tokens: "20M",
    vesting: "6-mo cliff, 24-mo linear",
    group: "insider",
    blurb: "Small bucket for advisors who help us ship.",
    Icon: Users,
  },
];

const GROUP_META: Record<Bucket["group"], { label: string; color: string; chip: string }> = {
  community: {
    label: "Community-aligned",
    color: "from-virio-emerald/80 to-virio-emerald",
    chip: "bg-secondary text-foreground",
  },
  insider: {
    label: "Insiders",
    color: "from-muted-foreground/60 to-muted-foreground",
    chip: "bg-secondary text-foreground",
  },
  public: {
    label: "Public sale",
    color: "from-emerald-500 to-emerald-400",
    chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
};

const EMISSION = [
  { label: "TGE", pct: 32 },
  { label: "Month 12", pct: 52 },
  { label: "Month 24", pct: 66 },
  { label: "Month 36", pct: 80 },
  { label: "Month 48", pct: 89 },
];

const FEE_DISCOUNTS = [
  { stake: "0",          stakeLabel: "No stake",       bps: 25, flat: "$1.00" },
  { stake: "10k",        stakeLabel: "10,000 VIRIO",   bps: 20, flat: "$1.00" },
  { stake: "50k",        stakeLabel: "50,000 VIRIO",   bps: 16, flat: "$0.50" },
  { stake: "250k",       stakeLabel: "250,000 VIRIO",  bps: 12, flat: "$0.25" },
  { stake: "1M",         stakeLabel: "1,000,000 VIRIO",bps: 10, flat: "$0.10"  },
  { stake: "5M",         stakeLabel: "5,000,000 VIRIO",bps: 5,  flat: "waived" },
];

const REVENUE = [
  { year: "Year 1", scenario: "Base",  active: "50k",  tpv: "$37.5M", rev: "$1.2M",  tone: "muted" as const },
  { year: "Year 1", scenario: "Bull",  active: "200k", tpv: "$150M",  rev: "$4.9M",  tone: "muted" as const },
  { year: "Year 3", scenario: "Base",  active: "1M",   tpv: "$750M",  rev: "$24M",   tone: "brand" as const },
  { year: "Year 3", scenario: "Bull",  active: "5M",   tpv: "$3.75B", rev: "$122M",  tone: "brand" as const },
  { year: "Year 5", scenario: "Bull",  active: "20M",  tpv: "$15B",   rev: "$488M",  tone: "emerald" as const },
];

const HOLDER_YIELD = [
  { label: "Y1 Base",  rev: "$1.2M",  yieldVal: "$58"     },
  { label: "Y3 Base",  rev: "$24M",   yieldVal: "$1,152"  },
  { label: "Y3 Bull",  rev: "$122M",  yieldVal: "$5,856"  },
  { label: "Y5 Bull",  rev: "$488M",  yieldVal: "$23,424" },
];

const FDV_TABLE = [
  { yr: "Y1 Base",  rev: "$1.2M",  px20: "$0.024", px40: "$0.048", px80: "$0.096" },
  { yr: "Y3 Base",  rev: "$24M",   px20: "$0.48",  px40: "$0.96",  px80: "$1.92"  },
  { yr: "Y3 Bull",  rev: "$122M",  px20: "$2.44",  px40: "$4.88",  px80: "$9.76"  },
  { yr: "Y5 Bull",  rev: "$488M",  px20: "$9.76",  px40: "$19.50", px80: "$39.00" },
];

const RISKS = [
  {
    Icon: Flame,
    title: "LP tokens burn on deposit → no rug surface",
    body: "Every LP token created from the launch bucket is sent to a dead address the moment it's minted. The pool can grow forever, but no one — team included — can ever pull liquidity out.",
  },
  {
    Icon: Lock,
    title: "20% insider footprint, no early unlocks",
    body: "Team + creator + investors + advisors = 20% of supply. Nothing unlocks before month 6.",
  },
  {
    Icon: Shield,
    title: "The treasury sits in a Vultisig",
    body: "A 48-hour timelock sits in front of every spend.",
  },
  {
    Icon: CheckCircle2,
    title: "Audits before launch",
    body: "Code4rena and Once review every contract pre-TGE. Reports published.",
  },
  {
    Icon: Users,
    title: "Sybil filters on the airdrop",
    body: "Per-month claim filters are tunable, so farmers can't drain the community bucket.",
  },
];

/* ─────────────────────────  PRIMITIVES  ───────────────────────── */

function Stat({
  value,
  label,
  sub,
  tone = "default",
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "default" | "brand" | "emerald";
}) {
  const toneCls =
    tone === "brand"
      ? "text-foreground"
      : tone === "emerald"
      ? "text-virio-emerald"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className={cn("font-display text-[26px] font-semibold tracking-tight tabular-nums", toneCls)}>
        {value}
      </div>
      <div className="mt-1 text-[12.5px] font-semibold text-foreground">{label}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Pill({
  children,
  tone = "brand",
}: {
  children: React.ReactNode;
  tone?: "brand" | "electric" | "emerald";
}) {
  const cls =
    tone === "electric"
      ? "bg-secondary text-foreground"
      : tone === "emerald"
      ? "bg-emerald-500/15 text-virio-emerald"
      : "bg-secondary text-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

function PlainEnglish({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-virio-emerald/25 bg-secondary/50 px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <span>
        <span className="font-semibold text-foreground">In plain English: </span>
        {children}
      </span>
    </div>
  );
}

/* ─────────────────────────  HERO  ───────────────────────── */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36 lg:pt-44">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-fade opacity-70" />
        
      </div>

      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <div className="flex justify-center">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium text-muted-foreground backdrop-blur">
            <span className="inline-flex items-center gap-1 rounded-full bg-virio-emerald px-2 py-0.5 text-[11px] font-semibold text-virio-emerald-ink">
              <Coins className="h-3 w-3" />
              Tokenomics
            </span>
            One billion $VIRIO · fixed supply · zero inflation
          </span>
        </div>

        <h1 className="mx-auto mt-7 max-w-[920px] animate-fade-up text-balance text-center font-display text-[clamp(2.5rem,6vw,4.5rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground animation-delay-100">
          The token that <span className="text-virio-emerald">powers Virio</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-[680px] animate-fade-up text-balance text-center text-[16.5px] leading-relaxed text-muted-foreground animation-delay-200">
          $VIRIO is one token across every EVM chain Virio runs on. Stake it on your chain of choice,
          earn real fee-token yield where you staked. No VC round, no inflation, no NFTs, and every LP
          token burns the moment it&apos;s minted.
        </p>

        <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 animation-delay-300 sm:flex-row">
          <Link
            href="#allocation"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-virio-emerald px-7 text-[15px] font-semibold text-virio-emerald-ink transition-all duration-200 ease-out hover:-translate-y-0.5  sm:w-auto"
          >
            <span className="relative z-[2]">See the breakdown</span>
            <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#launch"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--hairline-strong))] sm:w-auto"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-muted-foreground" />
            How to buy
          </Link>
        </div>

        {/* quick stats */}
        <div className="mt-16 grid animate-fade-up grid-cols-2 gap-4 animation-delay-400 sm:grid-cols-4">
          <Stat value="1B" label="Total supply" sub="Fixed forever — no inflation" />
          <Stat value="75%" label="To the community" sub="Ecosystem, treasury, airdrop, LP, insurance" tone="brand" />
          <Stat value="20%" label="Insiders" sub="Team, creator, advisors, investors" />
          <Stat value="5%" label="Public sale" sub="Open to everyone, no allowlist" tone="emerald" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  TL;DR  ───────────────────────── */

function TLDR() {
  const cards = [
    {
      Icon: Repeat,
      title: "Stake 1:1",
      body: "Stake N VIRIO, get N stVIRIO — a regular token. Burn it any time to get your VIRIO back. No NFTs, no lockup, no decay math.",
    },
    {
      Icon: TrendingUp,
      title: "Real fee yield",
      body: "60% of every protocol fee streams to stVIRIO holders in the original fee token (USDC etc.) — not minted, not diluted.",
    },
    {
      Icon: Globe,
      title: "Stake on any chain",
      body: "VIRIO lives on Ethereum, Base, Arbitrum, Optimism, and Polygon at launch. Stake on the chain you're on and earn that chain's fees — no bridging.",
    },
    {
      Icon: Flame,
      title: "Burn-on-deposit LP",
      body: "Every LP token from the launch bucket is sent to a dead address the moment it's minted. Liquidity grows, but never withdraws.",
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="The 30-second version"
          title={<>four things to <span className="text-virio-emerald">remember</span></>}
          description="If you only read one section, read this one."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--hairline-strong))] hover:shadow-lift">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-virio-emerald text-virio-emerald-ink">
                  <c.Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-[15px] font-semibold text-foreground">{c.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  ALLOCATION  ───────────────────────── */

function Allocation() {
  const sorted = React.useMemo(() => [...BUCKETS].sort((a, b) => b.pct - a.pct), []);
  const totals = BUCKETS.reduce(
    (acc, b) => {
      acc[b.group] += b.pct;
      return acc;
    },
    { community: 0, insider: 0, public: 0 } as Record<Bucket["group"], number>,
  );

  return (
    <section id="allocation" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Allocation"
          title={<>where every <span className="text-virio-emerald">$VIRIO</span> goes</>}
          description="One billion tokens, split across ten buckets. The community gets the majority — by design."
        />

        {/* stacked bar */}
        <Reveal>
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-7">
            <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>1,000,000,000 VIRIO</span>
              <span className="tabular-nums">100%</span>
            </div>
            <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full ring-1 ring-border">
              <div
                style={{ width: `${totals.community}%` }}
                className="bg-gradient-to-r from-virio-emerald to-virio-emerald/70"
              />
              <div
                style={{ width: `${totals.insider}%` }}
                className="bg-gradient-to-r from-muted-foreground to-muted-foreground/60"
              />
              <div
                style={{ width: `${totals.public}%` }}
                className="bg-gradient-to-r from-virio-blue to-virio-blue/70"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-foreground" />
                <span className="font-semibold text-foreground">{totals.community}%</span>
                <span className="text-muted-foreground">Community</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                <span className="font-semibold text-foreground">{totals.insider}%</span>
                <span className="text-muted-foreground">Insiders</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground">{totals.public}%</span>
                <span className="text-muted-foreground">Public sale</span>
              </span>
            </div>
          </div>
        </Reveal>

        {/* bucket grid */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {sorted.map((b, i) => {
            const meta = GROUP_META[b.group];
            return (
              <Reveal key={b.label} delay={(i % 2) * 80}>
                <div className="group h-full rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--hairline-strong))] hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary/60 text-foreground">
                        <b.Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div>
                        <div className="font-display text-[15px] font-semibold text-foreground">{b.label}</div>
                        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.chip)}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[22px] font-semibold tabular-nums text-foreground">
                        {b.pct}%
                      </div>
                      <div className="text-[11px] tabular-nums text-muted-foreground">{b.tokens}</div>
                    </div>
                  </div>

                  {/* bar */}
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary/80">
                    <div
                      style={{ width: `${b.pct * 3.33}%` }}
                      className={cn("h-full rounded-full bg-gradient-to-r", meta.color)}
                    />
                  </div>

                  <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{b.blurb}</p>

                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Vesting:</span>
                    {b.vesting}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  MULTICHAIN  ───────────────────────── */

interface ChainInfo {
  name: string;
  role: "Home" | "Native";
  blurb: string;
}

const CHAINS: ChainInfo[] = [
  { name: "Ethereum",  role: "Home",   blurb: "Initial 1B minted here. Governance + vesting + airdrop live here." },
  { name: "Base",      role: "Native", blurb: "Same contract address. Local staking, local fees, local buyback." },
  { name: "Arbitrum",  role: "Native", blurb: "Same contract address. Local staking, local fees, local buyback." },
  { name: "Optimism",  role: "Native", blurb: "Same contract address. Local staking, local fees, local buyback." },
  { name: "Polygon",   role: "Native", blurb: "Same contract address. Local staking, local fees, local buyback." },
];

function MultiChain() {
  return (
    <section id="multichain" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Multichain"
          title={<>one token, <span className="text-virio-emerald">every chain</span></>}
          description="$VIRIO follows the xERC20 standard. There's no 'wrapped' or 'bridged' version — every VIRIO is the canonical VIRIO, just temporarily resident on whichever chain you're on. Bridging burns on the source and mints on the destination, so total supply across every chain is always exactly 1,000,000,000."
        />

        {/* chain strip */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {CHAINS.map((c, i) => (
            <Reveal key={c.name} delay={i * 80}>
              <div className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-virio-emerald text-virio-emerald-ink">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="font-display text-[16px] font-semibold text-foreground">{c.name}</div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider",
                      c.role === "Home"
                        ? "bg-secondary text-foreground"
                        : "bg-emerald-500/15 text-virio-emerald",
                    )}
                  >
                    {c.role}
                  </span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{c.blurb}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* burn-and-mint flow */}
        <Reveal>
          <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                <ArrowLeftRight className="h-3 w-3" />
                Bridging = burn + mint
              </div>
              <h3 className="mt-4 font-display text-[20px] font-semibold text-foreground">
                How VIRIO moves between chains
              </h3>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Source chain
                  </div>
                  <div className="mt-1 font-display text-[15px] font-semibold text-foreground">Burn 1,000 VIRIO</div>
                  <div className="mt-1 text-[12px] text-muted-foreground tabular-nums">total supply −1,000</div>
                </div>
                <div className="hidden items-center justify-center sm:flex">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Destination chain
                  </div>
                  <div className="mt-1 font-display text-[15px] font-semibold text-foreground">Mint 1,000 VIRIO</div>
                  <div className="mt-1 text-[12px] text-muted-foreground tabular-nums">total supply +1,000</div>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-[12px] text-foreground">
                Σ totalSupply across every chain = <span className="text-foreground">1,000,000,000</span>
                <span className="ml-2 text-muted-foreground">(always)</span>
              </div>

              <PlainEnglish>
                You can&apos;t accidentally end up with two different VIRIOs. There&apos;s one token. It
                just moves — like sending USDC between exchanges.
              </PlainEnglish>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                <Wallet className="h-3 w-3" />
                Stake locally
              </div>
              <h3 className="mt-4 font-display text-[20px] font-semibold text-foreground">
                Earn where you stake
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                Each chain has its own self-contained loop: a Virio manager collects fees, a fee
                distributor splits them 60/25/15, and 60% streams to stVIRIO holders on that same chain
                in the same token the fee was paid in.
              </p>
              <ul className="mt-5 space-y-2.5 text-[13px] text-foreground">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  Stake on Base → earn Base&apos;s USDC
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  Stake on Arbitrum → earn Arbitrum&apos;s USDC
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  Split across chains for diversified yield
                </li>
              </ul>
              <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
                Day-one bridge is <strong className="text-foreground">LayerZero V2</strong>. xERC20 lets
                more bridges (Hyperlane, Across, CCIP) be added later under per-bridge rate limits
                — no token migration, no redeploy.
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  EMISSION TIMELINE  ───────────────────────── */

function Emission() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Unlock schedule"
          title={<>how many tokens are actually <span className="text-virio-emerald">in the wild</span></>}
          description="Just because a billion exist doesn't mean a billion are floating around. Here's roughly what's circulating, when."
        />

        <Reveal>
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="relative">
              <div className="absolute left-0 right-0 top-[78px] h-px bg-border" />
              <div className="grid grid-cols-5 gap-4">
                {EMISSION.map((e, i) => (
                  <div key={e.label} className="flex flex-col items-center text-center">
                    <div className="font-display text-[22px] font-semibold tracking-tight tabular-nums text-foreground">
                      {e.pct}%
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">circulating</div>
                    <div className="relative mt-4 grid h-6 w-6 place-items-center">
                      <span className="absolute inset-0 rounded-full bg-secondary" />
                      <span
                        className={cn(
                          "absolute inset-1 rounded-full",
                          i === 0 ? "bg-virio-emerald" : "bg-foreground",
                        )}
                      />
                    </div>
                    <div className="mt-3 text-[12.5px] font-semibold text-foreground">{e.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <PlainEnglish>
              At launch only about a third of the supply exists in the open market — the rest unlocks
              over five years. No insider can sell anything before month 6.
            </PlainEnglish>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  VALUE ACCRUAL (stVIRIO)  ───────────────────────── */

function ValueAccrual() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="How $VIRIO makes money"
          title={<>stake it. <span className="text-virio-emerald">earn real fees</span></>}
          description="Staking is a simple 1:1 swap. Drop in VIRIO, get back stVIRIO — a regular ERC-20 you can hold, trade, or use as collateral. While you hold it, you earn a pro-rata share of every fee Virio collects on that chain."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* stVIRIO explainer */}
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8">
              
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                  <Repeat className="h-3 w-3" />
                  stVIRIO
                </div>
                <h3 className="mt-4 font-display text-[22px] font-semibold text-foreground">The 1:1 stake receipt</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Stake VIRIO → mint stVIRIO 1:1. Burn stVIRIO → redeem VIRIO 1:1. That&apos;s the whole
                  thing. stVIRIO is a transferable ERC-20 with voting power, so you can stack it on top of
                  other DeFi while it earns.
                </p>

                <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-[12.5px] text-foreground">
                  stake(<span className="text-foreground">10,000 VIRIO</span>) → <span className="text-virio-emerald">10,000 stVIRIO</span>
                  <br />
                  unstake(<span className="text-virio-emerald">10,000 stVIRIO</span>) → <span className="text-foreground">10,000 VIRIO</span>
                </div>

                <ul className="mt-5 space-y-3 text-[13.5px] text-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    Pro-rata <strong>fee-token yield</strong> (USDC and any other token Virio collects)
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <strong>Governance votes</strong> via ERC20Votes on stVIRIO
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-virio-emerald">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    Unstake any time (a short cooldown can be added later if needed)
                  </li>
                </ul>

                <PlainEnglish>
                  Think of stVIRIO like an LP token. You drop VIRIO in, get a receipt out. Your receipt
                  earns yield automatically. When you want your VIRIO back, you hand the receipt in.
                </PlainEnglish>
              </div>
            </div>
          </Reveal>

          {/* fee split diagram */}
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">
                <TrendingUp className="h-3 w-3" />
                Fee split
              </div>
              <h3 className="mt-4 font-display text-[22px] font-semibold text-foreground">
                Where every fee ends up
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Every protocol fee is automatically split three ways on-chain.
              </p>

              <div className="mt-5 space-y-3">
                <FeeRow pct={60} label="stVIRIO stakers" sub="paid in the fee token, on the same chain" tone="brand" />
                <FeeRow pct={25} label="Chain-local treasury" sub="held in the fee token" tone="electric" />
                <FeeRow pct={15} label="VIRIO buyback → Safety Module" sub="on-market bid on the local DEX" tone="emerald" />
              </div>

              <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Buyback floor:</strong> 15% of every fee becomes a
                permanent on-market bid for VIRIO on the chain that collected it. At year-3 base revenue
                that&apos;s ~$3.6M/year of automatic buy pressure across chains.
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeeRow({
  pct,
  label,
  sub,
  tone,
}: {
  pct: number;
  label: string;
  sub: string;
  tone: "brand" | "electric" | "emerald";
}) {
  const grad =
    tone === "electric"
      ? "from-muted-foreground/60 to-muted-foreground"
      : tone === "emerald"
      ? "from-emerald-500 to-emerald-400"
      : "from-virio-emerald/80 to-virio-emerald";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <div>
          <span className="font-semibold text-foreground">{label}</span>
          <span className="ml-2 text-muted-foreground">{sub}</span>
        </div>
        <span className="font-display text-[16px] font-semibold tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary/80">
        <div
          style={{ width: `${pct}%` }}
          className={cn("h-full rounded-full bg-gradient-to-r", grad)}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────  MERCHANT DISCOUNTS  ───────────────────────── */

function MerchantDiscounts() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="For merchants"
          title={<>stake $VIRIO, <span className="text-virio-emerald">pay less in fees</span></>}
          description="The more $VIRIO a merchant stakes, the cheaper Virio becomes for them. At 1M staked, the flat fee is waived entirely."
        />

        <Reveal>
          <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="grid grid-cols-3 border-b border-border bg-secondary/40 px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Staked $VIRIO</span>
              <span className="text-center">Protocol fee</span>
              <span className="text-right">Flat fee per charge</span>
            </div>
            {FEE_DISCOUNTS.map((row, i) => {
              const isWaived = row.flat === "waived";
              return (
                <div
                  key={row.stake}
                  className={cn(
                    "grid grid-cols-3 items-center px-5 py-4 text-[14px]",
                    i !== FEE_DISCOUNTS.length - 1 && "border-b border-border",
                    isWaived && "bg-secondary/50",
                  )}
                >
                  <span className="font-semibold text-foreground">{row.stakeLabel}</span>
                  <span className="text-center tabular-nums text-foreground">
                    {(row.bps / 100).toFixed(2)}%
                    <span className="ml-1 text-[11.5px] text-muted-foreground">({row.bps} bps)</span>
                  </span>
                  <span className="text-right">
                    {isWaived ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-virio-emerald">
                        Waived
                      </span>
                    ) : (
                      <span className="tabular-nums font-semibold text-foreground">{row.flat}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Reveal>

        <PlainEnglish>
          A merchant doing $1M/month in volume saves ~$900/month on protocol fees by staking 50k
          $VIRIO — plus a per-charge flat-fee discount, and earns USDC yield on top.
        </PlainEnglish>
      </div>
    </section>
  );
}

/* ─────────────────────────  REVENUE PROJECTIONS  ───────────────────────── */

function Revenue() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="What Virio will earn"
          title={<>the revenue <span className="text-virio-emerald">that gets shared</span></>}
          description="These are the assumptions feeding holder earnings. Average charge $50, 1.5 charges per relationship per month."
        />

        <Reveal>
          <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-5 border-b border-border bg-secondary/40 px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Year</span>
                <span>Scenario</span>
                <span className="text-right">Active users</span>
                <span className="text-right">Total volume</span>
                <span className="text-right">Protocol revenue</span>
              </div>
              {REVENUE.map((r, i) => (
                <div
                  key={`${r.year}-${r.scenario}`}
                  className={cn(
                    "grid grid-cols-5 items-center px-5 py-4 text-[14px]",
                    i !== REVENUE.length - 1 && "border-b border-border",
                    r.tone === "brand" && "bg-secondary/30",
                    r.tone === "emerald" && "bg-emerald-500/[0.05]",
                  )}
                >
                  <span className="font-semibold text-foreground">{r.year}</span>
                  <span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        r.scenario === "Bull"
                          ? "bg-emerald-500/15 text-virio-emerald"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.scenario}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{r.active}</span>
                  <span className="text-right tabular-nums text-foreground">{r.tpv}</span>
                  <span className="text-right font-display text-[16px] font-semibold tabular-nums text-foreground">
                    {r.rev}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  HOLDER EARNINGS  ───────────────────────── */

function HolderEarnings() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1200px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="What you could earn"
          title={<>two ways $VIRIO <span className="text-virio-emerald">pays you</span></>}
          description="Real USDC yield from fees, plus the token's own appreciation as Virio grows. Numbers below are illustrative scenarios — not promises."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* USDC yield */}
          <Reveal className="min-w-0">
            <div className="h-full rounded-2xl border border-border bg-card p-5 sm:p-7">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <h3 className="font-display text-[15px] font-semibold leading-tight text-foreground sm:text-[16px]">
                  USDC yield per 10,000 stVIRIO / year
                </h3>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Assumes 125M stVIRIO outstanding across all chains, 60% of fees → stakers.
              </p>

              <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                {HOLDER_YIELD.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <div className="text-[13.5px] font-semibold text-foreground">{row.label}</div>
                      <div className="text-[11.5px] text-muted-foreground">Protocol rev {row.rev}</div>
                    </div>
                    <div className="font-display text-[20px] font-semibold tabular-nums text-virio-emerald">
                      {row.yieldVal}
                    </div>
                  </div>
                ))}
              </div>

              <PlainEnglish>
                If you held 10,000 stVIRIO through a year-3 base-case scenario, you&apos;d earn ~$1,152
                in USDC — without selling a single token.
              </PlainEnglish>
            </div>
          </Reveal>

          {/* Token price */}
          <Reveal delay={120} className="min-w-0">
            <div className="h-full rounded-2xl border border-border bg-card p-5 sm:p-7">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <h3 className="font-display text-[15px] font-semibold leading-tight text-foreground sm:text-[16px]">
                  Token price at price-to-fees multiples
                </h3>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                FDV ÷ 1B supply. Comparable infra tokens trade at 20–80× P/F.
              </p>

              <div className="mt-5 overflow-x-auto rounded-xl border border-border">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 bg-secondary/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>Scenario</span>
                  <span className="text-right">20×</span>
                  <span className="text-right">40×</span>
                  <span className="text-right">80×</span>
                </div>
                {FDV_TABLE.map((row, i) => (
                  <div
                    key={row.yr}
                    className={cn(
                      "grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-2 px-3 py-3 text-[12.5px] sm:text-[13px]",
                      i !== FDV_TABLE.length - 1 && "border-b border-border",
                    )}
                  >
                    <span className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{row.yr}</div>
                      <div className="truncate text-[11px] text-muted-foreground">rev {row.rev}</div>
                    </span>
                    <span className="text-right tabular-nums text-foreground">{row.px20}</span>
                    <span className="text-right tabular-nums font-semibold text-foreground">{row.px40}</span>
                    <span className="text-right tabular-nums text-foreground">{row.px80}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* worked example */}
        <Reveal>
          <div className="mt-8 overflow-hidden rounded-3xl border border-virio-emerald/25 bg-secondary/40 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="brand">Worked example</Pill>
              <h3 className="font-display text-[18px] font-semibold text-foreground">
                Buy 100k $VIRIO at $0.30 → stake all of it
              </h3>
            </div>
            <p className="mt-2 text-[13.5px] text-muted-foreground">
              $30,000 cost basis. Two illustrative scenarios at a 40× price-to-fees multiple.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Year 3 · Base case
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-[28px] font-semibold tabular-nums text-foreground">$108k</span>
                  <span className="text-[12.5px] font-semibold text-virio-emerald">≈ 3.6×</span>
                </div>
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Token value $96k + ~$12k accumulated USDC yield
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Year 3 · Bull case
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-[28px] font-semibold tabular-nums text-foreground">$549k</span>
                  <span className="text-[12.5px] font-semibold text-virio-emerald">≈ 18×</span>
                </div>
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Token value $488k + ~$61k accumulated USDC yield
                </p>
              </div>
            </div>
            <p className="mt-4 text-[11.5px] text-muted-foreground">
              Illustrative only. Token markets are volatile and these numbers depend on Virio hitting
              its revenue scenarios — they are not promises or guarantees.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  LAUNCH  ───────────────────────── */

function Launch() {
  const items = [
    {
      label: "No VC round",
      body: "Investor reserve (5%) is only drawn for strategic partners. Anything unsold returns to the community at month 24.",
    },
    {
      label: "Public sale",
      body: "50M VIRIO offered openly — no allowlist, no private pricing. 25% unlocks at TGE; the rest streams linearly over 9 months. Expected clear $0.10–$0.30, raising $5–15M.",
    },
    {
      label: "DEX liquidity",
      body: "Uniswap V3 pools on Ethereum, Base, Arbitrum, Optimism, and Polygon at TGE. Every LP token from the launch bucket is burnt the instant it is minted — liquidity grows but can never be removed.",
    },
    {
      label: "Listings",
      body: "Tier-2 CEX at month 1; tier-1 conditional on volume.",
    },
    {
      label: "Launch FDV",
      body: "$50M – $300M. Initial circulating market cap $16M – $96M.",
    },
  ];
  return (
    <section id="launch" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Launch"
          title={<>how $VIRIO goes <span className="text-virio-emerald">live</span></>}
          description="Public sale only. No private rounds, no sweetheart pricing."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {items.map((it, i) => (
            <Reveal key={it.label} delay={(i % 2) * 80}>
              <div className="flex h-full gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-secondary text-foreground">
                  <span className="font-display text-[12px] font-semibold tabular-nums">{i + 1}</span>
                </div>
                <div>
                  <div className="font-display text-[15px] font-semibold text-foreground">{it.label}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{it.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  RISKS  ───────────────────────── */

function Risks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Safeguards"
          title={<>why this is built to <span className="text-virio-emerald">not blow up</span></>}
          description="Every common token launch failure mode has a specific mitigation. Here they are."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {RISKS.map((r, i) => (
            <Reveal key={r.title} delay={(i % 2) * 80}>
              <div className="flex h-full gap-3.5 rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[hsl(var(--hairline-strong))] hover:shadow-lift">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-virio-emerald">
                  <r.Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-[15px] font-semibold text-foreground">{r.title}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{r.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  FAQ  ───────────────────────── */

const FAQ = [
  {
    q: "What is $VIRIO actually for?",
    a: "Two things. First, staking it earns you a share of every fee Virio collects on the same chain, paid in the original fee token (USDC etc.). Second, merchants who stake it pay lower protocol fees.",
  },
  {
    q: "What's stVIRIO and can I sell it?",
    a: "stVIRIO is the receipt token you get when you stake. Stake N VIRIO, mint N stVIRIO — strict 1:1. It's a regular ERC-20, so yes: you can sell it, send it, LP it, or use it as collateral. To get your VIRIO back, you burn the stVIRIO you hold.",
  },
  {
    q: "Is there a lockup?",
    a: "No fixed lockup. Stake and unstake whenever you want. A short cooldown (≤7 days) can be added later if it becomes necessary to prevent flash-yield-sniping, but at launch the cooldown is zero.",
  },
  {
    q: "How does the same token exist on multiple chains?",
    a: "$VIRIO follows the xERC20 (ERC-7281) standard. Bridging is burn-and-mint: when you move VIRIO from Base to Arbitrum, the source contract burns your tokens and the destination contract mints the same amount, gated by a per-bridge rate limit. Total supply across every chain is always exactly 1,000,000,000. Arbitrageurs keep the price aligned across chains, just like USDC.",
  },
  {
    q: "If I stake on Base, do I get fees from Arbitrum too?",
    a: "No — fee distribution is chain-local. Stake on Base, earn from Base fees. Stake on Arbitrum, earn from Arbitrum fees. You can split a position across chains if you want exposure to multiple revenue streams. Bridging VIRIO between chains is free of yield consequence — yield accrues only while you hold stVIRIO on a given chain.",
  },
  {
    q: "Is the supply inflationary?",
    a: "No. The total supply is fixed at 1,000,000,000 VIRIO forever. No new tokens will ever be minted beyond the genesis 1B. The only motion is the existing supply unlocking over time and moving between chains.",
  },
  {
    q: "Can the team rug-pull?",
    a: "No. Every LP token from the launch liquidity bucket is burnt on deposit — the moment liquidity is added, the LP token goes to a dead address, so nobody can ever withdraw it. The team allocation is locked for 12 months with a 36-month linear vest after that, and the treasury sits in a Vultisig with a 48-hour timelock on every spend.",
  },
  {
    q: "What's a 'real yield' token?",
    a: "It means yield is paid in actual revenue (USDC and other fee tokens), not by minting more of the same token. Inflationary 'yield' just dilutes you. Real yield is genuine cash flow.",
  },
  {
    q: "Where can I buy it?",
    a: "At launch via the open public sale (no allowlist, same price for everyone), then on Uniswap V3 pools on Ethereum, Base, Arbitrum, Optimism, and Polygon. A tier-2 CEX listing follows at month 1.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card transition-colors hover:border-[hsl(var(--hairline-strong))]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-display text-[14.5px] font-semibold text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-muted-foreground",
          )}
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
          {a}
        </div>
      )}
    </div>
  );
}

function Faq() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[900px] px-6 sm:px-8">
        <SectionHeading
          eyebrow="Frequently asked"
          title={<>still <span className="text-virio-emerald">have questions?</span></>}
        />
        <div className="mt-12 space-y-3">
          {FAQ.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  CTA  ───────────────────────── */

function CtaFooter() {
  return (
    <section className="pb-24 pt-10">
      <div className="mx-auto max-w-[1100px] px-6 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center sm:p-12">
            
            <div className="relative">
              <h2 className="mx-auto max-w-[640px] text-balance font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.04em] text-foreground">
                be there at <span className="text-virio-emerald">launch</span>
              </h2>
              <p className="mx-auto mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-muted-foreground">
                Watch the docs for the sale date. No allowlist, no private rounds — anyone can
                participate when the public sale opens.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/docs"
                  className="group inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-virio-emerald px-7 text-[15px] font-semibold text-virio-emerald-ink transition-all duration-200 ease-out hover:-translate-y-0.5 "
                >
                  <span className="relative z-[2]">Read the docs</span>
                  <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-[hsl(var(--hairline-strong))]"
                >
                  Open the app
                </Link>
              </div>
              <p className="mt-6 inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Not financial advice. Read the full risks before participating.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ─────────────────────────  ROOT  ───────────────────────── */

export function VirioTokenView() {
  return (
    <>
      <Hero />
      <TLDR />
      <Allocation />
      <Emission />
      <MultiChain />
      <ValueAccrual />
      <MerchantDiscounts />
      <Revenue />
      <HolderEarnings />
      <Launch />
      <Risks />
      <Faq />
      <CtaFooter />
    </>
  );
}
