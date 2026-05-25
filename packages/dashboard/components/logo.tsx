import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  size?: number;
}

/// The Virio loop mark — single stroke + cap, drawn with currentColor so it
/// inherits whatever the parent's `text-*` is. Keeps lockups flat per the
/// style guide (no gradient tile, no shadow, no rotating ring).
export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn("flex-shrink-0 text-foreground", className)}
    >
      <path
        d="M16 4 A12 12 0 1 1 4 16"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={16} cy={4} r={2.5} fill="currentColor" />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  subtitle?: string;
  size?: number;
}

/// Full lockup: mark + "virio" wordmark. Lowercase per the marketing voice.
export function Logo({ className, subtitle, size = 28 }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-display text-[17px] font-semibold tracking-[-0.035em] text-foreground">
          virio
        </span>
        {subtitle && (
          <span className="mt-0.5 block text-[10.5px] tracking-wide text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
