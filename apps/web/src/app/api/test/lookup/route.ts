import { NextResponse } from "next/server";
import { ensureTestRouteAccess } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  // Allow quick checks from tests; no secrets returned.
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  try {
     
    const env = (function getEnv() {
      try {
        return eval("process").env ?? {};
      } catch {
        return {};
      }
    })();
    if (!env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_URL missing", dbPresent: false },
        { status: 503 },
      );
    }

    if (!email)
      return NextResponse.json({ error: "email required" }, { status: 400 });

    try {
      const { PrismaClient } = await import("@prisma/client");
      const diag = new PrismaClient({
        datasources: { db: { url: env.DATABASE_URL } },
      });
      await diag.$connect();
      const count = await diag.user.count({ where: { email } });
      const res: any = await diag.$queryRawUnsafe(
        `SELECT current_schema() AS schema_name, (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = current_schema()) AS tables_count`,
      );
      await diag.$disconnect();
      return NextResponse.json({
        email,
        count,
        schema: res?.[0]?.schema_name ?? null,
        tables_count: res?.[0]?.tables_count ?? null,
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
