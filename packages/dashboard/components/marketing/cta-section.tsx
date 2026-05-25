import * as React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Reveal } from "./reveal";

export function CtaSection() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-[1100px] px-5 sm:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[22px] border border-[#1c1f26] bg-[#0B0D10] px-6 py-16 text-center sm:px-12 sm:py-20">
            <div className="pointer-events-none absolute inset-0 opacity-[0.08]">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, #F5F7FA 1px, transparent 1px), linear-gradient(to bottom, #F5F7FA 1px, transparent 1px)",
                  backgroundSize: "56px 56px",
                  WebkitMaskImage:
                    "radial-gradient(ellipse 75% 60% at 50% 0%, #000 30%, transparent 75%)",
                  maskImage:
                    "radial-gradient(ellipse 75% 60% at 50% 0%, #000 30%, transparent 75%)",
                }}
              />
            </div>

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-white/70">
                <span className="status-dot" style={{ width: 6, height: 6 }} />
                live on testnet
              </span>
              <h2 className="mx-auto mt-5 max-w-[640px] text-balance font-display text-[clamp(1.9rem,4.2vw,3rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-white">
                start settling onchain in an afternoon
              </h2>
              <p className="mx-auto mt-4 max-w-[480px] text-balance text-[15px] leading-relaxed text-white/60">
                spin up products, payroll, and programmable billing with one SDK.
                no monthly fees — you only pay when you get paid.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-virio-emerald px-5 text-[14px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90 sm:w-auto"
                >
                  start building
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 bg-white/[0.04] px-5 text-[14px] font-medium text-white transition-colors duration-fast hover:bg-white/[0.08] sm:w-auto"
                >
                  <BookOpen className="h-4 w-4 text-white/60" />
                  read the docs
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
