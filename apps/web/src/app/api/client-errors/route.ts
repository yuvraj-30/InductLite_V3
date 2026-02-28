import { NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin, generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientErrorSchema = z.object({
  source: z.enum(["app-error-boundary", "root-error-boundary"]),
  message: z.string().min(1).max(500),
  digest: z.string().max(128).optional(),
  stack: z.string().max(4000).optional(),
  path: z.string().max(2048).optional(),
  userAgent: z.string().max(512).optional(),
});

export async function POST(req: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/api/client-errors",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid client error payload" }, { status: 400 });
  }

  const payload = parsed.data;
  log.error(
    {
      action: "client.error",
      source: payload.source,
      message: payload.message,
      digest: payload.digest,
      path: payload.path,
      user_agent: payload.userAgent,
      stack: process.env.NODE_ENV === "development" ? payload.stack : undefined,
    },
    "Client error boundary event",
  );

  return new NextResponse(null, { status: 204 });
}
