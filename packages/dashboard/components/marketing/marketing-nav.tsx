"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const LINKS: { label: string; href: string }[] = [
  { label: "product", href: "/#features" },
  { label: "how it works", href: "/#how" },
  { label: "pricing", href: "/#pricing" },
  { label: "$virio", href: "/virio" },
  { label: "docs", href: "/docs" },
  { label: "developers", href: "/dev" },
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
          "mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-2 px-4 transition-all duration-200 ease-out sm:gap-3 sm:px-8",
          scrolled &&
            "mt-2 h-14 max-w-[1120px] rounded-2xl border border-border bg-background/80 px-3 backdrop-blur-xl sm:px-5",
        )}
      >
        <Link href="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
          <Logo size={28} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden h-9 items-center rounded-md px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            sign in
          </Link>
          <Link
            href="/dashboard"
            className="hidden h-9 items-center gap-1.5 rounded-[10px] bg-virio-emerald px-4 text-[13px] font-semibold text-virio-emerald-ink transition-opacity duration-fast hover:opacity-90 sm:inline-flex"
          >
            start building
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-3 mt-2 animate-scale-in rounded-2xl border border-border bg-card p-2 shadow-e2 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-1 flex items-center gap-2 border-t border-border px-1 pt-2">
            <Link
              href="/dashboard"
              className="flex h-9 flex-1 items-center justify-center rounded-md bg-virio-emerald text-[13px] font-semibold text-virio-emerald-ink"
            >
              launch app
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
