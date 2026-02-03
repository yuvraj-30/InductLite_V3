import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Liveness Probe Endpoint
 *
 * Returns 200 if the app process is alive and responsive.
 * Does NOT check database or external dependencies.
 *
 * Used by Kubernetes livenessProbe to determine if the container
 * should be restarted.
 *
 * This should ALWAYS return 200 unless the Node.js process is hanging.
 */

interface LivenessStatus {
  alive: boolean;
  timestamp: string;
  uptime_seconds: number;
}

export async function GET(): Promise<NextResponse<LivenessStatus>> {
  return NextResponse.json(
    {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
    },
    { status: 200 },
  );
}
