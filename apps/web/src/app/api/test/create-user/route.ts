import { NextResponse } from "next/server";
import { createPrismaClient } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { ensureTestRouteAccess } from "../_guard";
import {
  getRuntimeDatabaseUrl,
  withRuntimePrisma,
} from "../_runtime-prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const E2E_DEBUG_TEST_ROUTES = (() => {
  const v = process.env.E2E_DEBUG_TEST_ROUTES;
  return v === "1" || v?.toLowerCase() === "true";
})();

const e2eLog = (...args: unknown[]) => {
  if (E2E_DEBUG_TEST_ROUTES) console.log(...args);
};

const e2eWarn = (...args: unknown[]) => {
  if (E2E_DEBUG_TEST_ROUTES) console.warn(...args);
};

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    // Runtime diagnostics: log masked DB URL and current schema + table count
    if (E2E_DEBUG_TEST_ROUTES) {
      try {
        const dbUrl = getRuntimeDatabaseUrl();
        if (dbUrl) {
          try {
            const u = new URL(dbUrl);
            const masked = `${u.protocol}//${u.username}:****@${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}${u.search}`;
            e2eLog("E2E: create-user called; masked DATABASE_URL:", masked);
            // Quick schema and table diagnostic using Prisma
            try {
              const diag = createPrismaClient(dbUrl);
              await diag.$connect();
              const res = await diag.user.count();
              e2eLog(
                "E2E: create-user runtime diagnostic user_count=",
                res,
              );
              await diag.$disconnect();
            } catch (e) {
              e2eWarn(
                "E2E: create-user diagnostic query failed:",
                String(e),
              );
            }
          } catch (_) {
            // ignore parsing
          }
        }
      } catch (e) {
        e2eWarn("E2E: create-user diag read failed:", String(e));
      }
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const email = (body?.email as string) ?? null;
    const password = (body?.password as string) ?? "Admin123!";
    const roleStr = (body?.role as string | undefined) ?? "ADMIN";
    const { UserRole } = await import("@prisma/client");
    const roleMap: Record<string, typeof UserRole[keyof typeof UserRole]> = {
      ADMIN: UserRole.ADMIN,
      SITE_MANAGER: UserRole.SITE_MANAGER,
      VIEWER: UserRole.VIEWER,
    };
    const roleValue = roleMap[roleStr] ?? null;
    const companySlug =
      (body?.companySlug as string) ??
      `e2e-${Date.now().toString(36).slice(2, 8)}`;

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    if (!roleValue) {
      return NextResponse.json(
        { error: "role must be one of ADMIN, SITE_MANAGER, VIEWER" },
        { status: 400 },
      );
    }

    // Hash the password properly for UI login tests
    const passwordHash = await hashPassword(password);

    // Create user with properly hashed password
    const safeEmail = String(email).toLowerCase().trim();
    const safeName = (safeEmail.split("@")[0] ?? safeEmail) as string;
    const created = await withRuntimePrisma(async (client) => {
      const company =
        (await client.company.findUnique({
          where: { slug: companySlug },
        })) ??
        (await client.company.create({
          data: { name: `Test Company ${companySlug}`, slug: companySlug },
        }));

      return client.user.upsert({
        where: { email: safeEmail },
        update: {
          company_id: company.id,
          password_hash: passwordHash,
          name: safeName,
          role: roleValue,
          is_active: true,
        },
        create: {
          company_id: company.id,
          email: safeEmail,
          password_hash: passwordHash,
          name: safeName,
          role: roleValue,
          is_active: true,
        },
      });
    });

    // Log created user id for diagnostics
    e2eLog("E2E: create-user created id=", created?.id);

    // Confirm visibility of created user from the same runtime DB URL (diagnostic)
    if (E2E_DEBUG_TEST_ROUTES) {
      try {
        const dbUrl = getRuntimeDatabaseUrl();
        if (dbUrl) {
          try {
            const diag = createPrismaClient(dbUrl);
            await diag.$connect();
            const u = await diag.user.findUnique({ where: { email: safeEmail } });
            e2eLog(
              "E2E: create-user confirm lookup user=",
              u ? { id: u.id, email: u.email, company_id: u.company_id } : null,
            );
            await diag.$disconnect();
          } catch (e) {
            e2eWarn("E2E: create-user confirm lookup failed:", String(e));
          }
        }
      } catch (e) {
        e2eWarn("E2E: create-user confirm diag read failed:", String(e));
      }
    }

    return NextResponse.json({ success: true, email, password, companySlug });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
