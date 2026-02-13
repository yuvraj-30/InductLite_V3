import { NextResponse } from "next/server";
import {
  __test_clearInMemoryStore,
  __test_clearInMemoryStoreForClient,
} from "@/lib/rate-limit";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

  if (
    process.env.NODE_ENV !== "test" &&
    process.env.ALLOW_TEST_RUNNER !== "1"
  ) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  try {
    // Support targeted clearing per clientKey via query or body
    const url = new URL(req.url);
    let clientKey = url.searchParams.get("clientKey");

    type ClearRateLimitBody = { clientKey?: string; email?: string };
    let body: ClearRateLimitBody = {};
    try {
      const parsed = await req.json();
      if (parsed && typeof parsed === "object")
        body = parsed as ClearRateLimitBody;
    } catch (_e: unknown) {
      // ignore parse error - body optional
    }

    if (!clientKey && body?.clientKey) clientKey = body.clientKey;

    if (clientKey) {
      // Clear only keys pertaining to this client
      try {
        await __test_clearInMemoryStoreForClient(clientKey);
      } catch (e: unknown) {
        console.warn(
          "Failed to clear in-memory keys for client:",
          clientKey,
          String(e),
        );
      }
    } else {
      // Fallback: global clear (existing behavior)
      __test_clearInMemoryStore();
    }

    // Also reset locked accounts: prefer explicit email param, else reset users containing the clientKey
    try {
      if (body?.email) {
        await prisma.user.updateMany({
          where: { email: body.email },
          data: { failed_logins: 0, locked_until: null },
        });
      } else if (clientKey) {
        // Reset users whose email contains the clientKey (our create-user uses clientKey in email)
        await prisma.user.updateMany({
          where: { email: { contains: clientKey } },
          data: { failed_logins: 0, locked_until: null },
        });
      } else {
        await prisma.user.updateMany({
          where: {
            email: {
              in: ["admin@buildright.co.nz", "viewer@buildright.co.nz"],
            },
          },
          data: { failed_logins: 0, locked_until: null },
        });
      }
    } catch (dbErr) {
      // Non-fatal: log and continue
      console.warn("Failed to reset user lock state:", String(dbErr));
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
