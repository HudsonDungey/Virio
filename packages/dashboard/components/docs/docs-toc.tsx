"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TocHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export function DocsToc({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = React.useState<string>("");

  React.useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        On this page
      </p>
      <ul className="mt-3 space-y-1.5 border-l border-border">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={cn(
                "-ml-px block border-l-2 py-0.5 text-[12.5px] leading-snug transition-colors",
                h.depth === 3 ? "pl-5" : "pl-3",
                activeId === h.id
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
