"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { fmt$ } from "@/lib/format";
import { cn } from "@/lib/utils";

type Range = "1d" | "1w" | "1m" | "1y";

const RANGES: { key: Range; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "1y", label: "1Y" },
];

interface IncomePoint {
  t: number;
  income: number;
  gross: number;
  count: number;
}
interface IncomeSeries {
  range: Range;
  bucketSeconds: number;
  points: IncomePoint[];
}

const WIDTH = 1080;
const HEIGHT = 240;
const PAD = { top: 16, right: 24, bottom: 28, left: 56 };

export function IncomeChart() {
  const [range, setRange] = React.useState<Range>("1d");
  const [series, setSeries] = React.useState<IncomeSeries | null>(null);
  const [hover, setHover] = React.useState<{ x: number; y: number; i: number } | null>(null);

  const fetchSeries = React.useCallback(async (r: Range) => {
    try {
      const s = await api<IncomeSeries>("GET", `/api/income-series?range=${r}`);
      setSeries(s);
    } catch {
      setSeries(null);
    }
  }, []);

  // Fetch once when the range changes; no polling.
  React.useEffect(() => {
    fetchSeries(range);
  }, [range, fetchSeries]);

  // Geometry
  const points = series?.points ?? [];
  const max = Math.max(1, ...points.map((p) => p.income));
  const niceMax = niceCeil(max);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const xFor = (i: number) =>
    PAD.left + (points.length <= 1 ? innerW / 2 : (i * innerW) / (points.length - 1));
  const yFor = (v: number) =>
    PAD.top + innerH - (v / niceMax) * innerH;

  // Line + area paths
  const linePath = points.length === 0
    ? ""
    : points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(p.income).toFixed(2)}`).join(" ");
  const areaPath = points.length === 0
    ? ""
    : `${linePath} L${xFor(points.length - 1).toFixed(2)},${(PAD.top + innerH).toFixed(2)} L${xFor(0).toFixed(2)},${(PAD.top + innerH).toFixed(2)} Z`;

  const total = points.reduce((s, p) => s + p.income, 0);
  const peak = points.reduce((m, p) => (p.income > m.income ? p : m), points[0] ?? { t: 0, income: 0, gross: 0, count: 0 });

  // X-axis ticks: 6 evenly-spaced labels.
  const tickCount = 6;
  const tickIdx = points.length === 0
    ? []
    : Array.from({ length: tickCount }, (_, k) =>
        Math.round((k * (points.length - 1)) / (tickCount - 1)),
      );

  // Y-axis grid lines: 4 lines + zero.
  const yTicks = 4;
  const yGrid = Array.from({ length: yTicks + 1 }, (_, k) => (niceMax * k) / yTicks);

  // Hover handling: map mouseX → nearest bucket index.
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const rel = px - PAD.left;
    const idx = Math.min(
      points.length - 1,
      Math.max(0, Math.round((rel * (points.length - 1)) / innerW)),
    );
    setHover({ x: xFor(idx), y: yFor(points[idx].income), i: idx });
  }
  function onLeave() {
    setHover(null);
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex w-full flex-wrap items-end justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <CardTitle>Income</CardTitle>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Merchant net per {bucketLabel(range)} · last {rangeLabel(range)}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <div className="font-display text-[22px] font-semibold tabular-nums text-foreground sm:text-[26px]">{fmt$(total)}</div>
              {peak && peak.income > 0 && (
                <div className="text-[12px] text-muted-foreground">
                  peak <span className="font-medium text-foreground">{fmt$(peak.income)}</span> @ {fmtBucketTime(peak.t, range)}
                </div>
              )}
            </div>
          </div>
          <div className="inline-flex h-8 items-center rounded-md border border-border bg-secondary p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "h-7 px-3 text-[12px] font-medium rounded-[5px] transition-colors",
                  range === r.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <div className="px-2 pb-4">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          role="img"
          aria-label="Income chart"
        >
          <defs>
            <linearGradient id="incomeArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="rgb(16,185,129)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y grid + labels */}
          {yGrid.map((v, i) => {
            const y = yFor(v);
            return (
              <g key={i}>
                <line
                  x1={PAD.left}
                  x2={WIDTH - PAD.right}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeDasharray={i === 0 ? "" : "3 4"}
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize="11"
                  className="fill-muted-foreground"
                >
                  {fmtAxisMoney(v)}
                </text>
              </g>
            );
          })}

          {/* Area under line */}
          {points.length > 0 && (
            <path d={areaPath} fill="url(#incomeArea)" />
          )}
          {/* Line */}
          {points.length > 0 && (
            <path
              d={linePath}
              fill="none"
              stroke="rgb(16,185,129)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* X tick labels */}
          {tickIdx.map((idx, k) => {
            const p = points[idx];
            if (!p) return null;
            return (
              <text
                key={k}
                x={xFor(idx)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="11"
                className="fill-muted-foreground"
              >
                {fmtBucketTime(p.t, range)}
              </text>
            );
          })}

          {/* Hover indicator */}
          {hover && points[hover.i] && (
            <g>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={PAD.top}
                y2={PAD.top + innerH}
                className="stroke-muted-foreground"
                strokeDasharray="3 3"
              />
              <circle
                cx={hover.x}
                cy={hover.y}
                r={4}
                className="fill-background"
                stroke="rgb(16,185,129)"
                strokeWidth={2}
              />
            </g>
          )}

          {/* Empty-state */}
          {points.length === 0 && (
            <text
              x={WIDTH / 2}
              y={HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12"
              className="fill-muted-foreground"
            >
              No income yet — create a plan and subscribe to start
            </text>
          )}
        </svg>

        {/* Tooltip below SVG so it doesn't get clipped */}
        {hover && points[hover.i] && (
          <div
            className="pointer-events-none -mt-2 ml-2 inline-block rounded-md border border-border bg-popover px-3 py-1.5 text-[12px] shadow-lift"
            style={{
              transform: `translateX(${Math.max(0, hover.x - 70)}px)`,
              transition: "transform 60ms ease",
            }}
          >
            <div className="font-medium text-foreground">{fmt$(points[hover.i].income)}</div>
            <div className="text-muted-foreground">
              {fmtBucketRange(points[hover.i].t, range)} · {points[hover.i].count} charge{points[hover.i].count === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bucketLabel(r: Range) {
  return r === "1d" ? "hour" : r === "1y" ? "month" : "day";
}
function rangeLabel(r: Range) {
  return r === "1d" ? "24h" : r === "1w" ? "7 days" : r === "1m" ? "30 days" : "12 months";
}
function fmtBucketTime(t: number, r: Range): string {
  const d = new Date(t * 1000);
  if (r === "1d") {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (r === "1y") {
    return d.toLocaleDateString([], { month: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function fmtBucketRange(t: number, r: Range): string {
  const d = new Date(t * 1000);
  if (r === "1d") {
    const next = new Date((t + 3600) * 1000);
    return `${d.toLocaleTimeString([], { hour: "numeric" })}–${next.toLocaleTimeString([], { hour: "numeric" })}`;
  }
  if (r === "1y") {
    return d.toLocaleDateString([], { month: "long", year: "numeric" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function fmtAxisMoney(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
  if (v >= 10) return `$${v.toFixed(0)}`;
  if (v === 0) return "$0";
  return `$${v.toFixed(2)}`;
}
/// Round `n` up to a "nice" axis maximum (1/2/2.5/5 × 10^k).
function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const frac = n / base;
  let nice: number;
  if (frac <= 1) nice = 1;
  else if (frac <= 2) nice = 2;
  else if (frac <= 2.5) nice = 2.5;
  else if (frac <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
