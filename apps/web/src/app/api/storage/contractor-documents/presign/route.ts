import { NextResponse } from "next/server";
import { z } from "zod";
import { checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS, isAllowedMimeType } from "@/lib/guardrails";
import { getSignedUploadUrl } from "@/lib/storage";
import { contractorDocumentKey } from "@/lib/storage/keys";
import { nanoid } from "nanoid";

const schema = z.object({
  contractorId: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().int().positive(),
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

  const { contractorId, fileName, mimeType, fileSize } = parsed.data;
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

  const documentKeyId = nanoid(12);
  const key = contractorDocumentKey({
    companyId: context.companyId,
    contractorId,
    documentId: documentKeyId,
    filename: fileName,
  });

  const url = await getSignedUploadUrl({
    key,
    contentType: mimeType,
    expiresInSeconds: 300,
  });

  return NextResponse.json({
    uploadUrl: url,
    key,
    contractorId,
    fileName,
    mimeType,
    fileSize,
  });
}
