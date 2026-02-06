import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface HealthStatus {
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

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const log = createRequestLogger(generateRequestId(), {
    path: "/health",
    method: "GET",
  });
  const startTime = Date.now();
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
  try {
    const dbStart = Date.now();
    // eslint-disable-next-line security-guardrails/no-raw-sql -- Health check requires raw SQL for minimal overhead
    await prisma.$queryRaw`SELECT 1`;
    healthStatus.checks.database.latency_ms = Date.now() - dbStart;
  } catch (error) {
    healthStatus.status = "error";
    healthStatus.checks.database.status = "error";
    healthStatus.checks.database.error =
      error instanceof Error ? error.message : "Unknown database error";

    log.error(
      { error, latency_ms: Date.now() - startTime },
      "Health check failed - database error",
    );

    return NextResponse.json(healthStatus, { status: 503 });
  }

  log.debug({ latency_ms: Date.now() - startTime }, "Health check passed");

  return NextResponse.json(healthStatus, { status: 200 });
}
