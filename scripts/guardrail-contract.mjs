export const REQUIRED_GUARDRAIL_CONTROLS = [
  { controlId: "COST-001", envVar: "MAX_MONTHLY_EGRESS_GB" },
  { controlId: "COST-002", envVar: "MAX_MONTHLY_STORAGE_GB" },
  { controlId: "COST-003", envVar: "MAX_MONTHLY_JOB_MINUTES" },
  { controlId: "COST-004", envVar: "MAX_MONTHLY_SERVER_ACTION_INVOCATIONS" },
  { controlId: "COST-005", envVar: "MAX_MONTHLY_COMPUTE_INVOCATIONS" },
  { controlId: "COST-006", envVar: "MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES" },
  { controlId: "COST-007", envVar: "ENV_BUDGET_TIER" },
  { controlId: "FILE-001", envVar: "UPLOAD_ALLOWED_MIME" },
  { controlId: "FILE-002", envVar: "UPLOAD_ALLOWED_EXTENSIONS" },
  { controlId: "FILE-003", envVar: "UPLOAD_REQUIRE_SERVER_MIME_SNIFF" },
  { controlId: "FILE-004", envVar: "UPLOAD_REQUIRE_MAGIC_BYTES" },
  { controlId: "FILE-005", envVar: "MAX_UPLOAD_MB" },
  { controlId: "FILE-006", envVar: "FILES_RETENTION_DAYS" },
  { controlId: "FILE-007", envVar: "EXPORTS_RETENTION_DAYS" },
  { controlId: "LOG-001", envVar: "AUDIT_RETENTION_DAYS" },
  { controlId: "LOG-002", envVar: "LOG_RETENTION_DAYS" },
  { controlId: "EXPT-001", envVar: "MAX_EXPORT_ROWS" },
  { controlId: "EXPT-002", envVar: "MAX_EXPORT_BYTES_GLOBAL_PER_DAY" },
  { controlId: "EXPT-003", envVar: "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY" },
  { controlId: "EXPT-004", envVar: "MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY" },
  { controlId: "EXPT-005", envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT" },
  { controlId: "EXPT-006", envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS" },
  { controlId: "EXPT-007", envVar: "EXPORT_OFFPEAK_AUTO_ENABLE_DAYS" },
  { controlId: "EXPT-008", envVar: "MAX_EXPORTS_PER_COMPANY_PER_DAY" },
  { controlId: "EXPT-009", envVar: "MAX_CONCURRENT_EXPORTS_PER_COMPANY" },
  { controlId: "EXPT-010", envVar: "MAX_EXPORT_BYTES" },
  { controlId: "EXPT-011", envVar: "MAX_EXPORT_RUNTIME_SECONDS" },
  { controlId: "EXPT-012", envVar: "MAX_CONCURRENT_EXPORTS_GLOBAL" },
  { controlId: "EXPT-013", envVar: "EXPORT_OFFPEAK_ONLY" },
  { controlId: "EXPT-014", envVar: "MAX_EXPORT_QUEUE_AGE_MINUTES" },
  { controlId: "ABUSE-001", envVar: "RL_PUBLIC_SLUG_PER_IP_PER_MIN" },
  { controlId: "ABUSE-002", envVar: "RL_SIGNIN_PER_IP_PER_MIN" },
  { controlId: "ABUSE-003", envVar: "RL_SIGNIN_PER_SITE_PER_MIN" },
  { controlId: "ABUSE-004", envVar: "RL_SIGNOUT_PER_IP_PER_MIN" },
  { controlId: "ABUSE-005", envVar: "RL_ADMIN_PER_USER_PER_MIN" },
  { controlId: "ABUSE-006", envVar: "RL_ADMIN_PER_IP_PER_MIN" },
  { controlId: "ABUSE-007", envVar: "RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN" },
  { controlId: "MSG-001", envVar: "MAX_EMAILS_PER_COMPANY_PER_MONTH" },
  { controlId: "MSG-002", envVar: "MAX_EMAILS_GLOBAL_PER_DAY" },
  { controlId: "MSG-006", envVar: "SMS_ENABLED" },
  { controlId: "MSG-007", envVar: "MAX_MESSAGES_PER_COMPANY_PER_MONTH" },
  { controlId: "FLAG-001", envVar: "FEATURE_EXPORTS_ENABLED" },
  { controlId: "FLAG-002", envVar: "FEATURE_UPLOADS_ENABLED" },
  { controlId: "FLAG-003", envVar: "FEATURE_PUBLIC_SIGNIN_ENABLED" },
  { controlId: "FLAG-004", envVar: "FEATURE_VISUAL_REGRESSION_ENABLED" },
  { controlId: "TENANT-001", envVar: "N/A" },
  { controlId: "TENANT-002", envVar: "N/A" },
  { controlId: "TENANT-003", envVar: "MAX_TENANT_STORAGE_GB" },
  { controlId: "TENANT-004", envVar: "MAX_TENANT_EGRESS_GB_PER_MONTH" },
  { controlId: "TENANT-005", envVar: "MAX_TENANT_JOB_MINUTES_PER_MONTH" },
  { controlId: "TENANT-006", envVar: "MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH" },
  { controlId: "API-001", envVar: "N/A" },
];

export const REQUIRED_ARCHITECTURE_PATTERNS = [
  "deterministic error payloads containing `CONTROL_ID`",
  "Critical paths",
  "timestamp tolerance",
  "endpoint-specific rate limits",
  ...REQUIRED_GUARDRAIL_CONTROLS.filter((control) => control.envVar !== "N/A").map(
    (control) => control.envVar,
  ),
];

export function parseMarkdownTable(markdown) {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tableLines = lines.filter((line) => line.startsWith("|"));
  if (tableLines.length < 3) {
    throw new Error("Guardrail control matrix table is missing or empty.");
  }

  return tableLines
    .slice(2)
    .filter((line) => !/^\|\s*-+\s*\|/.test(line))
    .map((line, index) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 7) {
        throw new Error(
          `Malformed matrix row ${index + 1}: expected 7 columns, got ${cells.length}.`,
        );
      }
      return {
        controlId: cells[0],
        envVar: cells[1],
        defaultValue: cells[2],
        maxByTier: cells[3],
        enforcementPath: cells[4],
        testId: cells[5],
        owner: cells[6],
      };
    });
}
