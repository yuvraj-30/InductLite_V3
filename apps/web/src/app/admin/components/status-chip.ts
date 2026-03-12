export type StatusChipTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export function statusChipToneClass(tone: StatusChipTone): string {
  switch (tone) {
    case "success":
      return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
    case "info":
      return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
    case "warning":
      return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
    case "danger":
      return "border-red-400/40 bg-red-500/15 text-red-950 dark:text-red-100";
    case "accent":
      return "border-indigo-400/35 bg-indigo-500/15 text-indigo-950 dark:text-indigo-100";
    case "neutral":
    default:
      return "border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] text-secondary";
  }
}

export function statusChipClass(tone: StatusChipTone, extraClassName = ""): string {
  const base = "inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold";
  return extraClassName
    ? `${base} ${statusChipToneClass(tone)} ${extraClassName}`
    : `${base} ${statusChipToneClass(tone)}`;
}

