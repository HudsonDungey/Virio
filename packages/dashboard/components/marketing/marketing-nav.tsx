"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const LINKS: { label: string; href: string }[] = [
  { label: "Product", href: "/#features" },
  { label: "How it works", href: "/#how" },
  { label: "Pricing", href: "/#pricing" },
  { label: "$VIRIO", href: "/virio" },
  { label: "Docs", href: "/docs" },
  { label: "Developers", href: "/dev" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-[120]">
      <div
        className={cn(
          "mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-2 px-4 transition-all duration-300 ease-soft sm:gap-3 sm:px-8",
          scrolled &&
            "mt-2 h-14 max-w-[1120px] rounded-2xl border border-border/70 bg-background/80 px-3 shadow-lift backdrop-blur-xl sm:px-5",
        )}
      >
        <Link href="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
          <Logo size={30} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-lg px-3.5 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/dashboard"
            className="btn-sheen group relative hidden h-9 items-center gap-1.5 overflow-hidden rounded-lg bg-brand-gradient px-4 text-[13.5px] font-semibold text-white shadow-brand transition-all duration-200 ease-soft hover:-translate-y-px hover:shadow-brand-lg sm:inline-flex"
          >
            <span className="relative z-[2]">Start Building</span>
            <ArrowRight className="relative z-[2] h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-3 mt-2 animate-scale-in rounded-2xl border border-border bg-card p-2 shadow-lift md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-border px-1 pt-2">
            <Link
              href="/dashboard"
              className="flex h-9 flex-1 items-center justify-center rounded-lg bg-brand-gradient text-[13.5px] font-semibold text-white"
            >
              Launch App
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
