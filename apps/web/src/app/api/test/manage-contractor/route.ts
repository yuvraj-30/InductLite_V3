import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ensureTestRouteAccess } from "../_guard";

type ManageContractorAction = "deactivate" | "reactivate" | "delete";

function normalizeAction(value: unknown): ManageContractorAction | null {
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
    const contractorName =
      typeof body.contractorName === "string" ? body.contractorName.trim() : "";
    const action = normalizeAction(body.action);
    const companySlug =
      typeof body.companySlug === "string" ? body.companySlug.trim() : "";

    if (!contractorName || !action) {
      return NextResponse.json(
        {
          success: false,
          error: "contractorName and valid action are required",
        },
        { status: 400 },
      );
    }

    const company = companySlug
      ? await prisma.company.findUnique({ where: { slug: companySlug } })
      : null;
    if (companySlug && !company) {
      return NextResponse.json(
        { success: false, error: "company not found" },
        { status: 404 },
      );
    }

    const contractor = await prisma.contractor.findFirst({
      where:
        company?.id != null
          ? { name: contractorName, company_id: company.id }
          : { name: contractorName },
      select: { id: true },
    });

    if (!contractor) {
      return NextResponse.json(
        { success: false, error: "contractor not found" },
        { status: 404 },
      );
    }

    if (action === "deactivate") {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { is_active: false },
      });
      return NextResponse.json({ success: true, action });
    }

    if (action === "reactivate") {
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: { is_active: true },
      });
      return NextResponse.json({ success: true, action });
    }

    await prisma.contractor.delete({ where: { id: contractor.id } });
    return NextResponse.json({ success: true, action });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
