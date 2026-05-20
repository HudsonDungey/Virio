import * as React from "react";
import { PackagePlus, Fingerprint, Workflow, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    n: "01",
    icon: PackagePlus,
    title: "Create a product or payroll",
    body: "Define a pricing plan or a payroll schedule. Set the token, interval, spend caps, and webhook endpoints — all from the dashboard or SDK.",
    code: "virio.products.create({ price: 49, interval: 'month' })",
  },
  {
    n: "02",
    icon: Fingerprint,
    title: "User approves once",
    body: "The customer signs a single onchain approval. No re-signing every cycle — the agreement is enforced by audited smart contracts.",
    code: "await virio.subscriptions.subscribe(planId)",
  },
  {
    n: "03",
    icon: Workflow,
    title: "Executors automate settlement",
    body: "The executor network triggers every charge and payroll run on schedule, splits fees onchain, and settles directly to your wallet.",
    code: "executor.run() → settle() → payout()",
  },
];

function FeeFlow() {
  const rows = [
    { label: "Customer pays", value: "$100.00", tone: "text-foreground" },
    { label: "Flat protocol fee", value: "-$1.00", tone: "text-muted-foreground" },
    { label: "Protocol fee · 0.25%", value: "-$0.25", tone: "text-muted-foreground" },
    { label: "Executor fee · 0.10%", value: "-$0.10", tone: "text-muted-foreground" },
  ];
  return (
    <div className="ring-gradient relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-lift">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Settlement breakdown
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Onchain verified
        </span>
      </div>
      <div className="mt-5 space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-lg border border-border bg-background px-3.5 py-2.5"
          >
            <span className="text-[13px] text-muted-foreground">{r.label}</span>
            <span className={`font-mono text-[13px] font-semibold tabular-nums ${r.tone}`}>
              {r.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-brand-gradient px-3.5 py-3 shadow-brand">
          <span className="text-[13px] font-semibold text-white/90">
            Net to your wallet
          </span>
          <span className="font-mono text-[15px] font-bold tabular-nums text-white">
            $98.65
          </span>
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        Every split is executed and verifiable onchain. No invoices, no
        chargebacks, no monthly platform fee.
      </p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative scroll-mt-24 border-y border-border bg-secondary/30 py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 dot-fade opacity-60" />
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From integration to settlement in three steps"
          description="Virio turns recurring payments into a single onchain primitive — the same execution model powers both subscriptions and payroll."
        />

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="group relative flex gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:border-brand-300 hover:shadow-lift">
                  <div className="flex flex-col items-center">
                    <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl border border-border bg-secondary/70 text-brand-600 transition-colors group-hover:border-brand-300 group-hover:bg-brand-500/10 dark:text-brand-300">
                      <s.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-gradient-to-b from-border to-transparent" />
                    )}
                  </div>
                  <div className="pb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-brand-500">
                        {s.n}
                      </span>
                      <h3 className="font-display text-[16.5px] font-bold tracking-tight text-foreground">
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                    <code className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-[11.5px] text-brand-600 dark:text-brand-300">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      {s.code}
                    </code>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120} className="lg:sticky lg:top-28">
            <FeeFlow />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
