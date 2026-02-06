import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export function requireCronSecret(
  req: Request,
  path: string,
):
  | { ok: true; log: ReturnType<typeof createRequestLogger> }
  | {
      ok: false;
      log: ReturnType<typeof createRequestLogger>;
      response: NextResponse;
    } {
  const log = createRequestLogger(generateRequestId(), {
    path,
    method: req.method,
  });

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    log.error({ path }, "Cron secret not configured");
    return {
      ok: false,
      log,
      response: NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      ),
    };
  }

  const provided = req.headers.get("x-cron-secret") || "";
  if (provided !== expected) {
    log.warn({ path }, "Cron secret mismatch");
    return {
      ok: false,
      log,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, log };
}
