"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/// Hand-rolled SVG charts — themeable, animated, dependency-free. Used across the
/// dashboard for compact analytics where a full charting lib would be overkill.

/// Hydration-safe, CSS-safe unique id for SVG gradient refs.
function useChartId(prefix: string) {
  const raw = React.useId();
  return React.useMemo(() => `${prefix}-${raw.replace(/:/g, "")}`, [prefix, raw]);
}

interface AreaChartProps {
  data: number[];
  height?: number;
  className?: string;
  color?: string;
  /// optional labels rendered under the x-axis
  labels?: string[];
}

export function AreaChart({
  data,
  height = 200,
  className,
  color = "#3DD9A4",
  labels,
}: AreaChartProps) {
  const id = useChartId("area");
  const w = 600;
  const h = height;
  const pad = { t: 12, r: 8, b: labels ? 22 : 8, l: 8 };
  const [hover, setHover] = React.useState<number | null>(null);

  const max = Math.max(1, ...data);
  const min = Math.min(0, ...data);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const xs = (i: number) =>
    pad.l + (data.length <= 1 ? innerW / 2 : (i * innerW) / (data.length - 1));
  const ys = (v: number) => pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  const area = data.length
    ? `${line} L${xs(data.length - 1)},${pad.t + innerH} L${xs(0)},${pad.t + innerH} Z`
    : "";

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * w;
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.round(((px - pad.l) * (data.length - 1)) / innerW)),
    );
    setHover(idx);
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn("w-full", className)}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      role="img"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + innerH * f}
          y2={pad.t + innerH * f}
          className="stroke-border"
          strokeDasharray="3 5"
          strokeWidth={1}
        />
      ))}
      {area && <path d={area} fill={`url(#${id})`} />}
      {line && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 1600,
            strokeDashoffset: 1600,
            animation: "dash 1.6s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        />
      )}
      {hover !== null && data[hover] !== undefined && (
        <g>
          <line
            x1={xs(hover)}
            x2={xs(hover)}
            y1={pad.t}
            y2={pad.t + innerH}
            className="stroke-muted-foreground"
            strokeDasharray="3 3"
          />
          <circle
            cx={xs(hover)}
            cy={ys(data[hover])}
            r={4}
            className="fill-background"
            stroke={color}
            strokeWidth={2}
          />
        </g>
      )}
      {labels &&
        labels.map((l, i) => (
          <text
            key={i}
            x={xs(i)}
            y={h - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize="10"
          >
            {l}
          </text>
        ))}
      <style>{`@keyframes dash{to{stroke-dashoffset:0}}`}</style>
    </svg>
  );
}

interface BarChartProps {
  data: number[];
  labels?: string[];
  height?: number;
  className?: string;
  color?: string;
}

export function BarChart({
  data,
  labels,
  height = 200,
  className,
  color = "#3DD9A4",
}: BarChartProps) {
  const w = 600;
  const h = height;
  const pad = { t: 12, r: 8, b: labels ? 22 : 8, l: 8 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(1, ...data);
  const gap = 8;
  const bw = (innerW - gap * (data.length - 1)) / data.length;
  const [hover, setHover] = React.useState<number | null>(null);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("w-full", className)} role="img">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={pad.t + innerH * f}
          y2={pad.t + innerH * f}
          className="stroke-border"
          strokeDasharray="3 5"
          strokeWidth={1}
        />
      ))}
      {data.map((v, i) => {
        const bh = (v / max) * innerH;
        const x = pad.l + i * (bw + gap);
        const y = pad.t + innerH - bh;
        return (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={x}
              y={pad.t}
              width={bw}
              height={innerH}
              fill="transparent"
            />
            <rect
              x={x}
              y={y}
              width={bw}
              height={bh}
              rx={Math.min(4, bw / 3)}
              fill={color}
              opacity={hover === null || hover === i ? 1 : 0.4}
              style={{
                transformOrigin: `${x + bw / 2}px ${pad.t + innerH}px`,
                animation: `barGrow 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`,
              }}
            />
            {labels && (
              <text
                x={x + bw / 2}
                y={h - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="10"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
      <style>{`@keyframes barGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}`}</style>
    </svg>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 160,
  thickness = 22,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-border"
          strokeWidth={thickness}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
          );
          offset += len;
          return el;
        })}
      </g>
    </svg>
  );
}

export function Sparkline({
  data,
  className,
  color = "#3DD9A4",
}: {
  data: number[];
  className?: string;
  color?: string;
}) {
  const w = 120;
  const h = 32;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const xs = (i: number) => (i * w) / (data.length - 1 || 1);
  const ys = (v: number) => h - 2 - ((v - min) / (max - min || 1)) * (h - 4);
  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-8 w-full", className)}>
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
