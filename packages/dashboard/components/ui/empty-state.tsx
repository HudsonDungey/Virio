import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  Icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ Icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-14 text-center",
        className,
      )}
    >
      <div className="relative mb-4">
        <span className="absolute inset-0 -z-10 animate-virio-ring rounded-2xl bg-brand-500/20" />
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-secondary text-brand-600 dark:text-brand-300">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      </div>
      <h3 className="font-display text-[15px] font-bold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
