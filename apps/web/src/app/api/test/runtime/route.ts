import { ensureTestRouteAccess } from "../_guard";
import { withRuntimePrisma } from "../_runtime-prisma";

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
  let dbReady = false;
  let dbError: { name: string; code: string | null } | null = null;

  if (env.DATABASE_URL) {
    try {
      await withRuntimePrisma(async (client) => {
        await client.user.count();
      });
      dbReady = true;
    } catch (error) {
      const runtimeError = error as { name?: unknown; code?: unknown } | null;
      dbError = {
        name:
          typeof runtimeError?.name === "string" && runtimeError.name.length > 0
            ? runtimeError.name
            : "RuntimeDatabaseError",
        code:
          typeof runtimeError?.code === "string" && runtimeError.code.length > 0
            ? runtimeError.code
            : null,
      };
    }
  }

  const payload = {
    dbPresent: !!env.DATABASE_URL,
    dbReady,
    dbError,
    nodeEnv: env.NODE_ENV ?? null,
    allowTestRunner: !!env.ALLOW_TEST_RUNNER,
    ciRuntime: env.CI === "true" || env.GITHUB_ACTIONS === "true",
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
