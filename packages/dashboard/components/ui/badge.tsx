import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold leading-snug border border-transparent before:content-[''] before:w-1.5 before:h-1.5 before:rounded-full before:bg-current before:opacity-90",
  {
    variants: {
      variant: {
        active:
          "bg-emerald-100 text-emerald-800 before:animate-virio-dot dark:bg-emerald-500/15 dark:text-emerald-300",
        cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
        completed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
        success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
        failed: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
        pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        inactive: "bg-slate-100 text-slate-500 dark:bg-secondary dark:text-muted-foreground",
        test: "bg-amber-100 text-amber-700 before:hidden text-[10px] px-2 py-0.5 dark:bg-amber-500/15 dark:text-amber-300",
      },
    },
    defaultVariants: { variant: "inactive" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

type StatusVariant = NonNullable<BadgeProps["variant"]>;
const STATUS_MAP: Record<string, StatusVariant> = {
  active: "active",
  cancelled: "cancelled",
  completed: "completed",
  success: "success",
  failed: "failed",
  pending: "pending",
  inactive: "inactive",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_MAP[status] ?? "inactive";
  return <Badge variant={variant}>{status}</Badge>;
}

export { Badge, badgeVariants };
