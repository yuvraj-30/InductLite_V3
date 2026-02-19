import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Readiness Probe Endpoint
 *
 * Unlike /health which provides detailed status, this endpoint:
 * - Returns 200 if the app is ready to receive traffic
 * - Returns 503 if the app should not receive traffic
 *
 * Used by Kubernetes readinessProbe and Docker HEALTHCHECK.
 * Designed to be lightweight and fast.
 */

interface ReadinessStatus {
  ready: boolean;
  timestamp: string;
}

export async function GET(): Promise<NextResponse<ReadinessStatus>> {
  const status: ReadinessStatus = {
    ready: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const envResult = validateEnv();
    if (!envResult.valid) {
      return NextResponse.json(status, { status: 503 });
    }

    // Quick database ping - if this fails, app isn't ready
    // eslint-disable-next-line security-guardrails/no-raw-sql -- Readiness check requires raw SQL for minimal overhead
    await prisma.$queryRaw`SELECT 1`;
    status.ready = true;

    return NextResponse.json(status, { status: 200 });
  } catch {
    return NextResponse.json(status, { status: 503 });
  }
}
