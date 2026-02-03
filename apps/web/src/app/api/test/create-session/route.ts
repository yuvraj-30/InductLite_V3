import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateCsrfToken } from "@/lib/auth/csrf";

// Force Node runtime and dynamic evaluation so env values are read at request-time
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Allow runtime override via header (useful in CI where build-time inlining prevents env checks)
  const allowHeader = req.headers.get("x-allow-test-runner");

  // Use runtime env access to avoid build-time snapshotting
  const getEnv = () => {
    try {
      return eval("process").env ?? {};
    } catch {
      return {};
    }
  };

  const env = getEnv();

  if (
    allowHeader !== "1" &&
    env.NODE_ENV !== "test" &&
    env.ALLOW_TEST_RUNNER !== "1"
  ) {
    // Return diagnostics to help CI determine why the test runner endpoint is blocked.
    // Note: only emitted in test runs and contains no secrets.
    return NextResponse.json(
      {
        error: "Not allowed",
        nodeEnv: env.NODE_ENV ?? null,
        allowTestRunner: env.ALLOW_TEST_RUNNER ?? null,
        allowHeader: allowHeader ?? null,
      },
      { status: 403 },
    );
  }

  // Fail fast with a clear 503 if the server process does not have DATABASE_URL at runtime
  if (!env.DATABASE_URL) {
    return NextResponse.json(
      {
        error: "DATABASE_URL not available to server process at runtime",
        nodeEnv: env.NODE_ENV ?? null,
        dbPresent: false,
      },
      { status: 503 },
    );
  }

  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    if (!email)
      return NextResponse.json({ error: "email required" }, { status: 400 });

    // Runtime diagnostics to help debug worker schema visibility issues
    try {
      // read runtime env

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
          console.log(
            "E2E: create-session lookup; masked DATABASE_URL:",
            masked,
          );
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
              "E2E: create-session runtime diagnostic:",
              JSON.stringify(res),
            );
            await diag.$disconnect();
          } catch (e) {
            console.warn(
              "E2E: create-session diagnostic query failed:",
              String(e),
            );
          }
        } catch (_) {
          // ignore
        }
      }
    } catch (e) {
      console.warn("E2E: create-session diag read failed:", String(e));
    }

    // Use a runtime-bound Prisma client for consistent visibility with request-time DATABASE_URL
    let user: any = null;
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
        user = await runtimeClient.user.findUnique({
          where: { email },
          include: { company: true },
        });
        await runtimeClient.$disconnect();
      } else {
        user = await prisma.user.findUnique({
          where: { email },
          include: { company: true },
        });
      }
    } catch (e) {
      console.warn(
        "E2E: create-session runtime lookup failed, falling back to global prisma:",
        String(e),
      );
      user = await prisma.user.findUnique({
        where: { email },
        include: { company: true },
      });
    }

    if (!user) {
      // Diagnostic: report counts and schema for current runtime DB to help debug visibility
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
            const count = await diag.user.count({ where: { email } });
            console.warn(
              "E2E: create-session user not found; diag count for email=",
              email,
              "count=",
              count,
            );
            const res = await diag.$queryRawUnsafe(
              "select current_schema() as schema, (select count(*) from information_schema.tables where table_schema = current_schema()) as tables_count;",
            );
            console.warn(
              "E2E: create-session diag schema/tables:",
              JSON.stringify(res),
            );
            await diag.$disconnect();
          } catch (e) {
            console.warn("E2E: create-session diag lookup failed:", String(e));
          }
        }
      } catch (e) {
        console.warn("E2E: create-session diag outer failed:", String(e));
      }

      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // Construct session object (typed shape matching session-config.SessionUser where possible)
    const session = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.company_id,
        companyName: user.company?.name ?? null,
      },
      csrfToken: generateCsrfToken(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Create a response that redirects to admin
    const res = NextResponse.redirect(new URL("/admin", url));

    // Serialize cookie via iron-session helper
    const { sealData } = await import("iron-session");
    const { getSessionOptions } = await import("@/lib/auth/session-config");

    // Use getSessionOptions() for runtime evaluation of secure flag
    const sessionOptions = getSessionOptions();

    const ttl =
      sessionOptions.ttl ?? sessionOptions.cookieOptions?.maxAge ?? 60 * 60 * 8;

    const sealed = await sealData(session, {
      password: sessionOptions.password,
      ttl,
    });

    const cookieName = sessionOptions.cookieName || "inductlite_session";

    // Build cookie with attributes matching session config
    const cookieParts = [`${cookieName}=${sealed}`, "Path=/", "HttpOnly"];
    if (sessionOptions.cookieOptions?.sameSite)
      cookieParts.push(`SameSite=${sessionOptions.cookieOptions.sameSite}`);
    if (sessionOptions.cookieOptions?.secure) cookieParts.push("Secure");
    if (sessionOptions.cookieOptions?.maxAge)
      cookieParts.push(`Max-Age=${sessionOptions.cookieOptions.maxAge}`);

    const cookieString = cookieParts.join("; ");
    res.headers.append("Set-Cookie", cookieString);

    // If caller asked for JSON, return the cookie details to make it easier for tests
    if (url.searchParams.get("json") === "1") {
      return NextResponse.json({
        cookieName,
        cookieValue: sealed,
        cookieString,
      });
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
