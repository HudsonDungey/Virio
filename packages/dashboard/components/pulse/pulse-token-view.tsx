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
    blurb: "Rewards for the people who actually use Pulse — merchants, executors, and liquidity providers.",
    Icon: Users,
  },
  {
    label: "Treasury (DAO)",
    pct: 25,
    tokens: "250M",
    vesting: "Multisig at TGE → DAO at month 12",
    group: "community",
    blurb: "Long-term war chest. Starts in a 4-of-7 Safe with a 48-hour timelock, then hands control to token holders.",
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
    blurb: "The people building Pulse. Locked for a year, then drips out monthly over 3 years.",
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
    label: "LP (burned)",
    pct: 5,
    tokens: "50M",
    vesting: "LP tokens sent to 0x…dead",
    group: "community",
    blurb: "Locks the initial Uniswap liquidity forever. Nobody — including the team — can pull the rug.",
    Icon: Flame,
  },
  {
    label: "Public Sale (Fjord LBP)",
    pct: 5,
    tokens: "50M",
    vesting: "25% at launch, 9-mo linear",
    group: "public",
    blurb: "Everyone gets a fair shot to buy on Fjord. No private allocations, no VC sweetheart pricing.",
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
    color: "from-brand-500 to-brand-400",
    chip: "bg-brand-500/15 text-brand-600 dark:text-brand-300",
  },
  insider: {
    label: "Insiders",
    color: "from-electric-500 to-electric-400",
    chip: "bg-electric-500/15 text-electric-600 dark:text-electric-300",
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
  { stake: "0",          stakeLabel: "No stake",      bps: 25, flat: "$1.00" },
  { stake: "10k",        stakeLabel: "10,000 PULSE",   bps: 22, flat: "$1.00" },
  { stake: "50k",        stakeLabel: "50,000 PULSE",   bps: 20, flat: "$0.50" },
  { stake: "250k",       stakeLabel: "250,000 PULSE",  bps: 17, flat: "$0.25" },
  { stake: "1M",         stakeLabel: "1,000,000 PULSE",bps: 13, flat: "waived" },
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
    title: "LP burn → permanent price floor",
    body: "The initial Uniswap liquidity is sent to a dead address. Nobody can drain it. There is no rug surface.",
  },
  {
    Icon: Lock,
    title: "20% insider footprint, no early unlocks",
    body: "Team + creator + investors + advisors = 20% of supply. Nothing unlocks before month 6.",
  },
  {
    Icon: Shield,
    title: "Treasury sits in a 4-of-7 multisig",
    body: "A 48-hour timelock sits in front of every spend until governance fully hands over to the DAO at month 12.",
  },
  {
    Icon: CheckCircle2,
    title: "Two audits before launch",
    body: "Spearbit and Trail of Bits review every contract pre-TGE. Reports published.",
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
      ? "text-brand-600 dark:text-brand-300"
      : tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className={cn("font-display text-[26px] font-extrabold tracking-tight tabular-nums", toneCls)}>
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
      ? "bg-electric-500/15 text-electric-600 dark:text-electric-300"
      : tone === "emerald"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : "bg-brand-500/15 text-brand-600 dark:text-brand-300";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", cls)}>
      {children}
    </span>
  );
}

function PlainEnglish({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-brand-300/40 bg-brand-500/[0.06] px-4 py-3 text-[13.5px] leading-relaxed text-foreground">
      <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
      <span>
        <span className="font-semibold text-brand-600 dark:text-brand-300">In plain English: </span>
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
        <div className="absolute left-1/2 top-[-180px] h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,91,255,0.28),transparent_65%)] blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="flex justify-center">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium text-muted-foreground shadow-soft backdrop-blur">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-semibold text-white">
              <Coins className="h-3 w-3" />
              Tokenomics
            </span>
            One billion $PULSE · fixed supply · zero inflation
          </span>
        </div>

        <h1 className="mx-auto mt-7 max-w-[920px] animate-fade-up text-balance text-center font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-foreground animation-delay-100">
          The token that <span className="text-gradient">powers Pulse</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-[680px] animate-fade-up text-balance text-center text-[16.5px] leading-relaxed text-muted-foreground animation-delay-200">
          $PULSE captures every fee the protocol earns and pays real USDC yield to people who lock it.
          No VC round, no inflation, and the launch liquidity is burned forever. Here&apos;s the whole
          picture — in plain English.
        </p>

        <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 animation-delay-300 sm:flex-row">
          <Link
            href="#allocation"
            className="btn-sheen group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient px-7 text-[15px] font-semibold text-white shadow-brand transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-brand-lg sm:w-auto"
          >
            <span className="relative z-[2]">See the breakdown</span>
            <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="#launch"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-brand-400 sm:w-auto"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand-500" />
            How to buy
          </Link>
        </div>

        {/* quick stats */}
        <div className="mt-16 grid animate-fade-up grid-cols-2 gap-4 animation-delay-400 sm:grid-cols-4">
          <Stat value="1B" label="Total supply" sub="Fixed forever — no inflation" />
          <Stat value="75%" label="To the community" sub="Ecosystem, treasury, airdrop, LP, insurance" tone="brand" />
          <Stat value="20%" label="Insiders" sub="Team, creator, advisors, investors" />
          <Stat value="5%" label="Public sale" sub="Anyone can buy on Fjord" tone="emerald" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  TL;DR  ───────────────────────── */

function TLDR() {
  const cards = [
    {
      Icon: Lock,
      title: "Lock to earn",
      body: "Lock $PULSE for 1 week to 4 years and you get vePULSE. The longer you lock, the more you get.",
    },
    {
      Icon: TrendingUp,
      title: "Real USDC yield",
      body: "60% of every fee Pulse earns goes straight to vePULSE holders as USDC — not more tokens.",
    },
    {
      Icon: Flame,
      title: "Burned liquidity",
      body: "The Uniswap LP token is sent to a dead address at launch. No team can ever pull the rug.",
    },
    {
      Icon: Percent,
      title: "Cheaper for stakers",
      body: "Merchants who stake $PULSE pay lower protocol fees — up to a waived flat fee at 1M staked.",
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="The 30-second version"
          title={<>Four things to <span className="text-gradient">remember</span>.</>}
          description="If you only read one section, read this one."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 80}>
              <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-white shadow-brand">
                  <c.Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-[15px] font-bold text-foreground">{c.title}</h3>
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
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Allocation"
          title={<>Where every <span className="text-gradient">$PULSE</span> goes.</>}
          description="One billion tokens, split across ten buckets. The community gets the majority — by design."
        />

        {/* stacked bar */}
        <Reveal>
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7">
            <div className="flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>1,000,000,000 PULSE</span>
              <span className="tabular-nums">100%</span>
            </div>
            <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full ring-1 ring-border">
              <div
                style={{ width: `${totals.community}%` }}
                className="bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400"
              />
              <div
                style={{ width: `${totals.insider}%` }}
                className="bg-gradient-to-r from-electric-600 via-electric-500 to-electric-400"
              />
              <div
                style={{ width: `${totals.public}%` }}
                className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />
                <span className="font-semibold text-foreground">{totals.community}%</span>
                <span className="text-muted-foreground">Community</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-electric-500" />
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
                <div className="group h-full rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary/60 text-foreground">
                        <b.Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div>
                        <div className="font-display text-[15px] font-bold text-foreground">{b.label}</div>
                        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.chip)}>
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[22px] font-extrabold tabular-nums text-foreground">
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
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
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

/* ─────────────────────────  EMISSION TIMELINE  ───────────────────────── */

function Emission() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Unlock schedule"
          title={<>How many tokens are actually <span className="text-gradient">in the wild</span>.</>}
          description="Just because a billion exist doesn't mean a billion are floating around. Here's roughly what's circulating, when."
        />

        <Reveal>
          <div className="mt-12 rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-8">
            <div className="relative">
              <div className="absolute left-0 right-0 top-[78px] h-px bg-border" />
              <div className="grid grid-cols-5 gap-4">
                {EMISSION.map((e, i) => (
                  <div key={e.label} className="flex flex-col items-center text-center">
                    <div className="font-display text-[22px] font-extrabold tracking-tight tabular-nums text-foreground">
                      {e.pct}%
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">circulating</div>
                    <div className="relative mt-4 grid h-6 w-6 place-items-center">
                      <span className="absolute inset-0 rounded-full bg-brand-500/20" />
                      <span
                        className={cn(
                          "absolute inset-1 rounded-full",
                          i === 0 ? "bg-brand-gradient" : "bg-brand-500",
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

/* ─────────────────────────  VALUE ACCRUAL (vePULSE)  ───────────────────────── */

function ValueAccrual() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="How $PULSE makes money"
          title={<>Lock it. <span className="text-gradient">Earn real USDC.</span></>}
          description="$PULSE captures fees through a ve-model. Lock your tokens for up to four years and a slice of every payment on Pulse comes back to you — in USDC, not inflation."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          {/* vePULSE explainer */}
          <Reveal>
            <div className="ring-gradient relative h-full overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(99,91,255,0.22),transparent_70%)] blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-300">
                  <Lock className="h-3 w-3" />
                  vePULSE
                </div>
                <h3 className="mt-4 font-display text-[22px] font-bold text-foreground">Vote-escrowed PULSE</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  Lock $PULSE anywhere from 1 week to 4 years. The longer your lock, the more vePULSE you
                  get. vePULSE decays linearly over time and is not transferable.
                </p>

                <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-[12.5px] text-foreground">
                  vePULSE = PULSE × <span className="text-brand-600 dark:text-brand-300">(lock_remaining / 4yr)</span>
                </div>

                <ul className="mt-5 space-y-3 text-[13.5px] text-foreground">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    Pro-rata <strong>USDC yield</strong> from every protocol fee
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                    </span>
                    <strong>Governance + gauge votes</strong> on where ecosystem emissions go
                  </li>
                </ul>

                <PlainEnglish>
                  Think of vePULSE like locking a CD at a bank — except instead of earning interest, you
                  earn a share of every fee the protocol collects, paid in stablecoins.
                </PlainEnglish>
              </div>
            </div>
          </Reveal>

          {/* fee split diagram */}
          <Reveal delay={120}>
            <div className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-electric-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-electric-600 dark:text-electric-300">
                <TrendingUp className="h-3 w-3" />
                Fee split
              </div>
              <h3 className="mt-4 font-display text-[22px] font-bold text-foreground">
                Where every fee ends up
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                Every protocol fee is automatically split three ways on-chain.
              </p>

              <div className="mt-5 space-y-3">
                <FeeRow pct={60} label="vePULSE stakers" sub="paid in USDC" tone="brand" />
                <FeeRow pct={25} label="Treasury" sub="paid in USDC" tone="electric" />
                <FeeRow pct={15} label="PULSE buyback → Safety Module" sub="constant on-market bid" tone="emerald" />
              </div>

              <div className="mt-6 rounded-xl border border-border bg-secondary/40 p-4 text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Buyback floor:</strong> 15% of every fee becomes a
                permanent on-market bid for $PULSE. At year-3 base revenue that&apos;s ~$3.6M/year in
                automatic buy pressure.
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
      ? "from-electric-500 to-electric-400"
      : tone === "emerald"
      ? "from-emerald-500 to-emerald-400"
      : "from-brand-500 to-brand-400";
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <div>
          <span className="font-semibold text-foreground">{label}</span>
          <span className="ml-2 text-muted-foreground">{sub}</span>
        </div>
        <span className="font-display text-[16px] font-bold tabular-nums text-foreground">{pct}%</span>
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
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="For merchants"
          title={<>Stake $PULSE, <span className="text-gradient">pay less in fees</span>.</>}
          description="The more $PULSE a merchant stakes, the cheaper Pulse becomes for them. At 1M staked, the flat fee is waived entirely."
        />

        <Reveal>
          <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="grid grid-cols-3 border-b border-border bg-secondary/40 px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Staked $PULSE</span>
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
                    isWaived && "bg-brand-500/[0.06]",
                  )}
                >
                  <span className="font-semibold text-foreground">{row.stakeLabel}</span>
                  <span className="text-center tabular-nums text-foreground">
                    {(row.bps / 100).toFixed(2)}%
                    <span className="ml-1 text-[11.5px] text-muted-foreground">({row.bps} bps)</span>
                  </span>
                  <span className="text-right">
                    {isWaived ? (
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
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
          A merchant doing $1M/month in volume saves ~$1,200/month by staking 50k $PULSE — and earns
          USDC yield on top.
        </PlainEnglish>
      </div>
    </section>
  );
}

/* ─────────────────────────  REVENUE PROJECTIONS  ───────────────────────── */

function Revenue() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="What Pulse will earn"
          title={<>The revenue <span className="text-gradient">that gets shared</span>.</>}
          description="These are the assumptions feeding holder earnings. Average charge $50, 1.5 charges per relationship per month."
        />

        <Reveal>
          <div className="mt-12 overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
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
                    r.tone === "brand" && "bg-brand-500/[0.04]",
                    r.tone === "emerald" && "bg-emerald-500/[0.05]",
                  )}
                >
                  <span className="font-semibold text-foreground">{r.year}</span>
                  <span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        r.scenario === "Bull"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.scenario}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{r.active}</span>
                  <span className="text-right tabular-nums text-foreground">{r.tpv}</span>
                  <span className="text-right font-display text-[16px] font-bold tabular-nums text-foreground">
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
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="What you could earn"
          title={<>Two ways $PULSE <span className="text-gradient">pays you</span>.</>}
          description="Real USDC yield from fees, plus the token's own appreciation as Pulse grows. Numbers below are illustrative scenarios — not promises."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {/* USDC yield */}
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-500" />
                <h3 className="font-display text-[16px] font-bold text-foreground">
                  USDC yield per 10,000 vePULSE / year
                </h3>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                Assumes 125M effective vePULSE outstanding, 60% of fees → stakers.
              </p>

              <div className="mt-5 divide-y divide-border rounded-xl border border-border">
                {HOLDER_YIELD.map((row) => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
                    <div>
                      <div className="text-[13.5px] font-semibold text-foreground">{row.label}</div>
                      <div className="text-[11.5px] text-muted-foreground">Protocol rev {row.rev}</div>
                    </div>
                    <div className="font-display text-[20px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {row.yieldVal}
                    </div>
                  </div>
                ))}
              </div>

              <PlainEnglish>
                If you held 10,000 vePULSE through a year-3 base-case scenario, you&apos;d earn ~$1,152
                in USDC — without selling a single token.
              </PlainEnglish>
            </div>
          </Reveal>

          {/* Token price */}
          <Reveal delay={120}>
            <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-soft sm:p-7">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-500" />
                <h3 className="font-display text-[16px] font-bold text-foreground">
                  Token price at price-to-fees multiples
                </h3>
              </div>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                FDV ÷ 1B supply. Comparable infra tokens trade at 20–80× P/F.
              </p>

              <div className="mt-5 overflow-x-auto rounded-xl border border-border">
                <div className="min-w-[440px]">
                  <div className="grid grid-cols-4 bg-secondary/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Scenario</span>
                    <span className="text-right">20×</span>
                    <span className="text-right">40×</span>
                    <span className="text-right">80×</span>
                  </div>
                  {FDV_TABLE.map((row, i) => (
                    <div
                      key={row.yr}
                      className={cn(
                        "grid grid-cols-4 items-center px-3 py-3 text-[13px]",
                        i !== FDV_TABLE.length - 1 && "border-b border-border",
                      )}
                    >
                      <span>
                        <div className="font-semibold text-foreground">{row.yr}</div>
                        <div className="text-[11px] text-muted-foreground">rev {row.rev}</div>
                      </span>
                      <span className="text-right tabular-nums text-foreground">{row.px20}</span>
                      <span className="text-right tabular-nums font-semibold text-foreground">{row.px40}</span>
                      <span className="text-right tabular-nums text-brand-600 dark:text-brand-300">{row.px80}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* worked example */}
        <Reveal>
          <div className="mt-8 overflow-hidden rounded-3xl border border-brand-300/50 bg-brand-500/[0.05] p-6 shadow-soft sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="brand">Worked example</Pill>
              <h3 className="font-display text-[18px] font-bold text-foreground">
                Buy 100k $PULSE at $0.30 → lock for 4 years
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
                  <span className="font-display text-[28px] font-extrabold tabular-nums text-foreground">$108k</span>
                  <span className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">≈ 3.6×</span>
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
                  <span className="font-display text-[28px] font-extrabold tabular-nums text-foreground">$549k</span>
                  <span className="text-[12.5px] font-semibold text-emerald-600 dark:text-emerald-400">≈ 18×</span>
                </div>
                <p className="mt-2 text-[12.5px] text-muted-foreground">
                  Token value $488k + ~$61k accumulated USDC yield
                </p>
              </div>
            </div>
            <p className="mt-4 text-[11.5px] text-muted-foreground">
              Illustrative only. Token markets are volatile and these numbers depend on Pulse hitting
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
      label: "Fjord LBP",
      body: "72-hour liquidity bootstrap, weights 96/4 → 50/50. 50M PULSE on offer. Expected clear $0.10–$0.30. Raise $5–15M.",
    },
    {
      label: "DEX liquidity",
      body: "Uniswap V3 on Base. LP token permanently burned at launch.",
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
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Launch"
          title={<>How $PULSE goes <span className="text-gradient">live</span>.</>}
          description="Public sale only. No private rounds, no sweetheart pricing."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {items.map((it, i) => (
            <Reveal key={it.label} delay={(i % 2) * 80}>
              <div className="flex h-full gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className="mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300">
                  <span className="font-display text-[12px] font-bold tabular-nums">{i + 1}</span>
                </div>
                <div>
                  <div className="font-display text-[15px] font-bold text-foreground">{it.label}</div>
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
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Safeguards"
          title={<>Why this is built to <span className="text-gradient">not blow up</span>.</>}
          description="Every common token launch failure mode has a specific mitigation. Here they are."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {RISKS.map((r, i) => (
            <Reveal key={r.title} delay={(i % 2) * 80}>
              <div className="flex h-full gap-3.5 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <r.Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-[15px] font-bold text-foreground">{r.title}</div>
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
    q: "What is $PULSE actually for?",
    a: "Two things. First, locking it earns you a share of every fee Pulse collects, paid in USDC. Second, merchants who stake it pay lower protocol fees.",
  },
  {
    q: "Is the supply inflationary?",
    a: "No. The total supply is fixed at 1,000,000,000 PULSE forever. No new tokens will ever be minted. The only motion is the existing supply unlocking over time.",
  },
  {
    q: "Can the team rug-pull?",
    a: "No. The launch liquidity LP token is sent to a burn address — nobody can remove it. The team allocation is locked for 12 months with a 36-month linear vest after that, and the treasury sits behind a 4-of-7 multisig and a 48-hour timelock until the DAO takes over at month 12.",
  },
  {
    q: "Do I have to lock my tokens to benefit?",
    a: "You only earn USDC yield and governance votes if you lock for vePULSE. You can hold un-locked PULSE for price exposure and unlock-on-demand, but you won't earn yield on it.",
  },
  {
    q: "What's a 'real yield' token?",
    a: "It means yield is paid in actual revenue (USDC here), not by minting more of the same token. Inflationary 'yield' just dilutes you. Real yield is genuine cash flow.",
  },
  {
    q: "Where can I buy it?",
    a: "At launch via the Fjord LBP, then on Uniswap V3 on Base. A tier-2 CEX listing follows at month 1.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl border border-border bg-card transition-colors hover:border-brand-300">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-display text-[14.5px] font-semibold text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180 text-brand-500",
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
      <div className="mx-auto max-w-[900px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Frequently asked"
          title={<>Still <span className="text-gradient">have questions?</span></>}
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
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal>
          <div className="ring-gradient relative overflow-hidden rounded-3xl border border-border bg-card p-8 text-center shadow-lift sm:p-12">
            <div className="pointer-events-none absolute -inset-x-10 -top-20 h-[260px] bg-[radial-gradient(ellipse_at_top,rgba(99,91,255,0.30),transparent_65%)] blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-[640px] text-balance font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold leading-[1.1] tracking-[-0.025em] text-foreground">
                Be there at <span className="text-gradient">launch</span>.
              </h2>
              <p className="mx-auto mt-3 max-w-[520px] text-[14.5px] leading-relaxed text-muted-foreground">
                Watch the docs for the LBP date. No allowlist — anyone can participate on Fjord when
                the sale opens.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/docs"
                  className="btn-sheen group relative inline-flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient px-7 text-[15px] font-semibold text-white shadow-brand transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-brand-lg"
                >
                  <span className="relative z-[2]">Read the docs</span>
                  <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-brand-400"
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

export function PulseTokenView() {
  return (
    <>
      <Hero />
      <TLDR />
      <Allocation />
      <Emission />
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
