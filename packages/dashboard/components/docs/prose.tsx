import * as React from "react";
import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

/* ───────────────────────── headings ───────────────────────── */

function Anchor({ id }: { id: string }) {
  return (
    <a
      href={`#${id}`}
      aria-label="Link to this section"
      className="ml-2 inline-flex -translate-y-px opacity-0 transition-opacity group-hover:opacity-100"
    >
      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-[32px] font-bold leading-tight tracking-tight text-foreground">
      {children}
    </h1>
  );
}

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-12 scroll-mt-28 border-t border-border pt-8 font-display text-[22px] font-bold tracking-tight text-foreground"
    >
      {children}
      <Anchor id={id} />
    </h2>
  );
}

export function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="group mt-8 scroll-mt-28 font-display text-[16.5px] font-bold tracking-tight text-foreground"
    >
      {children}
      <Anchor id={id} />
    </h3>
  );
}

export function H4({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h4
      id={id}
      className="group mt-6 scroll-mt-28 font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
    >
      {children}
    </h4>
  );
}

/* ───────────────────────── text ───────────────────────── */

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[14.5px] leading-[1.7] text-muted-foreground">{children}</p>
  );
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="mt-4 space-y-2">{children}</ul>;
}

export function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="mt-4 space-y-2">{children}</ol>;
}

export function Li({
  children,
  ordered,
  index,
}: {
  children: React.ReactNode;
  ordered?: boolean;
  index?: number;
}) {
  return (
    <li className="flex gap-3 text-[14.5px] leading-[1.7] text-muted-foreground">
      {ordered ? (
        <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-[11px] font-semibold text-foreground">
          {(index ?? 0) + 1}
        </span>
      ) : (
        <span className="mt-[9px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground/50" />
      )}
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = /^https?:\/\//.test(href);
  const className =
    "font-medium text-virio-emerald underline decoration-virio-emerald/30 underline-offset-2 transition-colors hover:decoration-virio-emerald";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

export function Em({ children }: { children: React.ReactNode }) {
  return <em className="italic">{children}</em>;
}

export function Hr() {
  return <hr className="my-10 border-border" />;
}

/* ───────────────────────── callout ───────────────────────── */

type CalloutVariant = "info" | "note" | "warning" | "success";

const CALLOUT_STYLES: Record<CalloutVariant, string> = {
  info: "border-virio-emerald/30 bg-virio-emerald/[0.06]",
  note: "border-border bg-secondary/60",
  warning: "border-warning/40 bg-warning/[0.08]",
  success: "border-success/40 bg-success/[0.08]",
};

export function Callout({
  variant = "info",
  children,
}: {
  variant?: CalloutVariant;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-6 rounded-xl border p-4 text-[13.5px] leading-relaxed text-foreground [&>p:first-child]:mt-0",
        CALLOUT_STYLES[variant],
      )}
    >
      {children}
    </div>
  );
}

/* ───────────────────────── table ───────────────────────── */

export function Table({
  head,
  rows,
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-border bg-secondary/50">
            {head.map((cell, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-4 py-2.5 font-semibold text-foreground"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-b border-border/60 last:border-0">
              {row.map((cell, c) => (
                <td key={c} className="px-4 py-2.5 align-top text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
