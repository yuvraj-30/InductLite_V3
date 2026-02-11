import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    const [ipAddress, userAgent] = await Promise.all([
      getClientIp(),
      getUserAgent(),
    ]);
    await logout(ipAddress, userAgent);
  } catch (error) {
    log.error({ action: "auth.logout", error: String(error) });
  }

  return NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });
}
