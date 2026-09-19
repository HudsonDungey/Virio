import * as React from "react";
import {
  Repeat,
  Wallet,
  Network,
  Code2,
  BarChart3,
  Layers,
  Coins,
  Webhook,
} from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

interface Feature {
  icon: React.ElementType;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Repeat,
    title: "recurring subscriptions",
    body: "Set weekly, monthly, yearly, or custom billing. Your customer approves once; future charges run on schedule.",
  },
  {
    icon: Wallet,
    title: "automated payroll",
    body: "Create a pay schedule and send stablecoins to contractors or team members automatically.",
  },
  {
    icon: Network,
    title: "executor network",
    body: "Independent executors run scheduled charges, so you do not need to maintain a cron job or payment server.",
  },
  {
    icon: Code2,
    title: "developer SDKs",
    body: "Use TypeScript, React, or Solidity tools to add crypto billing to your product.",
  },
  {
    icon: BarChart3,
    title: "real-time analytics",
    body: "See payments, failed charges, subscription activity, and payroll volume in one dashboard.",
  },
  {
    icon: Layers,
    title: "built for EVM",
    body: "Start on the supported network today, with an architecture designed to expand as usage grows.",
  },
  {
    icon: Coins,
    title: "stablecoin payments",
    body: "Accept USDC and other supported stablecoins with settlement you can verify onchain.",
  },
  {
    icon: Webhook,
    title: "billing controls",
    body: "Set spending caps, cancellation rules, webhooks, and custom billing intervals.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="platform"
          title="everything you need for crypto subscriptions"
          description="Create subscription plans, accept stablecoin payments, and automate payroll without building payment infrastructure from scratch."
        />

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 60} className="h-full">
              <article className="group h-full rounded-2xl border border-border bg-card p-6 transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))]">
                <span className="inline-grid h-10 w-10 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground transition-colors group-hover:text-foreground">
                  <f.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </span>
                <h3 className="mt-5 font-display text-[16px] font-semibold tracking-[-0.025em] text-foreground">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
