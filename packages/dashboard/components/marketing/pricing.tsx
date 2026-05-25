import * as React from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const FEE_LINES = [
  { label: "flat fee", value: "$1.00", note: "per settlement" },
  { label: "protocol fee", value: "0.25%", note: "of volume" },
  { label: "executor fee", value: "0.10%", note: "of volume" },
];

const INCLUDED = [
  "no monthly platform fees, ever",
  "unlimited products, plans & payroll runs",
  "full developer SDKs & API access",
  "executor network with 99.99% uptime",
  "real-time analytics & webhook events",
  "transparent, onchain-verifiable settlement",
];

const ENTERPRISE = [
  "volume-based fee discounts",
  "dedicated executor capacity",
  "SSO, role permissions & audit logs",
  "priority support & solution engineering",
  "custom contract deployment & SLAs",
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="pricing"
          title="transparent pricing. zero monthly fees."
          description="you only pay when you get paid. every fee is split and verified onchain — no contracts, no minimums, no surprises."
        />

        <div className="mx-auto mt-14 grid max-w-[940px] gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <div className="relative h-full rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-foreground">
                    pay as you settle
                  </h3>
                  <p className="mt-1 text-[13.5px] text-muted-foreground">
                    for startups and scaleups billing onchain
                  </p>
                </div>
                <span className="rounded-full border border-virio-emerald/30 bg-virio-emerald/[0.08] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-virio-emerald">
                  recommended
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {FEE_LINES.map((f) => (
                  <div
                    key={f.label}
                    className="rounded-lg border border-border bg-background p-3.5"
                  >
                    <div className="font-display text-[22px] font-semibold tracking-[-0.035em] text-foreground">
                      {f.value}
                    </div>
                    <div className="mt-0.5 text-[12px] font-medium text-foreground">
                      {f.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {f.note}
                    </div>
                  </div>
                ))}
              </div>

              <ul className="mt-6 space-y-2.5">
                {INCLUDED.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2.5 text-[13.5px] text-foreground"
                  >
                    <span className="mt-[3px] grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full bg-virio-emerald/15 text-virio-emerald">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-virio-emerald px-5 text-[14px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90"
              >
                start building
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="flex h-full flex-col rounded-2xl border border-border bg-secondary/50 p-6 sm:p-8">
              <h3 className="font-display text-[20px] font-semibold tracking-[-0.025em] text-foreground">
                enterprise
              </h3>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                for platforms settling at scale
              </p>
              <div className="mt-6 font-display text-[22px] font-semibold tracking-[-0.035em] text-foreground">
                custom
              </div>
              <div className="text-[12px] text-muted-foreground">
                volume pricing &amp; SLAs
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {ENTERPRISE.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2.5 text-[13.5px] text-foreground"
                  >
                    <span className="mt-[3px] grid h-3.5 w-3.5 flex-shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              <Link
                href="/docs"
                className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-5 text-[14px] font-semibold text-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))]"
              >
                contact sales
              </Link>
            </div>
          </Reveal>
        </div>

        <p className="mt-8 text-center text-[12.5px] text-muted-foreground">
          example: on a $100 charge you keep{" "}
          <span className="font-medium text-foreground">$98.65</span> — settled
          instantly, verifiable onchain.
        </p>
      </div>
    </section>
  );
}
