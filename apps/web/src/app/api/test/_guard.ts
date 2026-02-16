import { NextResponse } from "next/server";

type RuntimeEnv = Record<string, string | undefined>;

function getRuntimeEnv(): RuntimeEnv {
  try {
    return eval("process").env ?? {};
  } catch {
    return {};
  }
}

export function ensureTestRouteAccess(_req: Request): Response | null {
  const env = getRuntimeEnv();
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  const isTestEnv = nodeEnv === "test";
  const isProductionEnv = nodeEnv === "production";
  const allowTestRunner = env.ALLOW_TEST_RUNNER === "1";
  const isCiRuntime = env.CI === "true" || env.GITHUB_ACTIONS === "true";
  const configuredSecret = env.TEST_RUNNER_SECRET_KEY;
  const requestSecret = _req.headers.get("x-test-secret");
  const secretMatches =
    !!configuredSecret &&
    typeof requestSecret === "string" &&
    requestSecret === configuredSecret;

  if (isTestEnv) return null;

  // In production runtimes, only allow CI test execution with an explicit
  // opt-in plus matching shared secret header.
  if (isProductionEnv) {
    if (allowTestRunner && isCiRuntime && secretMatches) return null;
    return new Response("Not Found", { status: 404 });
  }

  // Non-production local/dev usage keeps the existing ALLOW_TEST_RUNNER toggle.
  if (allowTestRunner) return null;

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
