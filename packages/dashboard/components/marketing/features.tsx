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
    body: "monthly, yearly, or custom intervals. customers approve once — executors handle every charge after that.",
  },
  {
    icon: Wallet,
    title: "automated payroll",
    body: "store recipients onchain, schedule runs, and pay contractors and employees in stablecoins on autopilot.",
  },
  {
    icon: Network,
    title: "executor network",
    body: "a permissionless network of executors triggers settlement and earns rewards. no cron jobs to babysit.",
  },
  {
    icon: Code2,
    title: "developer SDKs",
    body: "typed SDKs for typescript, react, and solidity. integrate billing in an afternoon.",
  },
  {
    icon: BarChart3,
    title: "real-time analytics",
    body: "MRR, churn, payroll volume, failed settlements, and protocol fees — streamed live to your dashboard.",
  },
  {
    icon: Layers,
    title: "multi-chain",
    body: "deploy once, settle across every major EVM chain from a single integration.",
  },
  {
    icon: Coins,
    title: "stablecoin payments",
    body: "native USDC and stablecoin support with transparent, onchain-verifiable settlement.",
  },
  {
    icon: Webhook,
    title: "programmable billing",
    body: "webhooks, spend caps, auto-cancel rules, and metered usage — billing logic that lives in code.",
  },
];

export function Features() {
  return (
    <section id="features" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <SectionHeading
          eyebrow="platform"
          title="everything you need to bill onchain"
          description="one programmable platform for subscriptions, payroll, and settlement — built for engineers who want billing to disappear into the stack."
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
