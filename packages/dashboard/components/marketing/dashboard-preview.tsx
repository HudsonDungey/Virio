"use client";

import * as React from "react";
import {
  Activity,
  ArrowUpRight,
  CreditCard,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/// A faux Virio dashboard rendered for the marketing hero. Everything is
/// static / animated locally — no data fetching — so it can ship on a
/// static page.

const SPARK = [
  18, 22, 19, 27, 31, 26, 34, 30, 38, 44, 40, 49, 46, 55, 52, 61, 58, 67, 72, 69,
  78, 85, 81, 92,
];

function Sparkline() {
  const w = 520;
  const h = 150;
  const pad = 6;
  const max = Math.max(...SPARK);
  const min = Math.min(...SPARK);
  const xs = (i: number) => pad + (i * (w - pad * 2)) / (SPARK.length - 1);
  const ys = (v: number) =>
    h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = SPARK.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  const area = `${line} L${xs(SPARK.length - 1)},${h} L${xs(0)},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3DD9A4" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#3DD9A4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hero-area)" />
      <path
        d={line}
        fill="none"
        stroke="#3DD9A4"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 2000,
          strokeDashoffset: 2000,
          animation: "dash 2.4s cubic-bezier(0.16,1,0.3,1) 0.3s forwards",
        }}
      />
      <style>{`@keyframes dash{to{stroke-dashoffset:0}}`}</style>
    </svg>
  );
}

const STATS = [
  { label: "total balance", value: "$2,481,920", delta: "+12.4%", icon: Wallet },
  { label: "active subs", value: "18,204", delta: "+3.1%", icon: Users },
  { label: "payroll volume", value: "$840,210", delta: "+8.7%", icon: CreditCard },
];

const FEED = [
  { who: "0x8f…2a4c", what: "subscription charge", amt: "+$49.00", ok: true },
  { who: "0x1b…9d0e", what: "payroll execution", amt: "+$3,200.00", ok: true },
  { who: "0xa3…7f12", what: "protocol fee", amt: "+$0.42", ok: true },
  { who: "0xc7…4e88", what: "retrying settlement", amt: "$129.00", ok: false },
];

export function DashboardPreview() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-e2">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground">
          <span className="status-dot" style={{ width: 5, height: 5 }} />
          app.virio.xyz/dashboard
        </span>
      </div>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[150px_1fr]">
        {/* mini sidebar */}
        <div className="hidden flex-col gap-1 border-r border-border bg-secondary/40 p-3 sm:flex">
          {["overview", "payroll", "products", "subscriptions", "testing"].map(
            (l, i) => (
              <div
                key={l}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-[11.5px] font-medium",
                  i === 0
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i === 0 ? "bg-virio-emerald" : "bg-muted-foreground/40",
                  )}
                />
                {l}
              </div>
            ),
          )}
        </div>

        {/* content */}
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-3 gap-2.5">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="animate-fade-up rounded-lg border border-border bg-background p-3"
                style={{ animationDelay: `${0.15 + i * 0.08}s` }}
              >
                <div className="flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
                  <s.icon className="h-3 w-3" strokeWidth={1.5} />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="mt-1.5 font-display text-[15px] font-semibold tabular-nums tracking-[-0.025em] text-foreground">
                  {s.value}
                </div>
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-virio-emerald">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="animate-fade-up rounded-lg border border-border bg-background p-3 animation-delay-300">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                revenue
              </div>
              <div className="flex gap-1">
                {["1D", "1W", "1M", "1Y"].map((r, i) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-medium",
                      i === 2
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-[110px]">
              <Sparkline />
            </div>
          </div>

          <div className="animate-fade-up rounded-lg border border-border bg-background p-3 animation-delay-400">
            <div className="mb-1.5 text-[11px] font-medium text-foreground">
              live activity
            </div>
            <div className="space-y-1">
              {FEED.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md px-1.5 py-1.5 text-[11px] animate-ticker-up"
                  style={{ animationDelay: `${0.6 + i * 0.1}s` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        f.ok ? "bg-virio-emerald" : "bg-amber-500",
                      )}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {f.who}
                    </span>
                    <span className="text-foreground">{f.what}</span>
                  </div>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      f.ok ? "text-virio-emerald" : "text-amber-500",
                    )}
                  >
                    {f.amt}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
