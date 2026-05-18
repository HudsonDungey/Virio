import * as React from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end sm:gap-6">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-[640px] text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      )}
    </div>
  );
}

export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
      Live
    </span>
  );
}
