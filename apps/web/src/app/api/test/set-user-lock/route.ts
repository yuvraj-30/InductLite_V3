import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  if (
    process.env.NODE_ENV !== "test" &&
    process.env.ALLOW_TEST_RUNNER !== "1"
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const email = body?.email as string | undefined;
    const failedLogins =
      typeof body?.failed_logins === "number" ? body.failed_logins : 0;
    const lock = Boolean(body?.lock);

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    await prisma.user.updateMany({
      where: { email: email.toLowerCase().trim() },
      data: {
        failed_logins: failedLogins,
        locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
