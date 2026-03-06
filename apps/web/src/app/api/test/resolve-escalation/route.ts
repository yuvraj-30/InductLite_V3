import { NextResponse } from "next/server";
import { PrismaClient, UserRole } from "@prisma/client";
import { ensureTestRouteAccess } from "../_guard";

const prisma = new PrismaClient();

type ResolveDecision = "approve" | "deny";

function parseDecision(value: unknown): ResolveDecision | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "approve") return "approve";
  if (normalized === "deny") return "deny";
  return null;
}

async function findOrCreateReviewer(companyId: string): Promise<string> {
  const existing = await prisma.user.findFirst({
    where: {
      company_id: companyId,
      role: { in: [UserRole.ADMIN, UserRole.SITE_MANAGER] },
      is_active: true,
    },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const suffix = Math.random().toString(36).slice(2, 8);
  const reviewer = await prisma.user.create({
    data: {
      company_id: companyId,
      email: `test-escalation-reviewer-${suffix}@example.test`,
      password_hash: "$argon2id$v=19$m=65536,t=3,p=4$placeholder",
      name: "Test Escalation Reviewer",
      role: UserRole.ADMIN,
      is_active: true,
    },
    select: { id: true },
  });
  return reviewer.id;
}

export async function POST(req: Request) {
  const accessDenied = ensureTestRouteAccess(req);
  if (accessDenied) return accessDenied;

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const visitorName =
      typeof body.visitorName === "string" ? body.visitorName.trim() : "";
    const decision = parseDecision(body.decision);

    if (!visitorName || !decision) {
      return NextResponse.json(
        { success: false, error: "visitorName and valid decision are required" },
        { status: 400 },
      );
    }

    const escalation = await prisma.pendingSignInEscalation.findFirst({
      where: {
        visitor_name: visitorName,
        status: "PENDING",
      },
      orderBy: { submitted_at: "desc" },
      select: { id: true, company_id: true },
    });

    if (!escalation) {
      return NextResponse.json(
        { success: false, resolved: false, error: "Pending escalation not found" },
        { status: 404 },
      );
    }

    const reviewerId = await findOrCreateReviewer(escalation.company_id);
    const targetStatus = decision === "approve" ? "APPROVED" : "DENIED";
    const updated = await prisma.pendingSignInEscalation.updateMany({
      where: { id: escalation.id, status: "PENDING" },
      data: {
        status: targetStatus,
        reviewed_at: new Date(),
        reviewed_by: reviewerId,
        review_notes: "Resolved via test route",
      },
    });

    return NextResponse.json({
      success: true,
      resolved: updated.count > 0,
      escalationId: escalation.id,
      status: targetStatus,
      reviewerId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err ?? "");
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

