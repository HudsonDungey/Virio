"use client";

import * as React from "react";
import { Reveal } from "./reveal";

interface Metric {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
}

const METRICS: Metric[] = [
  { value: 18, suffix: "k+", label: "Active businesses" },
  { value: 99.99, suffix: "%", decimals: 2, label: "Executor uptime" },
  { value: 0.8, suffix: "s", decimals: 1, label: "Avg settlement" },
];

function Counter({ metric }: { metric: Metric }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [val, setVal] = React.useState(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const dur = 1400;
        const step = (now: number) => {
          const t = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - t, 3);
          setVal(metric.value * eased);
          if (t < 1) raf = requestAnimationFrame(step);
          else setVal(metric.value);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [metric.value]);

  return (
    <div ref={ref}>
      <div className="font-display text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold tracking-tight text-foreground tabular-nums">
        {metric.prefix}
        {val.toFixed(metric.decimals ?? 0)}
        {metric.suffix}
      </div>
      <div className="mt-1 text-[13px] text-muted-foreground">{metric.label}</div>
    </div>
  );
}

export function Metrics() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal>
          <div className="grid grid-cols-1 gap-6 rounded-3xl border border-border bg-card p-8 shadow-soft sm:grid-cols-3 sm:p-10">
            {METRICS.map((m) => (
              <Counter key={m.label} metric={m} />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
