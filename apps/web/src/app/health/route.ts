import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { performHealthCheck, type HealthStatus } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const log = createRequestLogger(generateRequestId(), {
    path: "/health",
    method: "GET",
  });
  const startTime = Date.now();
  const healthStatus = await performHealthCheck();
  const isHealthy = healthStatus.status === "ok";

  if (!isHealthy) {
    log.error(
      {
        database_error: healthStatus.checks.database.error,
        latency_ms: Date.now() - startTime,
      },
      "Health check failed - database error",
    );
    const safeResponse: HealthStatus = {
      ...healthStatus,
      checks: {
        ...healthStatus.checks,
        database: {
          ...healthStatus.checks.database,
          // Never expose low-level DB error details on public health responses.
          error: "Database unavailable",
        },
      },
    };
    return NextResponse.json(safeResponse, { status: 503 });
  }

  log.debug({ latency_ms: Date.now() - startTime }, "Health check passed");
  return NextResponse.json(healthStatus, { status: 200 });
}
