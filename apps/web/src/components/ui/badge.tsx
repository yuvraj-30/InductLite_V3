import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
  {
    variants: {
      variant: {
        default:
          "border-[color:var(--border-soft)] bg-[color:var(--glass-bg-strong)] text-[color:var(--text-secondary)]",
        primary: "border-transparent bg-[color:var(--accent-primary)] text-white",
        success: "border-transparent bg-[color:var(--accent-success)] text-white",
        warning: "border-transparent bg-[color:var(--accent-warning)] text-white",
        danger: "border-transparent bg-[color:var(--accent-danger)] text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
