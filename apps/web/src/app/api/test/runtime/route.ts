import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

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
