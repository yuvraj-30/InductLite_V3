import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ensureTestRouteAccess } from "../_guard";

type ManageUserAction = "deactivate" | "reactivate" | "delete";

function normalizeAction(value: unknown): ManageUserAction | null {
  if (
    value === "deactivate" ||
    value === "reactivate" ||
    value === "delete"
  ) {
    return value;
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const action = normalizeAction(body.action);
    const companySlug =
      typeof body.companySlug === "string" ? body.companySlug.trim() : "";

    if (!email || !action) {
      return NextResponse.json(
        { success: false, error: "email and valid action are required" },
        { status: 400 },
      );
    }

    const company = companySlug
      ? await prisma.company.findUnique({ where: { slug: companySlug } })
      : null;

    const user = await prisma.user.findFirst({
      where:
        company?.id != null
          ? { email: email.toLowerCase(), company_id: company.id }
          : { email: email.toLowerCase() },
      select: { id: true, is_active: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "user not found" },
        { status: 404 },
      );
    }

    if (action === "deactivate") {
      await prisma.user.update({
        where: { id: user.id },
        data: { is_active: false },
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "reactivate") {
      await prisma.user.update({
        where: { id: user.id },
        data: { is_active: true },
      });
      return NextResponse.json({ success: true, action });
    }

    // delete
    await prisma.user.delete({ where: { id: user.id } });
    return NextResponse.json({ success: true, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
