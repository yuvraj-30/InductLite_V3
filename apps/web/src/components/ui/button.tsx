import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control border text-sm font-semibold shadow-sm transition-all duration-200 ease-snappy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring-focus)] disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[color:var(--accent-primary)] text-white hover:-translate-y-px hover:brightness-95 active:translate-y-0",
        secondary:
          "border-[color:var(--border-soft)] bg-[color:var(--glass-bg-strong)] text-[color:var(--text-primary)] hover:-translate-y-px hover:border-[color:var(--border-strong)]",
        outline:
          "border-[color:var(--border-soft)] bg-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--glass-bg)]",
        ghost:
          "border-transparent bg-transparent text-[color:var(--text-secondary)] shadow-none hover:bg-[color:var(--glass-bg)] hover:text-[color:var(--text-primary)]",
        destructive:
          "border-transparent bg-[color:var(--accent-danger)] text-white hover:-translate-y-px hover:brightness-95 active:translate-y-0",
      },
      size: {
        default: "px-4 py-2",
        sm: "min-h-9 rounded-md px-3 text-xs",
        lg: "min-h-12 px-6",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);

Button.displayName = "Button";

export { Button, buttonVariants };
