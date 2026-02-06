const toInt = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

export const GUARDRAILS = {
  MAX_UPLOAD_MB: toInt(process.env.MAX_UPLOAD_MB, 5),
  UPLOAD_ALLOWED_MIME: (process.env.UPLOAD_ALLOWED_MIME ?? "pdf,jpg,jpeg,png")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean),
  FILES_RETENTION_DAYS: toInt(process.env.FILES_RETENTION_DAYS, 90),
  EXPORTS_RETENTION_DAYS: toInt(process.env.EXPORTS_RETENTION_DAYS, 30),
  AUDIT_RETENTION_DAYS: toInt(process.env.AUDIT_RETENTION_DAYS, 90),
  LOG_RETENTION_DAYS: toInt(process.env.LOG_RETENTION_DAYS, 14),
  MAX_EXPORT_ROWS: toInt(process.env.MAX_EXPORT_ROWS, 50000),
  MAX_EXPORT_BYTES: toInt(process.env.MAX_EXPORT_BYTES, 104857600),
  MAX_EXPORTS_PER_COMPANY_PER_DAY: toInt(
    process.env.MAX_EXPORTS_PER_COMPANY_PER_DAY,
    5,
  ),
  MAX_EXPORT_RUNTIME_SECONDS: toInt(
    process.env.MAX_EXPORT_RUNTIME_SECONDS,
    120,
  ),
  MAX_CONCURRENT_EXPORTS_GLOBAL: toInt(
    process.env.MAX_CONCURRENT_EXPORTS_GLOBAL,
    1,
  ),
  MAX_CONCURRENT_EXPORTS_PER_COMPANY: toInt(
    process.env.MAX_CONCURRENT_EXPORTS_PER_COMPANY,
    1,
  ),
  EXPORT_OFFPEAK_ONLY: toBool(process.env.EXPORT_OFFPEAK_ONLY, false),
  MAX_EXPORT_ATTEMPTS: toInt(process.env.MAX_EXPORT_ATTEMPTS, 3),
};

export function isAllowedMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return GUARDRAILS.UPLOAD_ALLOWED_MIME.includes(normalized);
}

export function getExportExpiryDate(): Date {
  const days = GUARDRAILS.EXPORTS_RETENTION_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function isOffPeakNow(date: Date = new Date()): boolean {
  // Simple default: off-peak is 8pm–6am server local time
  const hour = date.getHours();
  return hour >= 20 || hour < 6;
}
