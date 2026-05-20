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

/// A faux Virio dashboard rendered for the marketing hero. Everything is static /
/// animated locally — no data fetching — so it can ship on a static page.

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
          <stop offset="0%" stopColor="#635bff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#635bff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="hero-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8b85ff" />
          <stop offset="100%" stopColor="#0a84ff" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hero-area)" />
      <path
        d={line}
        fill="none"
        stroke="url(#hero-line)"
        strokeWidth="2.5"
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
  { label: "Total balance", value: "$2,481,920", delta: "+12.4%", icon: Wallet },
  { label: "Active subs", value: "18,204", delta: "+3.1%", icon: Users },
  { label: "Payroll volume", value: "$840,210", delta: "+8.7%", icon: CreditCard },
];

const FEED = [
  { who: "0x8f…2a4c", what: "Subscription charge", amt: "+$49.00", ok: true },
  { who: "0x1b…9d0e", what: "Payroll execution", amt: "+$3,200.00", ok: true },
  { who: "0xa3…7f12", what: "Protocol fee", amt: "+$0.42", ok: true },
  { who: "0xc7…4e88", what: "Retrying settlement", amt: "$129.00", ok: false },
];

export function DashboardPreview() {
  return (
    <div className="ring-gradient relative overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-[10.5px] font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          app.virio.xyz/dashboard
        </span>
      </div>

      <div className="grid grid-cols-1 gap-0 sm:grid-cols-[150px_1fr]">
        {/* mini sidebar */}
        <div className="hidden flex-col gap-1 border-r border-border bg-secondary/40 p-3 sm:flex">
          {["Overview", "Payroll", "Products", "Subscriptions", "Testing"].map(
            (l, i) => (
              <div
                key={l}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[11.5px] font-medium",
                  i === 0
                    ? "bg-brand-500/10 text-brand-600 dark:text-brand-300"
                    : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i === 0 ? "bg-brand-500" : "bg-muted-foreground/40",
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
                className="animate-fade-up rounded-xl border border-border bg-background p-3"
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                <div className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <s.icon className="h-3 w-3 text-brand-500" />
                  <span className="truncate">{s.label}</span>
                </div>
                <div className="mt-1.5 font-display text-[15px] font-bold tabular-nums text-foreground">
                  {s.value}
                </div>
                <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-500">
                  <ArrowUpRight className="h-2.5 w-2.5" />
                  {s.delta}
                </div>
              </div>
            ))}
          </div>

          <div className="animate-fade-up rounded-xl border border-border bg-background p-3 animation-delay-300">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Activity className="h-3.5 w-3.5 text-brand-500" />
                Revenue
              </div>
              <div className="flex gap-1">
                {["1D", "1W", "1M", "1Y"].map((r, i) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[9px] font-medium",
                      i === 2
                        ? "bg-brand-500/10 text-brand-600 dark:text-brand-300"
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

          <div className="animate-fade-up rounded-xl border border-border bg-background p-3 animation-delay-400">
            <div className="mb-1.5 text-[11px] font-semibold text-foreground">
              Live activity
            </div>
            <div className="space-y-1">
              {FEED.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-1.5 py-1.5 text-[11px] animate-ticker-up"
                  style={{ animationDelay: `${0.6 + i * 0.12}s` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        f.ok ? "bg-emerald-500" : "bg-amber-500",
                      )}
                    />
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {f.who}
                    </span>
                    <span className="text-foreground">{f.what}</span>
                  </div>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      f.ok ? "text-emerald-500" : "text-amber-500",
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
