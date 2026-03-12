import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-panel border p-5 transition-all duration-250 ease-productive", {
  variants: {
    tone: {
      default: "border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] shadow-trust",
      elevated: "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] shadow-float",
      glass:
        "border-[color:var(--border-glass)] bg-[color:var(--glass-bg)] shadow-glass backdrop-blur-lg",
    },
    interactive: {
      true: "hover:-translate-y-px hover:shadow-float",
      false: "",
    },
  },
  defaultVariants: {
    tone: "default",
    interactive: false,
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, tone, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ tone, interactive, className }))} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props} />,
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-secondary", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("mt-4", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("mt-4 flex items-center", className)} {...props} />,
);
CardFooter.displayName = "CardFooter";

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, cardVariants };
