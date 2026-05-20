"use client";

import * as React from "react";
import {
  Search,
  Rocket,
  KeyRound,
  Repeat,
  Wallet,
  Webhook,
  Coins,
  Network,
  FileCode2,
  ChevronRight,
} from "lucide-react";
import { CodeWindow } from "@/components/marketing/code-window";
import { cn } from "@/lib/utils";

interface Article {
  id: string;
  group: string;
  title: string;
  Icon: React.ElementType;
  summary: string;
  render: () => React.ReactNode;
}

/* ---------- prose primitives ---------- */

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 scroll-mt-24 font-display text-[22px] font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-7 font-display text-[16px] font-bold tracking-tight text-foreground">
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-3 space-y-1.5">{children}</ul>;
}
function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[14px] leading-relaxed text-muted-foreground">
      <ChevronRight className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-brand-500" />
      <span>{children}</span>
    </li>
  );
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[12.5px] text-brand-600 dark:text-brand-300">
      {children}
    </code>
  );
}
function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-brand-300/50 bg-brand-500/[0.06] p-4 text-[13.5px] leading-relaxed text-foreground">
      {children}
    </div>
  );
}
function Note({ children }: { children: React.ReactNode }) {
  return <div className="mt-4">{children}</div>;
}

/* ---------- articles ---------- */

const ARTICLES: Article[] = [
  {
    id: "introduction",
    group: "Getting started",
    title: "Introduction",
    Icon: Rocket,
    summary: "What Virio is and how the pieces fit together.",
    render: () => (
      <>
        <H2>Introduction</H2>
        <P>
          Virio is onchain subscription &amp; payroll infrastructure — the
          settlement layer for recurring crypto payments. It turns billing into a
          single programmable primitive that powers subscriptions, payroll, and
          metered usage from one integration.
        </P>
        <H3>Core concepts</H3>
        <Ul>
          <Li>
            <strong>Products &amp; plans</strong> — pricing definitions with a
            token, interval, and optional spend caps.
          </Li>
          <Li>
            <strong>Agreements</strong> — a customer&apos;s onchain approval of a
            plan. Signed once, enforced by audited contracts.
          </Li>
          <Li>
            <strong>Executors</strong> — a permissionless network that triggers
            settlement on schedule and earns rewards.
          </Li>
          <Li>
            <strong>Payroll</strong> — recurring distributions that reuse the
            exact same execution model as subscriptions.
          </Li>
        </Ul>
        <Callout>
          New to Virio? Jump straight to the{" "}
          <Code>Quickstart</Code> — you can have a working integration on testnet
          in about ten minutes.
        </Callout>
      </>
    ),
  },
  {
    id: "quickstart",
    group: "Getting started",
    title: "Quickstart",
    Icon: Rocket,
    summary: "Install the SDK and create your first subscription.",
    render: () => (
      <>
        <H2>Quickstart</H2>
        <P>
          Install the SDK, authenticate, and create a recurring product. Every
          call is typed end-to-end.
        </P>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "Install",
                language: "bash",
                code: "# npm\nnpm install @virio/sdk\n\n# yarn\nyarn add @virio/sdk\n\n# pnpm\npnpm add @virio/sdk",
              },
              {
                label: "Create a product",
                language: "ts",
                filename: "quickstart.ts",
                code: `import { Virio } from "@virio/sdk";

const virio = new Virio({ apiKey: process.env.VIRIO_KEY });

const plan = await virio.products.create({
  name: "Pro plan",
  price: 49,
  token: "USDC",
  interval: "month",
});

console.log(plan.id); // plan_0x9d0e…`,
              },
              {
                label: "Subscribe",
                language: "ts",
                filename: "subscribe.ts",
                code: `const sub = await virio.subscriptions.subscribe({
  planId: plan.id,
  customer: "0x1b7d…9d0e",
});

// the customer signs once — executors handle every charge
console.log(sub.status); // "active"`,
              },
            ]}
          />
        </Note>
        <H3>Next steps</H3>
        <Ul>
          <Li>Wire a webhook endpoint to react to settlement events.</Li>
          <Li>Use the Testing Suite to simulate executor runs before mainnet.</Li>
          <Li>Add payroll schedules with the same SDK client.</Li>
        </Ul>
      </>
    ),
  },
  {
    id: "authentication",
    group: "Core",
    title: "Authentication",
    Icon: KeyRound,
    summary: "API keys, environments, and request signing.",
    render: () => (
      <>
        <H2>Authentication</H2>
        <P>
          Virio uses API keys scoped to an environment. Test keys are prefixed{" "}
          <Code>pk_test_</Code> and live keys <Code>pk_live_</Code>. Pass the key
          when constructing the client, or set <Code>VIRIO_KEY</Code> in your
          environment.
        </P>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "Server",
                language: "ts",
                code: `const virio = new Virio({
  apiKey: process.env.VIRIO_KEY,
  environment: "test", // or "live"
});`,
              },
              {
                label: "cURL",
                language: "bash",
                code: `curl https://api.virio.xyz/v1/subscriptions \\
  -H "Authorization: Bearer $VIRIO_KEY" \\
  -H "Content-Type: application/json"`,
              },
            ]}
          />
        </Note>
        <Callout>
          Never ship a live key to the browser. Use the React adapter, which
          exchanges a short-lived client token from your backend.
        </Callout>
      </>
    ),
  },
  {
    id: "subscriptions",
    group: "Core",
    title: "Subscriptions",
    Icon: Repeat,
    summary: "Recurring billing with onchain agreements.",
    render: () => (
      <>
        <H2>Subscriptions</H2>
        <P>
          A subscription is an onchain agreement between a customer and a plan.
          The customer signs a single approval; from then on, executors charge
          the agreement every interval until it is cancelled or hits its
          auto-cancel rule.
        </P>
        <H3>Lifecycle</H3>
        <Ul>
          <Li>
            <Code>created</Code> → <Code>active</Code> once the approval is mined.
          </Li>
          <Li>
            <Code>active</Code> → <Code>past_due</Code> if a charge reverts
            (insufficient allowance, paused plan).
          </Li>
          <Li>
            <Code>past_due</Code> → <Code>active</Code> after a successful retry,
            or → <Code>cancelled</Code> when the retry budget is exhausted.
          </Li>
        </Ul>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "Manage",
                language: "ts",
                code: `// cancel — either customer or merchant may call this
await virio.subscriptions.cancel(sub.id);

// inspect onchain state
const state = await virio.subscriptions.retrieve(sub.id);
state.chargeCount;   // 4
state.nextChargeAt;  // unix seconds`,
              },
            ]}
          />
        </Note>
      </>
    ),
  },
  {
    id: "payroll",
    group: "Core",
    title: "Payroll",
    Icon: Wallet,
    summary: "Store recipients onchain and automate distributions.",
    render: () => (
      <>
        <H2>Payroll</H2>
        <P>
          Payroll reuses the subscription execution model. Recipients are stored
          onchain in a per-payer registry, and scheduled runs behave exactly like
          recurring subscriptions — executors trigger the distribution and split
          fees automatically.
        </P>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "Registry (Solidity)",
                language: "sol",
                code: `// recipients are stored per payer
mapping(address => address[]) public payerStoredAddresses;`,
              },
              {
                label: "Schedule (TypeScript)",
                language: "ts",
                code: `await virio.payroll.schedule({
  name: "Core team — monthly",
  recipients: ["ava.eth", "0x1b7d…9d0e"],
  amounts: [4800, 3450],
  token: "USDC",
  interval: "month",
});`,
              },
            ]}
          />
        </Note>
        <H3>What you get</H3>
        <Ul>
          <Li>Saved addresses with labels and ENS resolution.</Li>
          <Li>Quick pay, bulk pay, and CSV import.</Li>
          <Li>Recurring schedules, an upcoming timeline, and a retry queue.</Li>
        </Ul>
      </>
    ),
  },
  {
    id: "webhooks",
    group: "Core",
    title: "Webhooks",
    Icon: Webhook,
    summary: "React to settlement events in real time.",
    render: () => (
      <>
        <H2>Webhooks</H2>
        <P>
          Virio delivers a signed webhook for every meaningful event. Verify the{" "}
          <Code>Virio-Signature</Code> header, then switch on{" "}
          <Code>event.type</Code>.
        </P>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "Event payload",
                language: "json",
                code: `{
  "type": "subscription.charged",
  "data": {
    "subscriptionId": "sub_0x8f3c2a4c",
    "amount": "49.00",
    "token": "USDC",
    "protocolFee": "0.25",
    "executorFee": "0.10",
    "txHash": "0x9d0e…4e88"
  }
}`,
              },
              {
                label: "Handler",
                language: "ts",
                code: `app.post("/webhooks/virio", (req, res) => {
  const event = virio.webhooks.verify(req.body, req.headers);
  if (event.type === "subscription.charged") {
    grantAccess(event.data.subscriptionId);
  }
  res.sendStatus(200);
});`,
              },
            ]}
          />
        </Note>
        <Callout>
          Use the Testing Suite&apos;s webhook inspector to replay any event
          against your endpoint and confirm your handler before going live.
        </Callout>
      </>
    ),
  },
  {
    id: "fee-model",
    group: "Protocol",
    title: "Fee model",
    Icon: Coins,
    summary: "Transparent, onchain-verified settlement splits.",
    render: () => (
      <>
        <H2>Fee model</H2>
        <P>
          Virio charges no monthly fee. Every settlement is split onchain into
          three transparent components:
        </P>
        <Ul>
          <Li>
            <strong>$1.00 flat fee</strong> per settlement.
          </Li>
          <Li>
            <strong>0.25% protocol fee</strong> of settled volume.
          </Li>
          <Li>
            <strong>0.10% executor fee</strong> of settled volume, paid to the
            executor that triggered the run.
          </Li>
        </Ul>
        <P>
          On a $100 charge the customer pays $100, fees total $1.35, and $98.65
          settles directly to your wallet — every split verifiable onchain.
        </P>
      </>
    ),
  },
  {
    id: "executors",
    group: "Protocol",
    title: "Executor network",
    Icon: Network,
    summary: "Permissionless automation of settlement.",
    render: () => (
      <>
        <H2>Executor network</H2>
        <P>
          Executors are a permissionless set of agents that watch for due
          agreements and call <Code>execute()</Code>. The first executor to
          settle a due agreement earns the 0.10% executor fee. There are no cron
          jobs for you to run or monitor.
        </P>
        <Ul>
          <Li>Anyone can run an executor — settlement is trustless.</Li>
          <Li>Executor rewards are paid in the settlement token, onchain.</Li>
          <Li>
            Health and uptime are surfaced in the dashboard&apos;s executor
            monitoring widgets.
          </Li>
        </Ul>
      </>
    ),
  },
  {
    id: "contracts",
    group: "Protocol",
    title: "Smart contract architecture",
    Icon: FileCode2,
    summary: "How the onchain pieces are structured.",
    render: () => (
      <>
        <H2>Smart contract architecture</H2>
        <P>
          The protocol is intentionally small. A single manager contract owns
          plan, agreement, and payroll state; settlement is a pure function of
          onchain data so executors are interchangeable.
        </P>
        <Note>
          <CodeWindow
            tabs={[
              {
                label: "VirioManager.sol",
                language: "sol",
                code: `contract VirioManager {
    mapping(bytes32 => Plan) public plans;
    mapping(bytes32 => Agreement) public agreements;
    mapping(address => address[]) public payerStoredAddresses;

    function execute(bytes32 agreementId) external {
        Agreement storage a = agreements[agreementId];
        require(block.timestamp >= a.nextChargeAt, "not due");
        _settle(a);              // transfer + split fees
        a.nextChargeAt += a.interval;
        emit Charged(agreementId, a.amount);
    }
}`,
              },
            ]}
          />
        </Note>
        <Callout>
          Contracts are audited by Spearbit and OpenZeppelin. Deployment
          addresses for every supported chain are published in the Developer
          Portal.
        </Callout>
      </>
    ),
  },
];

const GROUP_ORDER = ["Getting started", "Core", "Protocol"];

export function DocsView() {
  const [activeId, setActiveId] = React.useState(ARTICLES[0].id);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ARTICLES;
    return ARTICLES.filter((a) =>
      `${a.title} ${a.group} ${a.summary}`.toLowerCase().includes(q),
    );
  }, [query]);

  const active = ARTICLES.find((a) => a.id === activeId) ?? ARTICLES[0];
  const idx = ARTICLES.findIndex((a) => a.id === active.id);
  const prev = ARTICLES[idx - 1];
  const next = ARTICLES[idx + 1];

  return (
    <div className="mx-auto flex max-w-[1200px] gap-10 px-5 pb-24 pt-28 sm:px-8">
      {/* sidebar */}
      <aside className="sticky top-24 hidden h-[calc(100vh-8rem)] w-[230px] flex-shrink-0 overflow-y-auto scrollbar-none lg:block">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-brand-500"
          />
        </div>
        {GROUP_ORDER.map((group) => {
          const items = filtered.filter((a) => a.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-5">
              <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {group}
              </p>
              {items.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setActiveId(a.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                    a.id === activeId
                      ? "bg-brand-500/10 font-semibold text-brand-600 dark:text-brand-300"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <a.Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  {a.title}
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      {/* content */}
      <article className="min-w-0 flex-1 animate-fade-in">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
          <span>Docs</span>
          <ChevronRight className="h-3 w-3" />
          <span>{active.group}</span>
        </div>
        <div className="mt-4">{active.render()}</div>

        {/* prev / next */}
        <div className="mt-14 grid gap-3 sm:grid-cols-2">
          {prev ? (
            <button
              onClick={() => setActiveId(prev.id)}
              className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-brand-300"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Previous
              </span>
              <div className="mt-0.5 font-display text-[14px] font-bold text-foreground">
                {prev.title}
              </div>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              onClick={() => setActiveId(next.id)}
              className="group rounded-xl border border-border bg-card p-4 text-right transition-colors hover:border-brand-300"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Next
              </span>
              <div className="mt-0.5 font-display text-[14px] font-bold text-foreground">
                {next.title}
              </div>
            </button>
          )}
        </div>
      </article>

      {/* on this page */}
      <aside className="sticky top-24 hidden h-min w-[170px] flex-shrink-0 xl:block">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          On this page
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {active.summary}
        </p>
        <a
          href="/dev"
          className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-600 dark:text-brand-300"
        >
          Developer portal
          <ChevronRight className="h-3 w-3" />
        </a>
      </aside>
    </div>
  );
}
