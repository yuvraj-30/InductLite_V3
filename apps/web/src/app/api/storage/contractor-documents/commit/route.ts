import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS, isAllowedMimeType } from "@/lib/guardrails";
import { addContractorDocument } from "@/lib/repository/contractor.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { DocumentType } from "@prisma/client";
import { generateRequestId } from "@/lib/auth/csrf";

const schema = z.object({
  contractorId: z.string().min(1),
  key: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
  documentType: z.nativeEnum(DocumentType),
  expiresAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  if (!isFeatureEnabled("UPLOADS")) {
    return NextResponse.json(
      { error: "Uploads are currently disabled" },
      { status: 403 },
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { contractorId, key, fileName, mimeType, fileSize, documentType } =
    parsed.data;
  const maxBytes = GUARDRAILS.MAX_UPLOAD_MB * 1024 * 1024;

  if (!isAllowedMimeType(mimeType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  if (fileSize > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds ${GUARDRAILS.MAX_UPLOAD_MB}MB limit` },
      { status: 400 },
    );
  }

  const expiresAt = parsed.data.expiresAt
    ? new Date(parsed.data.expiresAt)
    : undefined;

  const doc = await addContractorDocument(context.companyId, contractorId, {
    document_type: documentType,
    file_name: fileName,
    file_path: key,
    file_size: fileSize,
    mime_type: mimeType,
    expires_at: expiresAt,
    notes: parsed.data.notes,
  });

  await createAuditLog(context.companyId, {
    action: "contractor.document_upload",
    entity_type: "ContractorDocument",
    entity_id: doc.id,
    user_id: context.userId,
    request_id: generateRequestId(),
    details: { contractorId },
  });

  return NextResponse.json({ success: true, documentId: doc.id });
}
