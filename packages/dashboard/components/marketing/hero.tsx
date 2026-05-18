"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { DashboardPreview } from "./dashboard-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-24 sm:pt-32 lg:pt-40">
      {/* backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 grid-fade opacity-70" />
        <div className="absolute left-1/2 top-[-180px] h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(99,91,255,0.28),transparent_65%)] blur-3xl" />
        <div className="absolute left-[12%] top-[120px] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(10,132,255,0.22),transparent_70%)] blur-3xl animate-float-slow" />
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        {/* eyebrow */}
        <div className="flex justify-center">
          <Link
            href="/docs"
            className="group inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium text-muted-foreground shadow-soft backdrop-blur transition-colors hover:border-brand-400"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[11px] font-semibold text-white">
              <Sparkles className="h-3 w-3" />
              New
            </span>
            Programmable billing v2 is live
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* headline */}
        <h1 className="mx-auto mt-7 max-w-[920px] animate-fade-up text-balance text-center font-display text-[clamp(2.5rem,6vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-foreground animation-delay-100">
          Onchain subscriptions &amp;{" "}
          <span className="text-gradient">payroll infrastructure</span>.
        </h1>

        <p className="mx-auto mt-6 max-w-[620px] animate-fade-up text-balance text-center text-[16.5px] leading-relaxed text-muted-foreground animation-delay-200">
          Recurring crypto payments, automated payroll, and programmable billing
          for modern internet businesses. The settlement layer for the onchain
          economy.
        </p>

        {/* CTAs */}
        <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 animation-delay-300 sm:flex-row">
          <Link
            href="/dashboard"
            className="btn-sheen group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-brand-gradient px-7 text-[15px] font-semibold text-white shadow-brand transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-brand-lg sm:w-auto"
          >
            <span className="relative z-[2]">Start Building</span>
            <ArrowRight className="relative z-[2] h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/docs"
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-7 text-[15px] font-semibold text-foreground shadow-soft transition-all duration-200 ease-soft hover:-translate-y-0.5 hover:border-brand-400 sm:w-auto"
          >
            <BookOpen className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand-500" />
            View Docs
          </Link>
        </div>

        {/* trust line */}
        <div className="mt-6 flex animate-fade-up flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground animation-delay-400">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Audited contracts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-brand-500" />
            Sub-second settlement
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-electric-500" />
            No monthly fees
          </span>
        </div>

        {/* preview */}
        <div className="relative mx-auto mt-16 max-w-[1040px] animate-fade-up animation-delay-500">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,rgba(99,91,255,0.22),transparent_60%)] blur-2xl" />

          {/* floating accent cards */}
          <div className="absolute -left-6 top-20 z-20 hidden animate-float rounded-xl border border-border bg-card p-3 shadow-lift lg:block">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Settlement
            </div>
            <div className="mt-1 font-display text-lg font-bold text-emerald-500">
              0.8s avg
            </div>
          </div>
          <div className="absolute -right-6 top-44 z-20 hidden animate-float rounded-xl border border-border bg-card p-3 shadow-lift animation-delay-300 lg:block">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Executor uptime
            </div>
            <div className="mt-1 font-display text-lg font-bold text-brand-500">
              99.99%
            </div>
          </div>

          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
