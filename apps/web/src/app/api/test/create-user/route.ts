import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.ALLOW_TEST_RUNNER !== "1"
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    // Runtime diagnostics: log masked DB URL and current schema + table count
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
          console.log("E2E: create-user called; masked DATABASE_URL:", masked);
          // Quick schema and table diagnostic using Prisma
          try {
            const { PrismaClient } = await import("@prisma/client");
            const diag = new PrismaClient({
              datasources: { db: { url: dbUrl } },
            });
            await diag.$connect();
            const res: any = await diag.$queryRawUnsafe(
              `SELECT current_schema() AS schema_name, (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = current_schema()) AS tables_count`,
            );
            console.log(
              "E2E: create-user runtime diagnostic:",
              JSON.stringify(res),
            );
            await diag.$disconnect();
          } catch (e) {
            console.warn(
              "E2E: create-user diagnostic query failed:",
              String(e),
            );
          }
        } catch (_) {
          // ignore parsing
        }
      }
    } catch (e) {
      console.warn("E2E: create-user diag read failed:", String(e));
    }

    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const email = (body?.email as string) ?? null;
    const password = (body?.password as string) ?? "Admin123!";
    const roleStr = (body?.role as string | undefined) ?? "ADMIN";
    const { UserRole } = await import("@prisma/client");
    const roleValue = roleStr === "ADMIN" ? UserRole.ADMIN : UserRole.VIEWER;
    const companySlug =
      (body?.companySlug as string) ??
      `e2e-${Date.now().toString(36).slice(2, 8)}`;

    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
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
        const runtimeClient = new PrismaClient({
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
        await runtimeClient.$disconnect();
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
      console.warn(
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
    }

    // Log created user id for diagnostics
    console.log("E2E: create-user created id=", created?.id);

    // Confirm visibility of created user from the same runtime DB URL (diagnostic)
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
          console.log(
            "E2E: create-user confirm lookup user=",
            u ? { id: u.id, email: u.email, company_id: u.company_id } : null,
          );
          await diag.$disconnect();
        } catch (e) {
          console.warn("E2E: create-user confirm lookup failed:", String(e));
        }
      }
    } catch (e) {
      console.warn("E2E: create-user confirm diag read failed:", String(e));
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
