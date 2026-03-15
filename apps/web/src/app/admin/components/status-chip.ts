import {
  statusBadgeClass,
  statusBadgeToneClass,
  type StatusBadgeTone as StatusChipTone,
} from "@/components/ui/status-badge";

export type { StatusChipTone };

export function statusChipToneClass(tone: StatusChipTone): string {
  return statusBadgeToneClass(tone);
}

export function statusChipClass(
  tone: StatusChipTone,
  extraClassName = "",
): string {
  return statusBadgeClass(tone, extraClassName);
}

