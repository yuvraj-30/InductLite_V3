import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

const toneClassName: Record<StatusBadgeTone, string> = {
  neutral:
    "border-[color:var(--border-soft)] bg-[color:var(--glass-bg-strong)] text-secondary",
  info: "border-cyan-400/30 bg-cyan-500/10 text-cyan-950 dark:text-cyan-100",
  success:
    "border-emerald-400/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  warning:
    "border-amber-400/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
  danger: "border-red-400/32 bg-red-500/10 text-red-950 dark:text-red-100",
  accent:
    "border-indigo-400/30 bg-indigo-500/10 text-indigo-950 dark:text-indigo-100",
};

export function statusBadgeToneClass(tone: StatusBadgeTone): string {
  return toneClassName[tone];
}

export function statusBadgeClass(
  tone: StatusBadgeTone,
  className = "",
): string {
  return cn(
    "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]",
    toneClassName[tone],
    className,
  );
}

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone;
}

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: StatusBadgeProps) {
  return <span className={statusBadgeClass(tone, className)} {...props} />;
}
