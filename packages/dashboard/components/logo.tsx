import * as React from "react";
import { cn } from "@/lib/utils";

interface LogoMarkProps {
  className?: string;
  /// pixel size of the square mark
  size?: number;
}

/// The Virio mark — a rounded gradient tile with an animated heartbeat/virio line.
export function LogoMark({ className, size = 32 }: LogoMarkProps) {
  return (
    <span
      className={cn(
        "relative grid flex-shrink-0 place-items-center overflow-hidden rounded-[10px] bg-brand-gradient shadow-[0_6px_18px_-4px_rgba(99,91,255,0.55),inset_0_1px_0_rgba(255,255,255,0.25)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="absolute -inset-0.5 animate-spin-slow opacity-40"
        style={{
          background:
            "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.7), transparent 40%)",
        }}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative z-[1] text-white"
        style={{ width: size * 0.6, height: size * 0.6 }}
      >
        <path
          d="M2 12h4l2.5-6 4 12 3-8 2 2h4.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface WordmarkProps {
  className?: string;
  subtitle?: string;
  size?: number;
}

/// Full lockup: mark + "Virio" wordmark, optional subtitle line.
export function Logo({ className, subtitle, size = 32 }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      <span className="leading-none">
        <span className="font-display text-[17px] font-bold tracking-tight text-foreground">
          Virio
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
