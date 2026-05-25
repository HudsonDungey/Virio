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
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-border bg-secondary text-muted-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </span>
      <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-[340px] text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
