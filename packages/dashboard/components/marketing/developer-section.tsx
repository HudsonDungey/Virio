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
    code: `import { Virio, usdc, PERIOD } from "@virio/sdk";

const virio = new Virio({
  contractAddress: "0x9d0e...7f12",
  chain: "base",
  rpcUrl: process.env.RPC_URL,
  privateKey: process.env.PRIVATE_KEY,
});

// Create a recurring plan — 49 USDC / month
const { planId } = await virio.plans.create({
  amount: usdc(49),
  period: PERIOD.MONTHLY,
});

// The customer approves once, then subscribes
await virio.approve(usdc(588));
const { subscriptionId } =
  await virio.subscriptions.subscribe({ planId });`,
  },
  {
    label: "React",
    language: "tsx",
    filename: "Checkout.tsx",
    code: `import { VirioButton, VirioProvider } from "@virio/sdk/react";

export function Checkout({ planId }: { planId: string }) {
  return (
    <VirioProvider rpcUrl={process.env.NEXT_PUBLIC_RPC_URL!}>
      <VirioButton planId={planId}>Subscribe — $49/mo</VirioButton>
    </VirioProvider>
  );
}`,
  },
  {
    label: "Solidity",
    language: "sol",
    filename: "Payroll.sol",
    code: `// Recurring payroll reuses the subscription execution model
contract VirioPayroll {
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
    title: "one-line install",
    body: "Install the SDK and start creating subscription plans in your app.",
  },
  {
    icon: Boxes,
    title: "framework adapters",
    body: "Use Virio with React, Vue, Angular, or a plain web app.",
  },
  {
    icon: GitBranch,
    title: "test before mainnet",
    body: "Test plans, wallet approvals, scheduled charges, and webhooks before launch.",
  },
];

export function DeveloperSection() {
  return (
    <section className="relative scroll-mt-24 border-y border-border bg-secondary/40 py-24 sm:py-32">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="developer-first"
              title="add crypto billing to your app"
              description="Use SDKs, webhooks, and a test environment to launch subscriptions without building payment infrastructure yourself."
            />
            <div className="mt-8 space-y-4">
              {POINTS.map((p, i) => (
                <Reveal key={p.title} delay={i * 70}>
                  <div className="flex gap-4">
                    <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border border-border bg-card text-muted-foreground">
                      <p.icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    </span>
                    <div>
                      <h3 className="font-display text-[14.5px] font-semibold tracking-[-0.02em] text-foreground">
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
              className="group mt-8 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-foreground"
            >
              explore the developer portal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <Reveal delay={100} className="min-w-0 w-full">
            <CodeWindow tabs={TABS} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
