import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";
import { assertOrigin, getClientIp, getUserAgent } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { buildPublicUrl } from "@/lib/url/public-url";

export async function POST(request: Request) {
  try {
    await assertOrigin();
  } catch {
    return new Response("CSRF Blocked", { status: 403 });
  }

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

  return NextResponse.redirect(buildPublicUrl("/login", request.url), {
    status: 303,
  });
}
