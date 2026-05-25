import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "select-chevron flex h-10 w-full appearance-none rounded-md border border-border bg-card px-3.5 py-2 pr-8 text-sm text-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))] focus-visible:border-virio-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virio-emerald/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export { Select };
