import * as React from "react";

/*
 * Hand-built, dependency-free SVG diagrams. Each is keyed by an id and embedded
 * from Markdown via a `:::diagram <id>` directive. Colors use CSS variables so
 * they adapt to light/dark automatically; the brand accent is #635bff.
 */

const FG = "hsl(var(--foreground))";
const MUTED = "hsl(var(--muted-foreground))";
const CARD = "hsl(var(--card))";
const BORDER = "hsl(var(--border))";
const BRAND = "#635bff";

function Box({
  x,
  y,
  w,
  h,
  title,
  subtitle,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  accent?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={12}
        fill={CARD}
        stroke={accent ? BRAND : BORDER}
        strokeWidth={accent ? 2 : 1}
      />
      <text
        x={x + w / 2}
        y={subtitle ? y + h / 2 - 6 : y + h / 2 + 4}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fontFamily="var(--font-inter-tight), system-ui"
        fill={accent ? BRAND : FG}
      >
        {title}
      </text>
      {subtitle && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 13}
          textAnchor="middle"
          fontSize={11}
          fontFamily="var(--font-mono), monospace"
          fill={MUTED}
        >
          {subtitle}
        </text>
      )}
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  label,
  dashed,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label?: string;
  dashed?: boolean;
}) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={BRAND}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "5 4" : undefined}
        markerEnd="url(#virio-arrow)"
      />
      {label && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          fontSize={10.5}
          fontFamily="var(--font-mono), monospace"
          fill={MUTED}
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Frame({
  viewBox,
  children,
  label,
}: {
  viewBox: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <figure className="mt-6 overflow-hidden rounded-2xl border border-border bg-secondary/30 p-4">
      <svg viewBox={viewBox} className="w-full" role="img" aria-label={label}>
        <defs>
          <marker
            id="virio-arrow"
            viewBox="0 0 10 10"
            refX={9}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={BRAND} />
          </marker>
        </defs>
        {children}
      </svg>
    </figure>
  );
}

/* ───────────────────────── diagrams ───────────────────────── */

function Architecture() {
  return (
    <Frame viewBox="0 0 720 300" label="Virio protocol architecture">
      <Box x={40} y={120} w={150} h={60} title="Customer Wallet" subtitle="holds USDC" />
      <Box
        x={285}
        y={110}
        w={170}
        h={80}
        title="SubscriptionManager"
        subtitle="onchain · audited"
        accent
      />
      <Box x={540} y={30} w={150} h={56} title="Merchant" subtitle="net amount" />
      <Box x={540} y={122} w={150} h={56} title="Executor" subtitle="0.1% fee" />
      <Box x={540} y={214} w={150} h={56} title="Protocol" subtitle="0.25% + flat" />
      <Arrow x1={190} y1={150} x2={285} y2={150} label="approve" />
      <Arrow x1={455} y1={140} x2={540} y2={64} label="transferFrom" />
      <Arrow x1={455} y1={150} x2={540} y2={150} />
      <Arrow x1={455} y1={160} x2={540} y2={236} />
    </Frame>
  );
}

function PaymentLifecycle() {
  const steps = [
    { t: "createPlan", s: "merchant" },
    { t: "approve", s: "customer" },
    { t: "subscribe", s: "customer" },
    { t: "charge", s: "executor · loops" },
    { t: "settle", s: "onchain split" },
  ];
  return (
    <Frame viewBox="0 0 760 120" label="Subscription payment lifecycle">
      {steps.map((step, i) => {
        const x = 12 + i * 150;
        return (
          <g key={step.t}>
            <Box x={x} y={32} w={120} h={56} title={step.t} subtitle={step.s} accent={i === 3} />
            {i < steps.length - 1 && (
              <Arrow x1={x + 120} y1={60} x2={x + 150} y2={60} />
            )}
          </g>
        );
      })}
    </Frame>
  );
}

function ExecutorFlow() {
  const steps = [
    { t: "tick()", s: "every ~60s" },
    { t: "getDue", s: "from storage" },
    { t: "charge()", s: "onchain tx" },
    { t: "earn fee", s: "0.1% gross" },
    { t: "webhook", s: "signed POST" },
  ];
  return (
    <Frame viewBox="0 0 760 120" label="Executor / scheduler flow">
      {steps.map((step, i) => {
        const x = 12 + i * 150;
        return (
          <g key={step.t}>
            <Box x={x} y={32} w={120} h={56} title={step.t} subtitle={step.s} accent={i === 2} />
            {i < steps.length - 1 && (
              <Arrow x1={x + 120} y1={60} x2={x + 150} y2={60} />
            )}
          </g>
        );
      })}
    </Frame>
  );
}

function SubscriptionStates() {
  return (
    <Frame viewBox="0 0 720 200" label="Subscription state transitions">
      <Box x={40} y={80} w={140} h={56} title="active" subtitle="chargeable" accent />
      <Box x={300} y={20} w={160} h={56} title="charge()" subtitle="nextChargeAt += period" />
      <Box x={300} y={130} w={160} h={56} title="cancelled" subtitle="inactive" />
      <Arrow x1={180} y1={100} x2={300} y2={48} label="due" />
      <Arrow x1={460} y1={48} x2={400} y2={48} dashed />
      <Arrow x1={400} y1={76} x2={300} y2={95} dashed label="loop" />
      <Arrow x1={180} y1={116} x2={300} y2={158} label="cancel / cap" />
      <Box x={540} y={20} w={150} h={56} title="cap exceeded" subtitle="auto-cancel" />
      <Arrow x1={460} y1={48} x2={540} y2={48} />
    </Frame>
  );
}

const DIAGRAMS: Record<string, () => React.ReactElement> = {
  architecture: Architecture,
  "payment-lifecycle": PaymentLifecycle,
  "executor-flow": ExecutorFlow,
  "subscription-states": SubscriptionStates,
};

export function Diagram({ id }: { id: string }) {
  const Component = DIAGRAMS[id];
  if (!Component) {
    return (
      <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-[13px] text-muted-foreground">
        Unknown diagram: <code className="font-mono">{id}</code>
      </div>
    );
  }
  return <Component />;
}
