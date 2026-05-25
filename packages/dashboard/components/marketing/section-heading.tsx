import * as React from "react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: Props) {
  return (
    <Reveal
      className={cn(
        "max-w-[640px]",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground",
          align === "center" && "justify-center",
        )}
      >
        <span className="status-dot" style={{ width: 6, height: 6 }} />
        {eyebrow}
      </span>
      <h2 className="mt-5 text-balance font-display text-[clamp(1.9rem,3.6vw,2.85rem)] font-semibold leading-[1.06] tracking-[-0.04em] text-foreground">
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-balance text-[15px] leading-relaxed text-muted-foreground",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
