import * as React from "react";
import Link from "next/link";
import { Github, Twitter, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Subscriptions", href: "/#features" },
      { label: "Payroll", href: "/dashboard" },
      { label: "Programmable billing", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "$PULSE token", href: "/pulse" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Developer portal", href: "/dev" },
      { label: "API reference", href: "/docs" },
      { label: "Testing suite", href: "/dashboard" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#" },
      { label: "Security", href: "/#" },
      { label: "Status", href: "/#" },
      { label: "Careers", href: "/#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo size={32} />
            <p className="mt-4 max-w-[260px] text-[13px] leading-relaxed text-muted-foreground">
              Onchain subscription &amp; payroll infrastructure for modern
              internet businesses.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="https://github.com"
                aria-label="GitHub"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href="https://twitter.com"
                aria-label="X"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <ThemeToggle variant="pill" />
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-[12.5px] text-muted-foreground">
            © {new Date().getFullYear()} Pulse Labs. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Audited by Spearbit &amp; OpenZeppelin
            </span>
            <Link href="/#" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/#" className="transition-colors hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
