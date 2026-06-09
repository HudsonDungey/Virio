"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";

export function SeedBanner() {
  return (
    <Link
      href="/virio#invest"
      className="group inline-flex items-center gap-2 rounded-full border border-virio-emerald/40 bg-virio-emerald/10 px-4 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:border-virio-emerald/70 hover:bg-virio-emerald/15"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full bg-virio-emerald px-2 py-0.5 text-[11px] font-semibold text-virio-emerald-ink">
        <Coins className="h-3 w-3" />
        Seed Round
      </span>
      <span>Raising $1M at a $15M FDV — Token Warrants (SAFT)</span>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
