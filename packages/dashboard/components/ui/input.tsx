import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors duration-fast hover:border-[hsl(var(--hairline-strong))] focus-visible:border-virio-emerald focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virio-emerald/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
