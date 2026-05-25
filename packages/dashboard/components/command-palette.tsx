"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords?: string;
  Icon: React.ElementType;
  run: () => void;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  commands: Command[];
}

export function CommandPalette({ open, onOpenChange, commands }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  // global ⌘K / Ctrl+K toggle
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      document.body.style.overflow = "hidden";
      window.setTimeout(() => inputRef.current?.focus(), 30);
    } else {
      document.body.style.overflow = "";
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.group} ${c.keywords ?? ""}`.toLowerCase().includes(q),
    );
  }, [query, commands]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  const groups = React.useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  // flat index for keyboard nav
  const flat = filtered;

  function runActive() {
    const cmd = flat[active];
    if (cmd) {
      cmd.run();
      onOpenChange(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    } else if (e.key === "Escape") {
      onOpenChange(false);
    }
  }

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-slate-950/55 p-4 pt-[12vh] backdrop-blur-md animate-overlay-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-[560px] animate-modal-in overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, actions, docs…"
            className="h-12 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        <div
          ref={listRef}
          className="scrollbar-thin max-h-[340px] overflow-y-auto p-2"
        >
          {flat.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-muted-foreground">
              No results for “{query}”
            </div>
          ) : (
            groups.map(([group, items]) => (
              <div key={group} className="mb-1">
                <p className="px-2.5 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {group}
                </p>
                {items.map((c) => {
                  const idx = flat.indexOf(c);
                  const isActive = idx === active;
                  return (
                    <button
                      key={c.id}
                      data-idx={idx}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => {
                        c.run();
                        onOpenChange(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13.5px] transition-colors",
                        isActive
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent/60",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 flex-shrink-0 place-items-center rounded-md border border-border bg-card text-muted-foreground",
                          isActive && "text-foreground",
                        )}
                      >
                        <c.Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex-1 text-foreground">{c.label}</span>
                      {c.hint && (
                        <span className="text-[11px] text-muted-foreground">
                          {c.hint}
                        </span>
                      )}
                      {isActive && (
                        <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border bg-secondary/50 px-4 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 font-mono">↑</kbd>
            <kbd className="rounded border border-border bg-card px-1 font-mono">↓</kbd>
            navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1 font-mono">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
