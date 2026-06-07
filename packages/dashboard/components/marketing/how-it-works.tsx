import * as React from "react";
import { PackagePlus, Fingerprint, Workflow, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    n: "01",
    icon: PackagePlus,
    title: "create a product or payroll",
    body: "define a pricing plan or a payroll schedule. set the token, interval, spend caps, and webhook endpoints — from the dashboard or SDK.",
    code: "virio.products.create({ price: 49, interval: 'month' })",
  },
  {
    n: "02",
    icon: Fingerprint,
    title: "user approves once",
    body: "the customer signs a single onchain approval. no re-signing every cycle — the agreement is enforced by the contracts themselves.",
    code: "await virio.subscriptions.subscribe(planId)",
  },
  {
    n: "03",
    icon: Workflow,
    title: "executors automate settlement",
    body: "the executor network triggers every charge and payroll run on schedule, splits fees onchain, and settles directly to your wallet.",
    code: "executor.run() → settle() → payout()",
  },
];

function FeeFlow() {
  const rows = [
    { label: "customer pays", value: "$100.00", tone: "text-foreground" },
    { label: "flat protocol fee", value: "-$1.00", tone: "text-muted-foreground" },
    { label: "protocol fee · 0.25%", value: "-$0.25", tone: "text-muted-foreground" },
    { label: "executor fee · 0.10%", value: "-$0.10", tone: "text-muted-foreground" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          settlement breakdown
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="status-dot" style={{ width: 6, height: 6 }} />
          onchain verified
        </span>
      </div>
      <div className="mt-5 space-y-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3.5 py-2.5"
          >
            <span className="text-[13px] text-muted-foreground">{r.label}</span>
            <span className={`font-mono text-[13px] font-semibold tabular-nums ${r.tone}`}>
              {r.value}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-md border border-virio-emerald/30 bg-virio-emerald/[0.08] px-3.5 py-3">
          <span className="text-[13px] font-semibold text-foreground">
            net to your wallet
          </span>
          <span className="font-mono text-[14px] font-semibold tabular-nums text-virio-emerald">
            $98.65
          </span>
        </div>
      </div>
      <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
        every split is executed and verifiable onchain. no invoices, no
        chargebacks, no monthly platform fee.
      </p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how"
      className="relative scroll-mt-24 border-y border-border bg-secondary/40 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="how it works"
          title="from integration to settlement in three steps"
          description="virio turns recurring payments into a single onchain primitive — the same execution model powers both subscriptions and payroll."
        />

        <div className="mt-14 grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 space-y-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 70}>
                <div className="group relative flex gap-5 rounded-2xl border border-border bg-card p-5 transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))]">
                  <div className="flex flex-col items-center">
                    <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors group-hover:text-foreground">
                      <s.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </span>
                    {i < STEPS.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-gradient-to-b from-border to-transparent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {s.n}
                      </span>
                      <h3 className="font-display text-[16px] font-semibold tracking-[-0.025em] text-foreground">
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      {s.body}
                    </p>
                    <code className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[11.5px] text-foreground">
                      <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="whitespace-nowrap">{s.code}</span>
                    </code>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100} className="min-w-0 lg:sticky lg:top-28">
            <FeeFlow />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
