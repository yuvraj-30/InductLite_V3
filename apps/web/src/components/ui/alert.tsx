import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AlertVariant = "error" | "success" | "info" | "warning";

export const alertVariantClass: Record<AlertVariant, string> = {
  error:
    "border-red-400/38 bg-red-500/10 text-red-950 dark:border-red-500/45 dark:bg-red-950/28 dark:text-red-100",
  success:
    "border-emerald-400/38 bg-emerald-500/10 text-emerald-950 dark:border-emerald-500/45 dark:bg-emerald-950/28 dark:text-emerald-100",
  info: "border-cyan-400/42 bg-cyan-500/10 text-cyan-950 dark:border-cyan-500/48 dark:bg-cyan-950/28 dark:text-cyan-100",
  warning:
    "border-amber-400/42 bg-amber-500/10 text-amber-950 dark:border-amber-500/48 dark:bg-amber-950/28 dark:text-amber-100",
};

export const alertVariantLabel: Record<AlertVariant, string> = {
  error: "Error",
  success: "Success",
  info: "Info",
  warning: "Warning",
};

interface AlertProps {
  children?: ReactNode;
  variant?: AlertVariant;
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({
  children,
  variant = "info",
  title,
  action,
  className = "",
}: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "surface-panel rounded-xl border px-4 py-3",
        alertVariantClass[variant],
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
        {title ?? alertVariantLabel[variant]}
      </p>
      {children ? <div className="mt-1 text-sm leading-6">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
