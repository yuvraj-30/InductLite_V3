/**
 * Environment Validation for Production
 *
 * Run this at startup to fail fast if required environment variables are missing.
 * This prevents the app from starting in an invalid state.
 */

interface EnvConfig {
  name: string;
  required: boolean;
  production: boolean; // Only required in production
  minLength?: number;
  pattern?: RegExp;
  description: string;
}

const ENV_CONFIG: EnvConfig[] = [
  // Database
  {
    name: "DATABASE_URL",
    required: true,
    production: true,
    description: "PostgreSQL connection string",
  },
  {
    name: "DATABASE_DIRECT_URL",
    required: false,
    production: true,
    description: "Direct Postgres connection string for migrations",
  },
  // Optional: Neon pooler endpoint (port 6543) for Neon deployments
  {
    name: "NEON_POOLER_URL",
    required: false,
    production: false,
    description: "Optional Neon pooler endpoint (port 6543) for runtime DB connections",
  },

  // Session security
  {
    name: "SESSION_SECRET",
    required: true,
    production: true,
    minLength: 32,
    description: "Session encryption key (minimum 32 characters)",
  },
  {
    name: "SESSION_SECRET_PREVIOUS",
    required: false,
    production: false,
    description: "Comma-separated previous session secrets for rotation",
  },
  {
    name: "MFA_ENCRYPTION_KEY",
    required: false,
    production: false,
    description: "Base64 32-byte key for MFA secret encryption",
  },
  {
    name: "DATA_ENCRYPTION_KEY",
    required: false,
    production: true,
    minLength: 32,
    description: "Encryption key for sensitive data at rest",
  },
  {
    name: "MAGIC_LINK_SECRET",
    required: false,
    production: true,
    description: "HMAC secret for contractor magic link sessions",
  },

  // App URL
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    production: true,
    pattern: /^https?:\/\//,
    description: "Public-facing app URL",
  },

  // Cron
  {
    name: "CRON_SECRET",
    required: false,
    production: true,
    minLength: 16,
    description: "Shared secret for cron API routes",
  },
  {
    name: "CRON_ALLOWED_IPS",
    required: false,
    production: false,
    description: "Comma-separated CIDR/IP allowlist for cron endpoints",
  },
  {
    name: "CRON_ALLOW_GITHUB_ACTIONS",
    required: false,
    production: false,
    description: "Allow GitHub Actions IP ranges for cron endpoints",
  },
  {
    name: "CRON_ALLOW_PRIVATE_IPS",
    required: false,
    production: false,
    description: "Allow private IP ranges for cron endpoints",
  },
  {
    name: "CRON_ENFORCE_IP",
    required: false,
    production: false,
    description: "Enforce cron IP checks after secret validation",
  },
  {
    name: "RESEND_API_KEY",
    required: false,
    production: true,
    description: "Resend API key for transactional email",
  },
  {
    name: "RESEND_FROM",
    required: false,
    production: true,
    description: "Resend from address (verified sender)",
  },
  {
    name: "DEMO_BOOKING_NOTIFY_TO",
    required: false,
    production: false,
    description: "Comma-separated recipients for public demo booking notifications",
  },
  {
    name: "SMS_ENABLED",
    required: false,
    production: false,
    description: "Enable/disable SMS workflows (default false)",
  },
  {
    name: "SMS_PROVIDER",
    required: false,
    production: false,
    description: "SMS provider adapter key (webhook|mock)",
  },
  {
    name: "SMS_WEBHOOK_URL",
    required: false,
    production: false,
    pattern: /^https?:\/\//,
    description: "Optional webhook endpoint for SMS provider dispatch",
  },
  {
    name: "SMS_WEBHOOK_AUTH_TOKEN",
    required: false,
    production: false,
    minLength: 12,
    description: "Optional bearer token for SMS webhook provider",
  },
  {
    name: "MAX_MESSAGES_PER_COMPANY_PER_MONTH",
    required: false,
    production: false,
    description: "Hard SMS cap per company per month",
  },
  {
    name: "MAX_BROADCASTS_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max emergency broadcasts per company per day",
  },
  {
    name: "MAX_BROADCAST_RECIPIENTS_PER_EVENT",
    required: false,
    production: false,
    description: "Max recipients per emergency broadcast",
  },
  {
    name: "MAX_PUSH_NOTIFICATIONS_PER_COMPANY_PER_MONTH",
    required: false,
    production: false,
    description: "Max web push notifications per company per month",
  },
  {
    name: "MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max policy simulator runs per company per day",
  },
  {
    name: "MAX_RISK_SCORE_RECALC_JOBS_PER_DAY",
    required: false,
    production: false,
    description: "Max risk score recalculation jobs per day",
  },
  {
    name: "SMS_PROVIDER_TIMEOUT_MS",
    required: false,
    production: false,
    description: "SMS provider request timeout in milliseconds",
  },
  {
    name: "WEBHOOK_SIGNING_SECRET",
    required: false,
    production: false,
    minLength: 16,
    description: "HMAC secret used for outbound webhook signatures",
  },
  {
    name: "CHANNEL_INTEGRATION_SIGNING_SECRET",
    required: false,
    production: false,
    minLength: 16,
    description: "HMAC secret for Teams/Slack callback signatures",
  },
  {
    name: "ACCOUNTING_SYNC_ENDPOINT_URL",
    required: false,
    production: false,
    pattern: /^https?:\/\//,
    description: "Optional accounting endpoint URL for billing preview sync",
  },
  {
    name: "ACCOUNTING_SYNC_SHARED_SECRET",
    required: false,
    production: false,
    minLength: 16,
    description: "Optional HMAC secret for billing preview sync signatures",
  },
  {
    name: "ACCOUNTING_SYNC_TIMEOUT_MS",
    required: false,
    production: false,
    description: "Optional timeout for accounting sync HTTP requests",
  },

  // S3 storage (required for production)
  {
    name: "S3_BUCKET",
    required: false,
    production: true,
    description: "S3 bucket name for file storage",
  },
  {
    name: "S3_REGION",
    required: false,
    production: true,
    description: "S3 region (e.g., ap-southeast-2)",
  },
  {
    name: "S3_ACCESS_KEY_ID",
    required: false,
    production: true,
    description: "S3 access key ID",
  },
  {
    name: "S3_SECRET_ACCESS_KEY",
    required: false,
    production: true,
    description: "S3 secret access key",
  },
  // R2 storage (S3-compatible)
  {
    name: "R2_BUCKET",
    required: false,
    production: true,
    description: "R2 bucket name for file storage",
  },
  {
    name: "R2_ENDPOINT",
    required: false,
    production: true,
    description: "R2 S3-compatible endpoint URL",
  },
  {
    name: "R2_ACCESS_KEY_ID",
    required: false,
    production: true,
    description: "R2 access key ID",
  },
  {
    name: "R2_SECRET_ACCESS_KEY",
    required: false,
    production: true,
    description: "R2 secret access key",
  },
  {
    name: "S3_ENDPOINT",
    required: false,
    production: true,
    description: "S3-compatible endpoint override (R2)",
  },
  // Feature flags
  {
    name: "FEATURE_EXPORTS_ENABLED",
    required: false,
    production: false,
    description: "Enable/disable exports",
  },
  {
    name: "FEATURE_UPLOADS_ENABLED",
    required: false,
    production: false,
    description: "Enable/disable uploads",
  },
  {
    name: "FEATURE_VISUAL_REGRESSION_ENABLED",
    required: false,
    production: false,
    description: "Enable/disable visual regression",
  },
  {
    name: "UIX_S1_VISUAL",
    required: false,
    production: false,
    description: "UI/UX sprint S1 rollout flag (visual system hardening)",
  },
  {
    name: "UIX_S2_FLOW",
    required: false,
    production: false,
    description: "UI/UX sprint S2 rollout flag (core flow friction reduction)",
  },
  {
    name: "UIX_S3_MOBILE",
    required: false,
    production: false,
    description: "UI/UX sprint S3 rollout flag (mobile admin redesign)",
  },
  {
    name: "UIX_S4_AI",
    required: false,
    production: false,
    description: "UI/UX sprint S4 rollout flag (AI-native workflow integration)",
  },
  {
    name: "UIX_S5_A11Y",
    required: false,
    production: false,
    description: "UI/UX sprint S5 rollout flag (a11y and performance hardening)",
  },
  {
    name: "FF_PERMITS_V1",
    required: false,
    production: false,
    description: "Feature flag for permit workflows",
  },
  {
    name: "FF_ID_HARDENING_V1",
    required: false,
    production: false,
    description: "Feature flag for identity hardening baseline",
  },
  {
    name: "FF_EMERGENCY_COMMS_V1",
    required: false,
    production: false,
    description: "Feature flag for emergency communications hub",
  },
  {
    name: "FF_TEAMS_SLACK_V1",
    required: false,
    production: false,
    description: "Feature flag for Teams/Slack integration",
  },
  {
    name: "FF_PWA_PUSH_V1",
    required: false,
    production: false,
    description: "Feature flag for PWA push + presence hints",
  },
  {
    name: "FF_EVIDENCE_TAMPER_V1",
    required: false,
    production: false,
    description: "Feature flag for tamper-evident evidence packs",
  },
  {
    name: "FF_POLICY_SIMULATOR_V1",
    required: false,
    production: false,
    description: "Feature flag for policy simulator",
  },
  {
    name: "FF_RISK_PASSPORT_V1",
    required: false,
    production: false,
    description: "Feature flag for contractor risk passport",
  },
  {
    name: "FF_SELF_SERVE_CONFIG_V1",
    required: false,
    production: false,
    description: "Feature flag for self-serve plan configurator",
  },
  {
    name: "FEATURE_NATIVE_MOBILE_RUNTIME",
    required: false,
    production: false,
    description: "Feature flag for native mobile runtime pathways",
  },
  {
    name: "FEATURE_IDENTITY_OCR",
    required: false,
    production: false,
    description: "Feature flag for OCR-backed identity verification",
  },
  {
    name: "FEATURE_ACCESS_CONNECTORS",
    required: false,
    production: false,
    description: "Feature flag for provider-native access connectors",
  },
  {
    name: "OCR_ENABLED",
    required: false,
    production: false,
    description: "Enable OCR identity verification runtime",
  },
  {
    name: "OCR_PROVIDER",
    required: false,
    production: false,
    description: "Default OCR provider key (MOCK|TEXTRACT[_REGION])",
  },
  {
    name: "OCR_PROVIDER_NZ",
    required: false,
    production: false,
    description: "OCR provider override for NZ data residency",
  },
  {
    name: "OCR_PROVIDER_AU",
    required: false,
    production: false,
    description: "OCR provider override for AU data residency",
  },
  {
    name: "OCR_PROVIDER_APAC",
    required: false,
    production: false,
    description: "OCR provider override for APAC data residency",
  },
  {
    name: "OCR_PROVIDER_GLOBAL",
    required: false,
    production: false,
    description: "OCR provider override for GLOBAL data residency",
  },
  {
    name: "OCR_TEXTRACT_REGION",
    required: false,
    production: false,
    description: "Default AWS region for Textract OCR provider",
  },
  // Guardrails
  {
    name: "ENV_BUDGET_TIER",
    required: false,
    production: false,
    description: "Environment budget tier (MVP|EARLY|GROWTH)",
  },
  {
    name: "MAX_MONTHLY_COMPUTE_INVOCATIONS",
    required: false,
    production: false,
    description: "Max monthly compute invocations",
  },
  {
    name: "MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES",
    required: false,
    production: false,
    description: "Max monthly compute runtime minutes",
  },
  {
    name: "MAX_UPLOAD_MB",
    required: false,
    production: false,
    description: "Max upload size in MB",
  },
  {
    name: "UPLOAD_ALLOWED_MIME",
    required: false,
    production: false,
    description: "Allowed upload MIME types",
  },
  {
    name: "UPLOAD_ALLOWED_EXTENSIONS",
    required: false,
    production: false,
    description: "Allowed upload file extensions",
  },
  {
    name: "UPLOAD_REQUIRE_SERVER_MIME_SNIFF",
    required: false,
    production: false,
    description: "Require server-side MIME sniffing",
  },
  {
    name: "UPLOAD_REQUIRE_MAGIC_BYTES",
    required: false,
    production: false,
    description: "Require magic-byte validation for uploads",
  },
  {
    name: "FILES_RETENTION_DAYS",
    required: false,
    production: false,
    description: "File retention days",
  },
  {
    name: "EXPORTS_RETENTION_DAYS",
    required: false,
    production: false,
    description: "Export retention days",
  },
  {
    name: "AUDIT_RETENTION_DAYS",
    required: false,
    production: false,
    description: "Audit log retention days",
  },
  {
    name: "LOG_RETENTION_DAYS",
    required: false,
    production: false,
    description: "Log retention days",
  },
  {
    name: "MAX_EXPORT_ROWS",
    required: false,
    production: false,
    description: "Max rows per export",
  },
  {
    name: "MAX_EXPORT_BYTES",
    required: false,
    production: false,
    description: "Max export bytes",
  },
  {
    name: "MAX_EXPORTS_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max exports per company per day",
  },
  {
    name: "MAX_EXPORT_RUNTIME_SECONDS",
    required: false,
    production: false,
    description: "Max export runtime seconds",
  },
  {
    name: "MAX_EXPORT_BYTES_GLOBAL_PER_DAY",
    required: false,
    production: false,
    description: "Max generated export bytes globally per day",
  },
  {
    name: "MAX_EXPORT_DOWNLOAD_BYTES_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max export download bytes per company per day",
  },
  {
    name: "MAX_EXPORT_DOWNLOAD_BYTES_GLOBAL_PER_DAY",
    required: false,
    production: false,
    description: "Max export download bytes globally per day",
  },
  {
    name: "MAX_CONCURRENT_EXPORTS_GLOBAL",
    required: false,
    production: false,
    description: "Max global concurrent exports",
  },
  {
    name: "MAX_CONCURRENT_EXPORTS_PER_COMPANY",
    required: false,
    production: false,
    description: "Max concurrent exports per company",
  },
  {
    name: "EXPORT_OFFPEAK_ONLY",
    required: false,
    production: false,
    description: "Restrict exports to off-peak",
  },
  {
    name: "EXPORT_OFFPEAK_AUTO_ENABLE_THRESHOLD_PERCENT",
    required: false,
    production: false,
    description: "Auto-enable off-peak export threshold percent",
  },
  {
    name: "EXPORT_OFFPEAK_AUTO_ENABLE_QUEUE_DELAY_SECONDS",
    required: false,
    production: false,
    description: "Auto-enable off-peak export queue delay in seconds",
  },
  {
    name: "EXPORT_OFFPEAK_AUTO_ENABLE_DAYS",
    required: false,
    production: false,
    description: "Auto-enable off-peak export rolling window days",
  },
  {
    name: "MAX_EXPORT_ATTEMPTS",
    required: false,
    production: false,
    description: "Max export retry attempts",
  },
  {
    name: "MAX_TENANT_STORAGE_GB",
    required: false,
    production: false,
    description: "Max tenant storage GB per month",
  },
  {
    name: "MAX_TENANT_EGRESS_GB_PER_MONTH",
    required: false,
    production: false,
    description: "Max tenant egress GB per month",
  },
  {
    name: "MAX_TENANT_JOB_MINUTES_PER_MONTH",
    required: false,
    production: false,
    description: "Max tenant job minutes per month",
  },
  {
    name: "MAX_TENANT_COMPUTE_INVOCATIONS_PER_MONTH",
    required: false,
    production: false,
    description: "Max tenant compute invocations per month",
  },
  {
    name: "MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max mobile geofence events per company per day",
  },
  {
    name: "MOBILE_GEOFENCE_EVENT_MAX_AGE_MINUTES",
    required: false,
    production: false,
    description: "Max accepted mobile geofence event age (minutes)",
  },
  {
    name: "MOBILE_GEOFENCE_EVENT_FUTURE_SKEW_MINUTES",
    required: false,
    production: false,
    description: "Max allowed future skew for geofence events (minutes)",
  },
  {
    name: "MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH",
    required: false,
    production: false,
    description: "Max OCR requests per company per month",
  },
  {
    name: "MAX_OCR_REQUESTS_GLOBAL_PER_DAY",
    required: false,
    production: false,
    description: "Max OCR requests globally per day",
  },
  {
    name: "OCR_IMAGE_RETENTION_DAYS",
    required: false,
    production: false,
    description: "OCR image retention days",
  },
  {
    name: "MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY",
    required: false,
    production: false,
    description: "Max connector deliveries per company per day",
  },
  // Rate limit guardrails
  {
    name: "RL_PUBLIC_SLUG_PER_IP_PER_MIN",
    required: false,
    production: false,
    description: "Public slug rate limit per IP per minute",
  },
  {
    name: "RL_SIGNIN_PER_IP_PER_MIN",
    required: false,
    production: false,
    description: "Sign-in rate limit per IP per minute",
  },
  {
    name: "RL_SIGNIN_PER_SITE_PER_MIN",
    required: false,
    production: false,
    description: "Sign-in rate limit per site per minute",
  },
  {
    name: "RL_SIGNOUT_PER_IP_PER_MIN",
    required: false,
    production: false,
    description: "Sign-out rate limit per IP per minute",
  },
  {
    name: "RL_DEMO_BOOKING_PER_IP_PER_HOUR",
    required: false,
    production: false,
    description: "Demo booking submission rate limit per IP per hour",
  },
  {
    name: "RL_ADMIN_PER_USER_PER_MIN",
    required: false,
    production: false,
    description: "Admin endpoint rate limit per user per minute",
  },
  {
    name: "RL_ADMIN_PER_IP_PER_MIN",
    required: false,
    production: false,
    description: "Admin endpoint rate limit per IP per minute",
  },
  {
    name: "RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN",
    required: false,
    production: false,
    description: "Admin mutation rate limit per company per minute",
  },
  // Sentry
  {
    name: "SENTRY_DSN",
    required: false,
    production: false,
    description: "Sentry DSN",
  },
];

interface ValidationError {
  name: string;
  error: string;
}

export function validateEnv(): {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
} {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === "production";
  const storageMode = process.env.STORAGE_MODE || "local";

  // Runtime fallback: If DATABASE_URL is not set but a NEON_POOLER_URL is present,
  // use the pooler endpoint as the runtime DATABASE_URL to avoid connection
  // exhaustion in serverless environments (Neon uses pooler on port 6543).
  if (!process.env.DATABASE_URL && process.env.NEON_POOLER_URL) {
    process.env.DATABASE_URL = process.env.NEON_POOLER_URL;
    warnings.push(
      "DATABASE_URL not set; using NEON_POOLER_URL as runtime DATABASE_URL fallback. For Neon deployments prefer setting DATABASE_URL to the pooler endpoint (port 6543).",
    );
  }

  // If both are present and DATABASE_URL looks like a direct endpoint (5432)
  // while NEON_POOLER_URL uses 6543, recommend using the pooler for runtime.
  if (
    process.env.DATABASE_URL &&
    process.env.NEON_POOLER_URL &&
    process.env.DATABASE_URL.includes(":5432") &&
    process.env.NEON_POOLER_URL.includes(":6543")
  ) {
    warnings.push(
      "DATABASE_URL appears to point at a direct (5432) endpoint while NEON_POOLER_URL points at the pooler (6543). Consider using the pooler for runtime DATABASE_URL to avoid connection limits.",
    );
  }
  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];
    const isS3Var = config.name.startsWith("S3_");
    const isR2Var = config.name.startsWith("R2_");

    // Check if required
    if (config.required || (config.production && isProd)) {
      // Special case: S3/R2 vars are validated based on STORAGE_MODE=s3 below
      if (isS3Var || isR2Var) {
        // Only validate presence/format if provided
        if (!value) continue;
      } else if (!value) {
        errors.push({
          name: config.name,
          error: `Missing required environment variable: ${config.description}`,
        });
        continue;
      }
    }

    if (!value) continue;

    // Check minimum length
    if (config.minLength && value.length < config.minLength) {
      errors.push({
        name: config.name,
        error: `${config.name} must be at least ${config.minLength} characters`,
      });
    }

    let hasFormatError = false;

    // Check pattern
    if (config.pattern && !config.pattern.test(value)) {
      errors.push({
        name: config.name,
        error: `${config.name} has invalid format`,
      });
      hasFormatError = true;
    }

    // URL sanity check for app URL to catch values like "https://"
    if (config.name === "NEXT_PUBLIC_APP_URL" && !hasFormatError) {
      try {
        const parsed = new URL(value);
        if (!parsed.hostname) {
          throw new Error("missing hostname");
        }
      } catch {
        errors.push({
          name: config.name,
          error: `${config.name} has invalid format`,
        });
      }
    }
  }

  // Validate critical numeric guardrails for admin/auth abuse controls.
  const positiveIntEnv = [
    "RL_DEMO_BOOKING_PER_IP_PER_HOUR",
    "RL_ADMIN_PER_USER_PER_MIN",
    "RL_ADMIN_PER_IP_PER_MIN",
    "RL_ADMIN_MUTATION_PER_COMPANY_PER_MIN",
    "ACCOUNTING_SYNC_TIMEOUT_MS",
    "SMS_PROVIDER_TIMEOUT_MS",
    "MAX_BROADCASTS_PER_COMPANY_PER_DAY",
    "MAX_BROADCAST_RECIPIENTS_PER_EVENT",
    "MAX_PUSH_NOTIFICATIONS_PER_COMPANY_PER_MONTH",
    "MAX_POLICY_SIM_RUNS_PER_COMPANY_PER_DAY",
    "MAX_RISK_SCORE_RECALC_JOBS_PER_DAY",
    "MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY",
    "MOBILE_GEOFENCE_EVENT_MAX_AGE_MINUTES",
    "MOBILE_GEOFENCE_EVENT_FUTURE_SKEW_MINUTES",
    "MAX_CONNECTOR_DELIVERIES_PER_COMPANY_PER_DAY",
  ];
  for (const name of positiveIntEnv) {
    const value = process.env[name];
    if (value === undefined || value === "") continue;

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      errors.push({
        name,
        error: `${name} must be a positive integer`,
      });
    }
  }

  const nonNegativeIntEnv = [
    "MAX_OCR_REQUESTS_PER_COMPANY_PER_MONTH",
    "MAX_OCR_REQUESTS_GLOBAL_PER_DAY",
    "OCR_IMAGE_RETENTION_DAYS",
  ];
  for (const name of nonNegativeIntEnv) {
    const value = process.env[name];
    if (value === undefined || value === "") continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      errors.push({
        name,
        error: `${name} must be a non-negative integer`,
      });
    }
  }

  const providerKeyPattern =
    /^(MOCK|TEXTRACT|AWS_TEXTRACT|TEXTRACT_[A-Z0-9_]+|AWS_TEXTRACT_[A-Z0-9_]+)$/;
  const ocrProviderEnv = [
    "OCR_PROVIDER",
    "OCR_PROVIDER_NZ",
    "OCR_PROVIDER_AU",
    "OCR_PROVIDER_APAC",
    "OCR_PROVIDER_GLOBAL",
  ] as const;
  for (const name of ocrProviderEnv) {
    const value = process.env[name]?.trim().toUpperCase();
    if (!value) continue;
    if (!providerKeyPattern.test(value)) {
      errors.push({
        name,
        error:
          `${name} must be MOCK, TEXTRACT, AWS_TEXTRACT, or a regional variant such as TEXTRACT_AP_SOUTHEAST_2`,
      });
    }
  }

  const textractRegion = process.env.OCR_TEXTRACT_REGION?.trim();
  if (textractRegion && !/^[a-z]{2}-[a-z]+-\d$/.test(textractRegion)) {
    errors.push({
      name: "OCR_TEXTRACT_REGION",
      error: "OCR_TEXTRACT_REGION must look like ap-southeast-2",
    });
  }

  const smsEnabledRaw = (process.env.SMS_ENABLED ?? "").trim().toLowerCase();
  const smsEnabled = smsEnabledRaw === "true" || smsEnabledRaw === "1";
  const maxMessagesPerCompanyRaw = process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH;
  if (
    maxMessagesPerCompanyRaw !== undefined &&
    maxMessagesPerCompanyRaw !== ""
  ) {
    const parsed = Number(maxMessagesPerCompanyRaw);
    if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
      errors.push({
        name: "MAX_MESSAGES_PER_COMPANY_PER_MONTH",
        error: "MAX_MESSAGES_PER_COMPANY_PER_MONTH must be a non-negative integer",
      });
    } else if (smsEnabled && parsed === 0) {
      errors.push({
        name: "MAX_MESSAGES_PER_COMPANY_PER_MONTH",
        error:
          "MAX_MESSAGES_PER_COMPANY_PER_MONTH must be greater than 0 when SMS_ENABLED=true",
      });
    }
  } else if (smsEnabled) {
    errors.push({
      name: "MAX_MESSAGES_PER_COMPANY_PER_MONTH",
      error:
        "MAX_MESSAGES_PER_COMPANY_PER_MONTH is required when SMS_ENABLED=true",
    });
  }

  // Production-specific warnings
  if (isProd) {
    if (process.env.SESSION_SECRET?.includes("dev-secret")) {
      errors.push({
        name: "SESSION_SECRET",
        error: "Production SESSION_SECRET appears to be a development value",
      });
    }

    if (storageMode === "local") {
      warnings.push(
        "STORAGE_MODE=local is not recommended for production. Use S3.",
      );
    }

    if (storageMode === "s3") {
      const hasS3 =
        Boolean(process.env.S3_BUCKET) &&
        Boolean(process.env.S3_REGION) &&
        Boolean(process.env.S3_ACCESS_KEY_ID) &&
        Boolean(process.env.S3_SECRET_ACCESS_KEY);
      const hasR2 =
        Boolean(process.env.R2_BUCKET) &&
        Boolean(process.env.R2_ACCESS_KEY_ID) &&
        Boolean(process.env.R2_SECRET_ACCESS_KEY);

      if (!hasS3 && !hasR2) {
        errors.push({
          name: "S3_BUCKET",
          error:
            "STORAGE_MODE=s3 requires S3_* or R2_* credentials for file storage",
        });
      }
    }

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      warnings.push(
        "Upstash Redis not configured. Using in-memory rate limiting (not cluster-safe).",
      );
    }

    if (!process.env.SENTRY_DSN) {
      warnings.push("Sentry DSN not configured. Error tracking disabled.");
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    if (appUrl) {
      try {
        const parsed = new URL(appUrl);
        const isLocalHost =
          parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
        if (parsed.protocol === "http:" && !isLocalHost) {
          warnings.push(
            "NEXT_PUBLIC_APP_URL uses HTTP. Consider HTTPS for production.",
          );
        }
      } catch {
        // URL format validation is handled earlier; ignore here.
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate environment and log results.
 * Call this at app startup.
 */
export function validateEnvOrThrow(): void {
  const { valid, errors, warnings } = validateEnv();

  // Log warnings
  for (const warning of warnings) {
    console.warn(`[env-validation] WARNING: ${warning}`);
  }

  // If invalid, log errors and throw
  if (!valid) {
    console.error("[env-validation] Environment validation failed:");
    for (const err of errors) {
      console.error(`  - ${err.name}: ${err.error}`);
    }
    throw new Error(
      `Environment validation failed: ${errors.map((e) => e.name).join(", ")}`,
    );
  }

  console.error("[env-validation] Environment validation passed");
}

export default validateEnv;
