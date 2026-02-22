import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateEnv } from "@/lib/env-validation";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId, getClientIp } from "@/lib/auth/csrf";

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

const readinessBuckets = new Map<string, { count: number; windowStart: number }>();
const READY_WINDOW_MS = 60_000;
const READY_RL_PER_IP_PER_MIN = 120;

function isReadinessRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const existing = readinessBuckets.get(clientKey);
  if (!existing || now - existing.windowStart >= READY_WINDOW_MS) {
    readinessBuckets.set(clientKey, { count: 1, windowStart: now });
    return false;
  }

  existing.count += 1;
  readinessBuckets.set(clientKey, existing);
  return existing.count > READY_RL_PER_IP_PER_MIN;
}

export async function GET(): Promise<NextResponse<ReadinessStatus>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/api/ready",
    method: "GET",
  });

  const status: ReadinessStatus = {
    ready: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const clientIp = await getClientIp();
    const clientKey = clientIp || "unknown";
    if (isReadinessRateLimited(clientKey)) {
      log.warn({ client_ip: clientIp }, "Readiness endpoint rate limited");
      return NextResponse.json(status, {
        status: 429,
        headers: { "retry-after": "60" },
      });
    }

    const envResult = validateEnv();
    if (!envResult.valid) {
      log.warn({}, "Readiness check failed: env invalid");
      return NextResponse.json(status, { status: 503 });
    }

    // Quick database ping - if this fails, app isn't ready
    // eslint-disable-next-line security-guardrails/no-raw-sql -- Readiness check requires raw SQL for minimal overhead
    await prisma.$queryRaw`SELECT 1`;
    status.ready = true;

    log.debug({}, "Readiness check passed");
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    log.error({ error: String(error) }, "Readiness check failed");
    return NextResponse.json(status, { status: 503 });
  }
}
