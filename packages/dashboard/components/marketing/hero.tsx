"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { DashboardPreview } from "./dashboard-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 sm:pt-32 lg:pt-40">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-fade opacity-50" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <div className="flex justify-center">
          <Link
            href="/docs"
            className="group inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <span className="status-dot" />
            programmable billing v2 is live
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <h1 className="mx-auto mt-7 max-w-[920px] animate-fade-up text-balance text-center font-display text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-foreground animation-delay-100">
          recurring payments for{" "}
          <span className="text-virio-emerald">programmable money</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-[600px] animate-fade-up text-balance text-center text-[16px] leading-relaxed text-muted-foreground animation-delay-200">
          wallet-native subscriptions, automated payroll, and stablecoin
          billing infrastructure. settled onchain, executed autonomously.
        </p>

        <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 animation-delay-300 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-virio-emerald px-5 text-[14px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90 sm:w-auto"
          >
            start building
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-card px-5 text-[14px] font-semibold text-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))] sm:w-auto"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            read the docs
          </Link>
        </div>

        <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground animation-delay-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="status-dot" />
            live on testnet
          </span>
        </div>

        <div className="relative mx-auto mt-16 max-w-[1040px] animate-fade-up animation-delay-500">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
