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

  // Session security
  {
    name: "SESSION_SECRET",
    required: true,
    production: true,
    minLength: 32,
    description: "Session encryption key (minimum 32 characters)",
  },

  // App URL
  {
    name: "NEXT_PUBLIC_APP_URL",
    required: true,
    production: true,
    pattern: /^https?:\/\//,
    description: "Public-facing app URL",
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

  for (const config of ENV_CONFIG) {
    const value = process.env[config.name];

    // Check if required
    if (config.required || (config.production && isProd)) {
      // Special case: S3 vars only required if STORAGE_MODE=s3
      if (config.name.startsWith("S3_") && storageMode !== "s3") {
        continue;
      }

      if (!value) {
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

    if (!process.env.UPSTASH_REDIS_REST_URL) {
      warnings.push(
        "Upstash Redis not configured. Using in-memory rate limiting (not cluster-safe).",
      );
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
