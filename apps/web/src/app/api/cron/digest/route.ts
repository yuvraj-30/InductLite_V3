import { NextResponse } from "next/server";
import { processWeeklyDigest } from "@/lib/email/worker";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // Security check for CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await processWeeklyDigest();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "Weekly digest cron failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
