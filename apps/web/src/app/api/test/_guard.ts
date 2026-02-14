import { NextResponse } from "next/server";

type RuntimeEnv = Record<string, string | undefined>;

function getRuntimeEnv(): RuntimeEnv {
  try {
    return eval("process").env ?? {};
  } catch {
    return {};
  }
}

export function ensureTestRouteAccess(req: Request): Response | null {
  const env = getRuntimeEnv();
  const nodeEnv = env.NODE_ENV ?? "";
  const isTestEnv = nodeEnv === "test";
  const allowTestRunner = env.ALLOW_TEST_RUNNER === "1";

  if (!isTestEnv && !allowTestRunner) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  // Non-test runtimes (including production builds) require a matching secret header.
  if (!isTestEnv) {
    const testSecret = env.TEST_RUNNER_SECRET_KEY;
    const authHeader = req.headers.get("x-test-secret");
    if (!testSecret || authHeader !== testSecret) {
      return new Response("Unauthorized", { status: 403 });
    }
  }

  return null;
}
