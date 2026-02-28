import { NextResponse } from "next/server";
import { validateEnv } from "@/lib/env-validation";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { getStableClientKey } from "@/lib/rate-limit/clientKey";
import { checkReadinessRateLimit } from "@/lib/rate-limit";
import { checkDatabaseReadiness } from "@/lib/db/readiness";

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

export async function GET(req: Request): Promise<NextResponse<ReadinessStatus>> {
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
    const clientKey = getStableClientKey(
      {
        "x-forwarded-for": req.headers.get("x-forwarded-for") ?? undefined,
        "x-real-ip": req.headers.get("x-real-ip") ?? undefined,
        "user-agent": req.headers.get("user-agent") ?? undefined,
        accept: req.headers.get("accept") ?? undefined,
      },
      { trustProxy: process.env.TRUST_PROXY === "1" },
    );
    const rl = await checkReadinessRateLimit({ requestId, clientKey });
    if (!rl.success) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((rl.reset - Date.now()) / 1000),
      );
      log.warn({ client_key: clientKey }, "Readiness endpoint rate limited");
      return NextResponse.json(status, {
        status: 429,
        headers: { "retry-after": String(retryAfterSeconds) },
      });
    }

    const envResult = validateEnv();
    if (!envResult.valid) {
      log.warn({}, "Readiness check failed: env invalid");
      return NextResponse.json(status, { status: 503 });
    }

    const database = await checkDatabaseReadiness();
    if (!database.ok) {
      log.warn(
        { database_error: database.error ?? "unknown" },
        "Readiness check failed: database unavailable",
      );
      return NextResponse.json(status, { status: 503 });
    }

    status.ready = true;

    log.debug({ db_latency_ms: database.latency_ms }, "Readiness check passed");
    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    log.error({ error: String(error) }, "Readiness check failed");
    return NextResponse.json(status, { status: 503 });
  }
}
