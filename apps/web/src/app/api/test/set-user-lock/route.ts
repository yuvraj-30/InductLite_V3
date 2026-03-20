import { NextResponse } from "next/server";
import { ensureTestRouteAccess } from "../_guard";
import { withRuntimePrisma } from "../_runtime-prisma";

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const email = body?.email as string | undefined;
    const failedLogins =
      typeof body?.failed_logins === "number" ? body.failed_logins : 0;
    const lock = Boolean(body?.lock);

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { updated, user } = await withRuntimePrisma(async (client) => {
      const updatedResult = await client.user.updateMany({
        where: { email: normalizedEmail },
        data: {
          failed_logins: failedLogins,
          locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000) : null,
        },
      });

      const userResult = await client.user.findFirst({
        where: { email: normalizedEmail },
        select: {
          email: true,
          failed_logins: true,
          locked_until: true,
        },
      });

      return {
        updated: updatedResult.count,
        user: userResult,
      };
    });

    return NextResponse.json({
      success: true,
      updated,
      user,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
