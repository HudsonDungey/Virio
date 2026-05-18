"use client";

import * as React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Wallet,
  Package,
  RefreshCw,
  ArrowLeftRight,
  FlaskConical,
  BookOpen,
  Code2,
  Search,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Switch } from "./ui/switch";

export type PageKey =
  | "dashboard"
  | "payroll"
  | "products"
  | "subscriptions"
  | "transactions"
  | "testing";

interface SidebarProps {
  page: PageKey;
  onPageChange: (p: PageKey) => void;
  testMode: boolean;
  onTestModeChange: (v: boolean) => void;
  onOpenCommand: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

const NAV: { key: PageKey; label: string; Icon: React.ElementType }[] = [
  { key: "dashboard", label: "Overview", Icon: LayoutDashboard },
  { key: "payroll", label: "Payroll", Icon: Wallet },
  { key: "products", label: "Products", Icon: Package },
  { key: "subscriptions", label: "Subscriptions", Icon: RefreshCw },
  { key: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { key: "testing", label: "Testing", Icon: FlaskConical },
];

const EXTERNAL: { href: string; label: string; Icon: React.ElementType }[] = [
  { href: "/docs", label: "Documentation", Icon: BookOpen },
  { href: "/dev", label: "Developer portal", Icon: Code2 },
];

export function Sidebar({
  page,
  onPageChange,
  testMode,
  onTestModeChange,
  onOpenCommand,
  open = false,
  onOpenChange,
}: SidebarProps) {
  const close = () => onOpenChange?.(false);

  return (
    <>
      {/* mobile backdrop */}
      <div
        aria-hidden={!open}
        onClick={close}
        className={cn(
          "fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <nav
        className={cn(
          "fixed inset-y-0 left-0 z-[100] flex w-[248px] max-w-[85vw] flex-col border-r border-border bg-[hsl(var(--surface-2))] transition-transform duration-200 ease-soft lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* brand */}
        <div className="flex items-center justify-between border-b border-border px-5 py-5 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity duration-fast hover:opacity-80"
          >
            <Logo size={26} />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={close}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* command trigger */}
        <div className="px-3 pt-3">
          <button
            onClick={() => {
              close();
              onOpenCommand();
            }}
            className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))] hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search…</span>
            <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* nav */}
        <div className="scrollbar-none flex flex-1 flex-col overflow-y-auto px-3 pt-4">
          <div className="flex flex-col gap-px">
            {NAV.map(({ key, label, Icon }) => (
              <NavButton
                key={key}
                active={page === key}
                label={label}
                Icon={Icon}
                onClick={() => {
                  onPageChange(key);
                  close();
                }}
              />
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-px border-t border-border pt-4">
            {EXTERNAL.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                className="flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="border-t border-border px-3 py-4">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">Test mode</div>
              <div className="text-2xs text-muted-foreground">Accelerated executor</div>
            </div>
            <Switch checked={testMode} onCheckedChange={onTestModeChange} />
          </div>
          <div className="flex items-center gap-3 px-1">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-foreground text-2xs font-semibold text-background">
              P
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                Pulse Labs
              </div>
              <div className="truncate text-2xs text-muted-foreground">
                Merchant workspace
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}

function NavButton({
  active,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  Icon: React.ElementType;
  onClick: () => void;
}) {
  return (
    <button
      data-active={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-sm font-medium transition-colors duration-fast",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
