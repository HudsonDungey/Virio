"use client";

import * as React from "react";
import Link from "next/link";
import { X, ArrowRight } from "lucide-react";

export function SeedBanner() {
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) return null;

  return (
    <div className="relative z-50 w-full bg-virio-emerald px-4 py-2.5">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
        <div className="flex flex-1 items-center justify-center gap-2 text-center text-[13px] font-medium text-virio-emerald-ink">
          <span className="font-semibold">Seed round open</span>
          <span className="hidden opacity-70 sm:inline">·</span>
          <span className="hidden sm:inline opacity-90">Raising $200k at a $5M valuation</span>
          <Link
            href="/virio#invest"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
          >
            Learn more
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="flex-shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4 text-virio-emerald-ink" />
        </button>
      </div>
    </div>
  );
}
