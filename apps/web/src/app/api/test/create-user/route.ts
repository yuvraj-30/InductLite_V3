import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { ensureTestRouteAccess } from "../_guard";

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

function isProductionRuntime(): boolean {
  try {
    return (eval("process").env?.NODE_ENV ?? "").toLowerCase() === "production";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  // Defense in depth: keep test user creation helpers disabled in production.
  if (isProductionRuntime()) return new Response("Not Found", { status: 404 });

  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    // Runtime diagnostics: log masked DB URL and current schema + table count
    if (E2E_DEBUG_TEST_ROUTES) {
      try {
        // Read runtime env safely

        const env = (function getEnv() {
          try {
            return eval("process").env ?? {};
          } catch {
            return {};
          }
        })();
        const dbUrl = env.DATABASE_URL ?? null;
        if (dbUrl) {
          try {
            const u = new URL(dbUrl);
            const masked = `${u.protocol}//${u.username}:****@${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}${u.search}`;
            e2eLog("E2E: create-user called; masked DATABASE_URL:", masked);
            // Quick schema and table diagnostic using Prisma
            try {
              const { PrismaClient } = await import("@prisma/client");
              const diag = new PrismaClient({
                datasources: { db: { url: dbUrl } },
              });
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

    // Find or create a test company specific to this worker/run
    let company = await prisma.company.findUnique({
      where: { slug: companySlug },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { name: `Test Company ${companySlug}`, slug: companySlug },
      });
    }

    // Hash the password properly for UI login tests
    const passwordHash = await hashPassword(password);

    // Create user with properly hashed password
    const safeEmail = String(email);
    const safeName = (safeEmail.split("@")[0] ?? safeEmail) as string;
    // Use a runtime-bound Prisma client so we write to the same DB the server process sees
    let created: any = null;
    let runtimeClient:
      | import("@prisma/client").PrismaClient
      | null = null;
    try {
      const env = (function getEnv() {
        try {
          return eval("process").env ?? {};
        } catch {
          return {};
        }
      })();
      const dbUrl = env.DATABASE_URL ?? null;
      if (dbUrl) {
        const { PrismaClient } = await import("@prisma/client");
        runtimeClient = new PrismaClient({
          datasources: { db: { url: dbUrl } },
        });
        await runtimeClient.$connect();
        created = await runtimeClient.user.create({
          data: {
            company_id: company.id,
            email: safeEmail,
            password_hash: passwordHash,
            name: safeName,
            role: roleValue,
            is_active: true,
          },
        });
      } else {
        // Fallback to existing global prisma if DATABASE_URL is not present at runtime
        created = await prisma.user.create({
          data: {
            company_id: company.id,
            email: safeEmail,
            password_hash: passwordHash,
            name: safeName,
            role: roleValue,
            is_active: true,
          },
        });
      }
    } catch (e) {
      e2eWarn(
        "E2E: create-user runtime write failed, falling back to global prisma:",
        String(e),
      );
      created = await prisma.user.create({
        data: {
          company_id: company.id,
          email: safeEmail,
          password_hash: passwordHash,
          name: safeName,
          role: roleValue,
          is_active: true,
        },
      });
    } finally {
      if (runtimeClient) {
        await runtimeClient.$disconnect().catch(() => undefined);
      }
    }

    // Log created user id for diagnostics
    e2eLog("E2E: create-user created id=", created?.id);

    // Confirm visibility of created user from the same runtime DB URL (diagnostic)
    if (E2E_DEBUG_TEST_ROUTES) {
      try {
        const env = (function getEnv() {
          try {
            return eval("process").env ?? {};
          } catch {
            return {};
          }
        })();
        const dbUrl = env.DATABASE_URL ?? null;
        if (dbUrl) {
          try {
            const { PrismaClient } = await import("@prisma/client");
            const diag = new PrismaClient({
              datasources: { db: { url: dbUrl } },
            });
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
