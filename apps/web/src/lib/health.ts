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
  build?: {
    commit?: string;
    branch?: string;
    source: "render" | "github_actions" | "vercel" | "env" | "unknown";
  };
  checks: {
    database: {
      status: "ok" | "error";
      latency_ms?: number;
      error?: string;
    };
  };
}

function resolveBuildMetadata(): HealthStatus["build"] {
  const renderCommit = process.env.RENDER_GIT_COMMIT?.trim();
  const renderBranch = process.env.RENDER_GIT_BRANCH?.trim();
  if (renderCommit) {
    return {
      commit: renderCommit,
      branch: renderBranch || undefined,
      source: "render",
    };
  }

  const githubSha = process.env.GITHUB_SHA?.trim();
  const githubRefName = process.env.GITHUB_REF_NAME?.trim();
  if (githubSha) {
    return {
      commit: githubSha,
      branch: githubRefName || undefined,
      source: "github_actions",
    };
  }

  const vercelCommit = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const vercelBranch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (vercelCommit) {
    return {
      commit: vercelCommit,
      branch: vercelBranch || undefined,
      source: "vercel",
    };
  }

  const genericCommit =
    process.env.COMMIT_SHA?.trim() ?? process.env.GIT_COMMIT?.trim();
  if (genericCommit) {
    return {
      commit: genericCommit,
      source: "env",
    };
  }

  return {
    source: "unknown",
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
    build: resolveBuildMetadata(),
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
