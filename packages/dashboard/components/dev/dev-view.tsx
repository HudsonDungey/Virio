"use client";

import * as React from "react";
import Link from "next/link";
import {
  Code2,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Download,
  Play,
  ArrowRight,
  Boxes,
  Webhook,
  KeyRound,
  Terminal,
} from "lucide-react";
import { CodeWindow, type CodeTab } from "@/components/marketing/code-window";
import { Reveal } from "@/components/marketing/reveal";
import { cn } from "@/lib/utils";

/* ---------- API keys panel ---------- */

interface ApiKey {
  id: string;
  env: "test" | "live";
  label: string;
  value: string;
}

const INITIAL_KEYS: ApiKey[] = [
  { id: "k1", env: "test", label: "Test mode", value: "pk_test_8f3c2a4c91d4e2a7b6c5d8e9" },
  { id: "k2", env: "live", label: "Live mode", value: "pk_live_1b7d9d0e0a3c4b5d6e7f8091" },
];

function randomKey(env: "test" | "live") {
  const r = Array.from({ length: 24 }, () =>
    "0123456789abcdef"[Math.floor(Math.random() * 16)],
  ).join("");
  return `pk_${env}_${r}`;
}

function ApiKeysPanel() {
  const [keys, setKeys] = React.useState<ApiKey[]>(INITIAL_KEYS);
  const [revealed, setRevealed] = React.useState<Set<string>>(new Set());
  const [copied, setCopied] = React.useState<string | null>(null);

  function toggleReveal(id: string) {
    setRevealed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  async function copy(k: ApiKey) {
    try {
      await navigator.clipboard.writeText(k.value);
      setCopied(k.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }
  function rotate(k: ApiKey) {
    setKeys((ks) =>
      ks.map((x) => (x.id === k.id ? { ...x, value: randomKey(x.env) } : x)),
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <KeyRound className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h3 className="font-display text-[14px] font-bold text-foreground">
          API keys
        </h3>
        <span className="ml-auto text-[12px] text-muted-foreground">
          rotate anytime — old keys revoke instantly
        </span>
      </div>
      <div className="divide-y divide-border">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 px-5 py-3.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                k.env === "live"
                  ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/12 text-amber-600 dark:text-amber-400",
              )}
            >
              {k.label}
            </span>
            <code className="flex-1 truncate font-mono text-[12.5px] text-foreground">
              {revealed.has(k.id)
                ? k.value
                : k.value.slice(0, 11) + "•".repeat(16)}
            </code>
            <button
              onClick={() => toggleReveal(k.id)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Reveal"
            >
              {revealed.has(k.id) ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => copy(k)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Copy"
            >
              {copied === k.id ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => rotate(k)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Rotate"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="border-t border-border bg-secondary/40 px-5 py-3">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Environment variables
        </p>
        <pre className="code-shell mt-1.5 text-muted-foreground">
          {`VIRIO_KEY=${keys[0].value}\nVIRIO_WEBHOOK_SECRET=whsec_3d44b8e1a2b3c4d5\nVIRIO_ENV=test`}
        </pre>
      </div>
    </div>
  );
}

/* ---------- interactive API reference ---------- */

interface Endpoint {
  method: "GET" | "POST" | "DELETE";
  path: string;
  desc: string;
  response: object;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/v1/products",
    desc: "Create a subscription product",
    response: { id: "plan_0x9d0e", object: "product", price: 49, interval: "month" },
  },
  {
    method: "POST",
    path: "/v1/subscriptions",
    desc: "Subscribe a customer to a plan",
    response: { id: "sub_0x8f3c", object: "subscription", status: "active" },
  },
  {
    method: "GET",
    path: "/v1/subscriptions/:id",
    desc: "Retrieve subscription state",
    response: { id: "sub_0x8f3c", status: "active", chargeCount: 4 },
  },
  {
    method: "POST",
    path: "/v1/payroll/runs",
    desc: "Schedule a recurring payroll run",
    response: { id: "run_0xb8e1", object: "payroll_run", recipients: 8 },
  },
  {
    method: "DELETE",
    path: "/v1/subscriptions/:id",
    desc: "Cancel a subscription onchain",
    response: { id: "sub_0x8f3c", status: "cancelled" },
  },
];

const METHOD_TONE: Record<Endpoint["method"], string> = {
  GET: "bg-secondary text-foreground",
  POST: "bg-virio-emerald/15 text-virio-emerald",
  DELETE: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
};

function ApiReference() {
  const [open, setOpen] = React.useState<string | null>(ENDPOINTS[0].path);
  const [running, setRunning] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<Set<string>>(new Set());

  function run(e: Endpoint) {
    setRunning(e.path);
    window.setTimeout(() => {
      setRunning(null);
      setDone((d) => new Set(d).add(e.path));
    }, 600);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {ENDPOINTS.map((e) => {
        const isOpen = open === e.path;
        return (
          <div key={e.path} className="border-b border-border last:border-0">
            <button
              onClick={() => setOpen(isOpen ? null : e.path)}
              className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-accent/50"
            >
              <span
                className={cn(
                  "w-16 rounded-md px-2 py-0.5 text-center font-mono text-[10.5px] font-bold",
                  METHOD_TONE[e.method],
                )}
              >
                {e.method}
              </span>
              <code className="font-mono text-[12.5px] text-foreground">
                {e.path}
              </code>
              <span className="ml-2 hidden text-[12.5px] text-muted-foreground sm:inline">
                {e.desc}
              </span>
              <ArrowRight
                className={cn(
                  "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                  isOpen && "rotate-90",
                )}
              />
            </button>
            {isOpen && (
              <div className="border-t border-border bg-secondary/30 px-5 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">
                    {e.desc}
                  </span>
                  <button
                    onClick={() => run(e)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-virio-emerald px-3 py-1.5 text-[12px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90"
                  >
                    {running === e.path ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    Try it
                  </button>
                </div>
                {done.has(e.path) && running !== e.path && (
                  <div className="mt-3 rounded-md border border-[#1c1f26] bg-[#0B0D10]">
                    <div className="border-b border-white/[0.06] px-3 py-1.5 font-mono text-[10.5px] text-white/45">
                      200 OK · application/json
                    </div>
                    <pre className="code-shell overflow-x-auto p-3 text-[#E0B872]">
                      {JSON.stringify(e.response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- code examples ---------- */

const EXAMPLE_TABS: CodeTab[] = [
  {
    label: "React",
    language: "tsx",
    filename: "Subscribe.tsx",
    code: `import { useVirioCheckout } from "@virio/react";

export function Subscribe({ planId }: { planId: string }) {
  const { subscribe, status } = useVirioCheckout(planId);
  return (
    <button onClick={subscribe} disabled={status === "pending"}>
      {status === "active" ? "Subscribed" : "Subscribe — $49/mo"}
    </button>
  );
}`,
  },
  {
    label: "Next.js",
    language: "ts",
    filename: "app/api/webhooks/route.ts",
    code: `import { virio } from "@/lib/virio";

export async function POST(req: Request) {
  const event = virio.webhooks.verify(
    await req.text(),
    req.headers.get("virio-signature")!,
  );
  if (event.type === "subscription.charged") {
    await grantAccess(event.data.subscriptionId);
  }
  return new Response(null, { status: 200 });
}`,
  },
  {
    label: "Solidity",
    language: "sol",
    filename: "Integration.sol",
    code: `import { IVirioManager } from "@virio/contracts/IVirioManager.sol";

contract MyApp {
    IVirioManager constant VIRIO =
        IVirioManager(0x9d0e4e88A2b3C4d5E6F7a8B9c0D1e2F3A8b97f12);

    function onCharged(bytes32 agreementId) external {
        require(msg.sender == address(VIRIO), "not virio");
        // grant access, mint, etc.
    }
}`,
  },
  {
    label: "Webhook",
    language: "json",
    filename: "subscription.charged.json",
    code: `{
  "id": "evt_91a2",
  "type": "subscription.charged",
  "created": 1715731200,
  "data": {
    "subscriptionId": "sub_0x8f3c2a4c",
    "amount": "49.00",
    "token": "USDC",
    "txHash": "0x9d0e…4e88"
  }
}`,
  },
];

const EVENT_SCHEMA = [
  { event: "subscription.charged", when: "A recurring charge settles" },
  { event: "subscription.failed", when: "A charge reverts onchain" },
  { event: "subscription.cancelled", when: "An agreement is cancelled" },
  { event: "payroll.executed", when: "A payroll run completes" },
  { event: "executor.reward.paid", when: "An executor is paid its fee" },
];

const LIFECYCLE = [
  { label: "create", desc: "Product / payroll defined" },
  { label: "approve", desc: "Customer signs once" },
  { label: "schedule", desc: "Agreement becomes due" },
  { label: "execute", desc: "Executor triggers settlement" },
  { label: "settle", desc: "Fees split, funds delivered" },
];

const SDKS = [
  { name: "@virio/sdk", desc: "Core TypeScript SDK", size: "18 kB" },
  { name: "@virio/react", desc: "React hooks & components", size: "9 kB" },
  { name: "@virio/contracts", desc: "Solidity interfaces & ABIs", size: "—" },
];

export function DevView() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-24 pt-28 sm:px-8">
      {/* header */}
      <Reveal>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          <Code2 className="h-3.5 w-3.5" strokeWidth={1.5} />
          developer portal
        </span>
        <h1 className="mt-5 max-w-[640px] font-display text-[clamp(2rem,4.5vw,3rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground">
          everything you need to build with virio
        </h1>
        <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-muted-foreground">
          SDKs, interactive API references, event schemas, and copy-paste
          examples. ship onchain billing without becoming a payments team.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/docs"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-virio-emerald px-5 text-[14px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90"
          >
            read the docs
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-border bg-card px-5 text-[14px] font-medium text-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))]"
          >
            <Terminal className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            open testing suite
          </Link>
        </div>
      </Reveal>

      {/* quickstart */}
      <Reveal className="mt-14" delay={60}>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground">
              Quickstart
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Install a package, drop in your key, and make your first call.
              Every SDK is typed end-to-end and tree-shakeable.
            </p>
            <div className="mt-5 space-y-2.5">
              {SDKS.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
                    <Boxes className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <code className="font-mono text-[12.5px] font-semibold text-foreground">
                      {s.name}
                    </code>
                    <div className="text-[11.5px] text-muted-foreground">
                      {s.desc}
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {s.size}
                  </span>
                  <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <CodeWindow
            tabs={[
              {
                label: "Install",
                language: "bash",
                code: "npm install @virio/sdk @virio/react\n\n# then set your key\nexport VIRIO_KEY=pk_test_8f3c2a4c91d4e2a7b6c5d8e9",
              },
              {
                label: "First call",
                language: "ts",
                filename: "index.ts",
                code: `import { Virio } from "@virio/sdk";

const virio = new Virio({ apiKey: process.env.VIRIO_KEY });

const plan = await virio.products.create({
  name: "Pro",
  price: 49,
  token: "USDC",
  interval: "month",
});

console.log("created", plan.id);`,
              },
            ]}
          />
        </div>
      </Reveal>

      {/* API keys + reference */}
      <Reveal className="mt-14" delay={60}>
        <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground">
          Keys &amp; API reference
        </h2>
        <p className="mt-2 max-w-[560px] text-[14px] leading-relaxed text-muted-foreground">
          Manage keys, copy your environment variables, and try every endpoint
          live — responses are returned inline.
        </p>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <ApiKeysPanel />
          <ApiReference />
        </div>
      </Reveal>

      {/* examples */}
      <Reveal className="mt-14" delay={60}>
        <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground">
          Copy-paste examples
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          React, Next.js, Solidity, and webhook payloads — ready to drop in.
        </p>
        <div className="mt-5">
          <CodeWindow tabs={EXAMPLE_TABS} />
        </div>
      </Reveal>

      {/* lifecycle + event schema */}
      <Reveal className="mt-14" delay={60}>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground">
              Execution lifecycle
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Every subscription and payroll run follows the same five stages.
            </p>
            <div className="mt-5 space-y-2">
              {LIFECYCLE.map((s, i) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg border border-border bg-secondary font-mono text-[12px] font-semibold text-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5">
                    <code className="font-mono text-[12.5px] font-semibold text-foreground">
                      {s.label}
                    </code>
                    <span className="ml-2 text-[12.5px] text-muted-foreground">
                      {s.desc}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-display text-[20px] font-bold tracking-tight text-foreground">
              Event schemas
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Webhook event types delivered to your endpoint.
            </p>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card">
              {EVENT_SCHEMA.map((e) => (
                <div
                  key={e.event}
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
                >
                  <Webhook className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <code className="font-mono text-[12px] text-foreground">
                    {e.event}
                  </code>
                  <span className="ml-auto text-right text-[12px] text-muted-foreground">
                    {e.when}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* cta */}
      <Reveal className="mt-16" delay={60}>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-secondary/40 p-8 text-center sm:flex-row sm:text-left">
          <div className="flex-1">
            <h3 className="font-display text-[17px] font-bold text-foreground">
              Ready to go live?
            </h3>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Spin up the dashboard, create a product, and start settling
              onchain.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-virio-emerald px-5 text-[14px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90"
          >
            launch dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
