import type { ReactNode } from "react";

type AlertVariant = "error" | "success" | "info" | "warning";

const variantClass: Record<AlertVariant, string> = {
  error:
    "border-red-400/50 bg-red-100/70 text-red-950 dark:border-red-500/60 dark:bg-red-950/45 dark:text-red-100",
  success:
    "border-emerald-400/50 bg-emerald-100/70 text-emerald-950 dark:border-emerald-500/55 dark:bg-emerald-950/45 dark:text-emerald-100",
  info: "border-cyan-400/55 bg-cyan-100/70 text-cyan-950 dark:border-cyan-500/60 dark:bg-cyan-950/45 dark:text-cyan-100",
  warning:
    "border-amber-400/55 bg-amber-100/75 text-amber-950 dark:border-amber-500/55 dark:bg-amber-950/45 dark:text-amber-100",
};

const variantLabel: Record<AlertVariant, string> = {
  error: "Error",
  success: "Success",
  info: "Info",
  warning: "Warning",
};

interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

export function Alert({ children, variant = "info", className = "" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`surface-panel rounded-xl border px-4 py-3 ${variantClass[variant]} ${className}`.trim()}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">
        {variantLabel[variant]}
      </p>
      <div className="mt-1 text-sm leading-6">{children}</div>
    </div>
  );
}
