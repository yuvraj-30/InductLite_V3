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
  // Guardrails
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
    name: "MAX_EXPORT_ATTEMPTS",
    required: false,
    production: false,
    description: "Max export retry attempts",
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

    // Check pattern
    if (config.pattern && !config.pattern.test(value)) {
      errors.push({
        name: config.name,
        error: `${config.name} has invalid format`,
      });
    }
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
    if (appUrl.startsWith("http://") && !appUrl.includes("localhost")) {
      warnings.push(
        "NEXT_PUBLIC_APP_URL uses HTTP. Consider HTTPS for production.",
      );
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
