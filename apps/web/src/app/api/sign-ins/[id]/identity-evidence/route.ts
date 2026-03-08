import { NextResponse } from "next/server";
import { checkPermissionReadOnly, checkSitePermissionReadOnly } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findSignInIdentityEvidence } from "@/lib/repository/signin.repository";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = guard.user;
  const { id } = await params;

  const evidence = await findSignInIdentityEvidence(context.companyId, id);
  if (!evidence) {
    return NextResponse.json(
      { error: "Identity evidence not found" },
      { status: 404 },
    );
  }

  const siteGuard = await checkSitePermissionReadOnly(
    "site:manage",
    evidence.siteId,
  );
  if (!siteGuard.success) {
    return NextResponse.json(
      { error: siteGuard.error },
      { status: siteGuard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  if (!evidence.visitorPhotoEvidence && !evidence.visitorIdEvidence) {
    return NextResponse.json(
      { error: "No identity evidence is stored for this sign-in" },
      { status: 404 },
    );
  }

  const requestId = generateRequestId();
  await createAuditLog(context.companyId, {
    action: "visitor.identity_evidence_view",
    entity_type: "SignInRecord",
    entity_id: evidence.signInId,
    user_id: siteGuard.user.id,
    request_id: requestId,
    details: {
      site_id: evidence.siteId,
      visitor_name: evidence.visitorName,
      photo_available: Boolean(evidence.visitorPhotoEvidence),
      id_available: Boolean(evidence.visitorIdEvidence),
      id_type: evidence.visitorIdEvidenceType,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      signInId: evidence.signInId,
      visitorName: evidence.visitorName,
      visitorPhotoDataUrl: evidence.visitorPhotoEvidence,
      visitorIdDataUrl: evidence.visitorIdEvidence,
      visitorIdType: evidence.visitorIdEvidenceType,
    },
  });
}
