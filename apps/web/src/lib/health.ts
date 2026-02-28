/**
 * Health Check Logic
 *
 * Provides health check functionality for the application.
 * Separated from the route handler for testability.
 */

import { checkDatabaseReadiness } from "@/lib/db/readiness";

export interface HealthStatus {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "ok" | "error";
      latency_ms?: number;
      error?: string;
    };
  };
}

/**
 * Perform a health check on the application
 *
 * Checks database connectivity and returns structured health status.
 *
 * @returns HealthStatus object with check results
 */
export async function performHealthCheck(): Promise<HealthStatus> {
  const healthStatus: HealthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: {
        status: "ok",
      },
    },
  };

  // Check database connectivity
  const database = await checkDatabaseReadiness();
  if (!database.ok) {
    healthStatus.status = "error";
    healthStatus.checks.database.status = "error";
    healthStatus.checks.database.error =
      database.error ?? "Unknown database error";
    return healthStatus;
  }
  healthStatus.checks.database.latency_ms = database.latency_ms;

  return healthStatus;
}
