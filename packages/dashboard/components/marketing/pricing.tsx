import * as React from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const FEE_LINES = [
  { label: "Flat fee", value: "$1.00", note: "per settlement" },
  { label: "Protocol fee", value: "0.25%", note: "of volume" },
  { label: "Executor fee", value: "0.10%", note: "of volume" },
];

const INCLUDED = [
  "No monthly platform fees, ever",
  "Unlimited products, plans & payroll runs",
  "Full developer SDKs & API access",
  "Executor network with 99.99% uptime",
  "Real-time analytics & webhook events",
  "Transparent, onchain-verifiable settlement",
];

const ENTERPRISE = [
  "Volume-based fee discounts",
  "Dedicated executor capacity",
  "SSO, role permissions & audit logs",
  "Priority support & solution engineering",
  "Custom contract deployment & SLAs",
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              Transparent pricing.{" "}
              <span className="text-gradient">Zero monthly fees.</span>
            </>
          }
          description="You only pay when you get paid. Every fee is split and verified onchain — no contracts, no minimums, no surprises."
        />

        <div className="mx-auto mt-14 grid max-w-[940px] gap-5 lg:grid-cols-[1.4fr_1fr]">
          {/* Primary plan */}
          <Reveal>
            <div className="ring-gradient relative h-full overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-lift sm:p-8">
              <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(99,91,255,0.22),transparent_70%)] blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-foreground">
                      Pay as you settle
                    </h3>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">
                      For startups and scaleups billing onchain
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-500/10 px-3 py-1 text-[11.5px] font-semibold text-brand-600 dark:text-brand-300">
                    Most popular
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {FEE_LINES.map((f) => (
                    <div
                      key={f.label}
                      className="rounded-xl border border-border bg-background p-3.5"
                    >
                      <div className="font-display text-[22px] font-extrabold tracking-tight text-foreground">
                        {f.value}
                      </div>
                      <div className="mt-0.5 text-[12px] font-semibold text-foreground">
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
                      <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/dashboard"
                  className="btn-sheen group relative mt-7 inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient px-6 text-[15px] font-semibold text-white shadow-brand transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-brand-lg"
                >
                  <span className="relative z-[2]">Start Building</span>
                  <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Enterprise */}
          <Reveal delay={100}>
            <div className="flex h-full flex-col rounded-3xl border border-border bg-secondary/40 p-6 sm:p-8">
              <h3 className="font-display text-xl font-bold text-foreground">
                Enterprise
              </h3>
              <p className="mt-1 text-[13.5px] text-muted-foreground">
                For platforms settling at scale
              </p>
              <div className="mt-6 font-display text-[22px] font-extrabold tracking-tight text-foreground">
                Custom
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
                    <span className="mt-0.5 grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-300">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {line}
                  </li>
                ))}
              </ul>

              <Link
                href="/docs"
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 text-[15px] font-semibold text-foreground shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-brand-400"
              >
                Contact sales
              </Link>
            </div>
          </Reveal>
        </div>

        <p className="mt-8 text-center text-[12.5px] text-muted-foreground">
          Example: on a $100 charge you keep{" "}
          <span className="font-semibold text-foreground">$98.65</span> — settled
          instantly, verifiable onchain.
        </p>
      </div>
    </section>
  );
}
