const toInt = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const toBool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
};

const toTier = (value: string | undefined): "MVP" | "EARLY" | "GROWTH" => {
  if (value === "EARLY" || value === "GROWTH" || value === "MVP") return value;
  return "MVP";
};

export const GUARDRAILS = {
  ENV_BUDGET_TIER: toTier(process.env.ENV_BUDGET_TIER),
  MAX_MONTHLY_COMPUTE_INVOCATIONS: toInt(
    process.env.MAX_MONTHLY_COMPUTE_INVOCATIONS,
    1200000,
  ),
  MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES: toInt(
    process.env.MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES,
    2500,
  ),
  MAX_UPLOAD_MB: toInt(process.env.MAX_UPLOAD_MB, 5),
  UPLOAD_ALLOWED_MIME: (
    process.env.UPLOAD_ALLOWED_MIME ??
    "application/pdf,image/jpeg,image/png"
  )
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean),
  UPLOAD_ALLOWED_EXTENSIONS: (process.env.UPLOAD_ALLOWED_EXTENSIONS ??
    "pdf,jpg,jpeg,png")
    .split(",")
    .map((ext) => ext.trim().toLowerCase())
    .filter(Boolean),
  UPLOAD_REQUIRE_SERVER_MIME_SNIFF: toBool(
    process.env.UPLOAD_REQUIRE_SERVER_MIME_SNIFF,
    true,
  ),
  UPLOAD_REQUIRE_MAGIC_BYTES: toBool(
    process.env.UPLOAD_REQUIRE_MAGIC_BYTES,
    true,
  ),
  FILES_RETENTION_DAYS: toInt(process.env.FILES_RETENTION_DAYS, 90),
  EXPORTS_RETENTION_DAYS: toInt(process.env.EXPORTS_RETENTION_DAYS, 30),
  AUDIT_RETENTION_DAYS: toInt(process.env.AUDIT_RETENTION_DAYS, 90),
  LOG_RETENTION_DAYS: toInt(process.env.LOG_RETENTION_DAYS, 14),
  MAX_EXPORT_ROWS: toInt(process.env.MAX_EXPORT_ROWS, 50000),
  MAX_EXPORT_BYTES: toInt(process.env.MAX_EXPORT_BYTES, 104857600),
  MAX_EXPORT_BYTES_GLOBAL_PER_DAY: toInt(
    process.env.MAX_EXPORT_BYTES_GLOBAL_PER_DAY,
    2147483648,
  ),
  MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY: toInt(
    process.env.MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY,
    536870912,
  ),
  MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY: toInt(
    process.env.MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY,
    5368709120,
  ),
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
  EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT: toInt(
    process.env.EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT,
    20,
  ),
  EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS: toInt(
    process.env.EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS,
    60,
  ),
  EXPORT_OFFPEAK_AUTO_ENABLE_DAYS: toInt(
    process.env.EXPORT_OFFPEAK_AUTO_ENABLE_DAYS,
    7,
  ),
  MAX_EXPORT_ATTEMPTS: toInt(process.env.MAX_EXPORT_ATTEMPTS, 3),
  MAX_TENANT_STORAGE_GB: toInt(process.env.MAX_TENANT_STORAGE_GB, 5),
  MAX_TENANT_EGRESS_GB_PER_MONTH: toInt(
    process.env.MAX_TENANT_EGRESS_GB_PER_MONTH,
    20,
  ),
  MAX_TENANT_JOB_MINUTES_PER_MONTH: toInt(
    process.env.MAX_TENANT_JOB_MINUTES_PER_MONTH,
    300,
  ),
  MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH: toInt(
    process.env.MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH,
    250000,
  ),
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
  const timeZone = process.env.EXPORT_TIMEZONE || "Pacific/Auckland";
  const hour = Number(
    new Intl.DateTimeFormat("en-NZ", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
  return hour >= 20 || hour < 6;
}

