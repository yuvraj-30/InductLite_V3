import { NextResponse } from "next/server";
import { processNextExportJob } from "@/lib/export/runner";
import { requireCronSecret } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = requireCronSecret(req, "/api/cron/export-scheduler");
  if (!auth.ok) return auth.response;

  const startTime = Date.now();

  try {
    const result = await processNextExportJob();
    const durationMs = Date.now() - startTime;

    auth.log.info({ duration_ms: durationMs, result }, "Export cron ran");

    return NextResponse.json(
      {
        ok: true,
        duration_ms: durationMs,
        processed: Boolean(result),
        result: result ?? { status: "NOOP" },
      },
      { status: 200 },
    );
  } catch (err) {
    auth.log.error({ err: String(err) }, "Export cron failed");
    return NextResponse.json(
      { ok: false, error: "Export cron failed" },
      { status: 500 },
    );
  }
}
