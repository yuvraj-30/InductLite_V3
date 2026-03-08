import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertOrigin } from "@/lib/auth/csrf";
import { checkSitePermission } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { runIdentityOcrVerification } from "@/lib/identity-ocr";

const requestSchema = z.object({
  siteId: z.string().cuid(),
  visitorName: z.string().trim().min(2).max(120),
  documentImageDataUrl: z
    .string()
    .max(2_000_000)
    .regex(/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i),
  documentType: z.string().trim().max(60).optional().or(z.literal("")),
  decisionMode: z.enum(["assist", "strict"]).optional(),
  allowedDocumentTypes: z.array(z.string().trim().max(40)).max(10).optional(),
  signInRecordId: z.string().cuid().optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    await assertOrigin();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request origin" },
      { status: 403 },
    );
  }

  let context;
  try {
    context = await requireAuthenticatedContextReadOnly();
  } catch {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid OCR request payload",
      },
      { status: 400 },
    );
  }

  const permission = await checkSitePermission("site:manage", parsed.data.siteId);
  if (!permission.success) {
    return NextResponse.json(
      { success: false, error: permission.error },
      { status: 403 },
    );
  }

  if (!isFeatureEnabled("IDENTITY_OCR_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Identity OCR is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  const result = await runIdentityOcrVerification({
    companyId: context.companyId,
    siteId: parsed.data.siteId,
    signInRecordId: parsed.data.signInRecordId || undefined,
    visitorName: parsed.data.visitorName,
    documentImageDataUrl: parsed.data.documentImageDataUrl,
    documentType: parsed.data.documentType || null,
    allowedDocumentTypes:
      parsed.data.allowedDocumentTypes?.map((value) => value.trim()) ?? undefined,
    decisionMode: parsed.data.decisionMode ?? "assist",
  });

  if (result.controlError) {
    return NextResponse.json(result.controlError, { status: 429 });
  }

  if (!result.executed) {
    return NextResponse.json(
      {
        success: false,
        error: result.skippedReason ?? "OCR verification is unavailable",
      },
      { status: 403 },
    );
  }

  await createAuditLog(context.companyId, {
    action: "visitor.identity_verification.create",
    entity_type: "Site",
    entity_id: parsed.data.siteId,
    user_id: context.userId,
    details: {
      sign_in_record_id: parsed.data.signInRecordId || null,
      decision_status: result.decisionStatus,
      reason_code: result.reasonCode,
      decision_mode: parsed.data.decisionMode ?? "assist",
      document_type: parsed.data.documentType || null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      decisionStatus: result.decisionStatus,
      reasonCode: result.reasonCode,
      executed: result.executed,
    },
  });
}

