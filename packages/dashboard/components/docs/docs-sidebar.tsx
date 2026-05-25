"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Rocket,
  Zap,
  Boxes,
  Code2,
  Webhook,
  FileCode2,
  ShieldCheck,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SidebarDoc {
  slug: string;
  title: string;
  description: string;
  section: string;
}

export interface SidebarGroup {
  section: string;
  items: SidebarDoc[];
}

const ICONS: Record<string, LucideIcon> = {
  introduction: Rocket,
  quickstart: Zap,
  concepts: Boxes,
  sdk: Code2,
  webhooks: Webhook,
  contracts: FileCode2,
  security: ShieldCheck,
};

export function DocsSidebar({ groups }: { groups: SidebarGroup[] }) {
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((d) =>
          `${d.title} ${d.section} ${d.description}`.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <nav aria-label="Docs navigation">
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search docs…"
          className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-virio-emerald"
        />
      </div>

      <Link
        href="/docs"
        className={cn(
          "mb-4 flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
          pathname === "/docs"
            ? "bg-accent font-semibold text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <BookOpen className="h-3.5 w-3.5 flex-shrink-0" />
        Overview
      </Link>

      {filtered.map((group) => (
        <div key={group.section} className="mb-5">
          <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {group.section}
          </p>
          {group.items.map((doc) => {
            const href = `/docs/${doc.slug}`;
            const active = pathname === href;
            const Icon = ICONS[doc.slug] ?? BookOpen;
            return (
              <Link
                key={doc.slug}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-accent font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {doc.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
