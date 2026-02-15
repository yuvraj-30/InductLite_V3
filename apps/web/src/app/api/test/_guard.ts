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

  // Never allow test routes in production, regardless of headers/secrets.
  if (isProductionEnv) return new Response("Not Found", { status: 404 });
  if (isTestEnv) return null;
  if (allowTestRunner) return null;

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
