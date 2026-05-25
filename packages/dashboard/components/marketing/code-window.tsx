"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { highlight } from "@/lib/highlight";

export interface CodeTab {
  label: string;
  language: string;
  filename?: string;
  code: string;
}

interface Props {
  tabs: CodeTab[];
  className?: string;
}

export function CodeWindow({ tabs, className }: Props) {
  const [active, setActive] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const tab = tabs[active];

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[#1c1f26] bg-[#0B0D10] shadow-e2",
        className,
      )}
    >
      {/* chrome + tabs */}
      <div className="flex items-center gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setActive(i)}
              className={cn(
                "whitespace-nowrap rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                i === active
                  ? "bg-white/10 text-white"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-white/60 transition-colors hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>

      {tab.filename && (
        <div className="border-b border-white/6 px-4 py-1.5 font-mono text-[10.5px] text-white/35">
          {tab.filename}
        </div>
      )}

      {/* code */}
      <pre className="code-shell overflow-x-auto px-4 py-4 text-white/85">
        <code className="table w-full">
          {tab.code.split("\n").map((line, i) => (
            <div key={i} className="table-row">
              <span className="table-cell select-none pr-4 text-right align-top text-white/20">
                {i + 1}
              </span>
              <span className="table-cell whitespace-pre align-top">
                {highlight(line, tab.language)}
              </span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
