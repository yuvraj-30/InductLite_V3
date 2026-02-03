/**
 * Next.js Instrumentation
 *
 * This file runs once when the Next.js server starts.
 * Used for environment validation and startup checks.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnvOrThrow } = await import("@/lib/env-validation");

    try {
      validateEnvOrThrow();
    } catch (error) {
      // In development, log but don't crash for better DX
      if (process.env.NODE_ENV === "development") {
        console.error(
          "[instrumentation] Environment validation failed, but continuing in development mode",
        );
        console.error(error);
      } else {
        // In production, fail fast
        throw error;
      }
    }
  }
}
