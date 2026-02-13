import { NextResponse } from "next/server";
import { processWeeklyDigest } from "@/lib/email/worker";
import { generateRequestId } from "@/lib/auth/csrf";
import { requireCronSecret } from "@/lib/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const auth = await requireCronSecret(req, "/api/cron/digest");
  if (!auth.ok) return auth.response;

  try {
    await processWeeklyDigest();
    return NextResponse.json({ success: true });
  } catch (err) {
    auth.log.error({ requestId, err: String(err) }, "Weekly digest cron failed");
    return NextResponse.json(
      { error: "Internal Server Error", requestId },
      { status: 500 },
    );
  }
}
