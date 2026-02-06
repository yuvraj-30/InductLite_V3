import { NextResponse } from "next/server";
import { runRetentionTasks } from "@/lib/maintenance/retention";
import { requireCronSecret } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireCronSecret(req, "/api/cron/maintenance");
  if (!auth.ok) return auth.response;

  const startTime = Date.now();

  try {
    await runRetentionTasks();
    const durationMs = Date.now() - startTime;

    auth.log.info({ duration_ms: durationMs }, "Maintenance cron ran");

    return NextResponse.json(
      { ok: true, duration_ms: durationMs },
      { status: 200 },
    );
  } catch (err) {
    auth.log.error({ err: String(err) }, "Maintenance cron failed");
    return NextResponse.json(
      { ok: false, error: "Maintenance cron failed" },
      { status: 500 },
    );
  }
}
