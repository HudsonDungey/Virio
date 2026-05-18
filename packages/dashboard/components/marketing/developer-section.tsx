import * as React from "react";
import Link from "next/link";
import { Terminal, Boxes, GitBranch, ArrowRight } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";
import { CodeWindow, type CodeTab } from "./code-window";

const TABS: CodeTab[] = [
  {
    label: "TypeScript",
    language: "ts",
    filename: "billing.ts",
    code: `import { Pulse } from "@pulse/sdk";

const pulse = new Pulse({ apiKey: process.env.PULSE_KEY });

// Create a recurring product
const plan = await pulse.products.create({
  name: "Pro plan",
  price: 49,
  token: "USDC",
  interval: "month",
});

// Subscribe a customer — they sign once
const sub = await pulse.subscriptions.subscribe({
  planId: plan.id,
  customer: "0x8f3c...2a4c",
});`,
  },
  {
    label: "React",
    language: "tsx",
    filename: "Checkout.tsx",
    code: `import { usePulseCheckout } from "@pulse/react";

export function Checkout({ planId }: { planId: string }) {
  const { subscribe, status } = usePulseCheckout(planId);

  return (
    <button onClick={subscribe} disabled={status === "pending"}>
      {status === "active" ? "Subscribed" : "Subscribe — $49/mo"}
    </button>
  );
}`,
  },
  {
    label: "Solidity",
    language: "sol",
    filename: "Payroll.sol",
    code: `// Recurring payroll reuses the subscription execution model
contract PulsePayroll {
    mapping(address => address[]) public payerStoredAddresses;

    function schedule(address[] calldata recipients, uint256 interval)
        external
        returns (bytes32 runId)
    {
        runId = _createRun(recipients, interval);
        emit PayrollScheduled(runId, msg.sender, interval);
    }
}`,
  },
  {
    label: "Webhook",
    language: "json",
    filename: "event.json",
    code: `{
  "type": "subscription.charged",
  "data": {
    "subscriptionId": "sub_0x8f3c2a4c",
    "amount": "49.00",
    "token": "USDC",
    "protocolFee": "0.25",
    "executorFee": "0.10",
    "txHash": "0x9d0e...4e88",
    "settledAt": 1715731200
  }
}`,
  },
];

const POINTS = [
  {
    icon: Terminal,
    title: "One-line install",
    body: "npm install @pulse/sdk — typed end to end, zero config.",
  },
  {
    icon: Boxes,
    title: "Framework adapters",
    body: "First-class hooks for React, Next.js, and a Solidity integration library.",
  },
  {
    icon: GitBranch,
    title: "Test before mainnet",
    body: "A full sandbox with mock wallets, executor simulation, and webhook replay.",
  },
];

export function DeveloperSection() {
  return (
    <section className="relative scroll-mt-24 border-y border-border bg-secondary/30 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 dot-fade opacity-50" />
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Developer-first"
              title={
                <>
                  Billing that disappears into{" "}
                  <span className="text-gradient">your stack</span>
                </>
              }
              description="Typed SDKs, predictable webhooks, and a sandbox that mirrors mainnet. Ship onchain billing without becoming a payments team."
            />
            <div className="mt-8 space-y-4">
              {POINTS.map((p, i) => (
                <Reveal key={p.title} delay={i * 80}>
                  <div className="flex gap-4">
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-border bg-card text-brand-600 shadow-soft dark:text-brand-300">
                      <p.icon className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div>
                      <h3 className="font-display text-[15px] font-bold text-foreground">
                        {p.title}
                      </h3>
                      <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted-foreground">
                        {p.body}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Link
              href="/dev"
              className="group mt-8 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-600 dark:text-brand-300"
            >
              Explore the developer portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <Reveal delay={120} className="min-w-0 w-full">
            <CodeWindow tabs={TABS} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
