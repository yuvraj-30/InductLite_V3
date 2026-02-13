import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPermission } from "@/lib/auth";
import { assertOrigin } from "@/lib/auth/csrf";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS, isAllowedMimeType } from "@/lib/guardrails";
import { addContractorDocument } from "@/lib/repository/contractor.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { readS3ObjectBytes } from "@/lib/storage";
import {
  extensionFromMimeType,
  validateFileMagicNumber,
} from "@/lib/storage/validation";
import { DocumentType } from "@prisma/client";
import { generateRequestId } from "@/lib/auth/csrf";
import fs from "fs/promises";

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

function isValidContractorDocumentKey(key: string): boolean {
  return key.startsWith("contractors/") && !key.includes("..");
}

async function readUploadedHeader(key: string, maxBytes: number): Promise<Buffer> {
  const mode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (mode === "s3") {
    return readS3ObjectBytes(key, maxBytes);
  }

  const handle = await fs.open(key, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export async function POST(req: Request) {
  try {
    await assertOrigin();
  } catch {
    return new Response("CSRF Blocked", { status: 403 });
  }

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

  if (!isValidContractorDocumentKey(key)) {
    return NextResponse.json({ error: "Invalid storage key" }, { status: 400 });
  }

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

  const expectedExtension = extensionFromMimeType(mimeType);
  if (!expectedExtension) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 400 },
    );
  }

  let header: Buffer;
  try {
    header = await readUploadedHeader(key, 8);
  } catch {
    return NextResponse.json(
      { error: "Unable to verify uploaded file contents" },
      { status: 400 },
    );
  }

  const isMagicValid = await validateFileMagicNumber(header, expectedExtension);
  if (!isMagicValid) {
    return NextResponse.json(
      { error: "File content does not match declared MIME type" },
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
