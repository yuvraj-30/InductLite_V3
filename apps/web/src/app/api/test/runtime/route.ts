import { ensureTestRouteAccess } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  // Access process.env at request-time using an eval-based access so that
  // Next/Turbopack cannot inline the values at build time. This is deliberate
  // for CI diagnostics only and does NOT return any secrets.
  const getEnv = () => {
    try {
       
      return eval("process").env ?? {};
    } catch {
      return {};
    }
  };

  const env = getEnv();
  const payload = {
    dbPresent: !!env.DATABASE_URL,
    nodeEnv: env.NODE_ENV ?? null,
    allowTestRunner: !!env.ALLOW_TEST_RUNNER,
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
