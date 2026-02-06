import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { findContractorDocumentById } from "@/lib/repository/contractor.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getSignedDownloadUrl } from "@/lib/storage";
import { generateRequestId } from "@/lib/auth/csrf";
import fs from "fs/promises";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await checkPermission("contractor:manage");
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const { id } = await params;

  const doc = await findContractorDocumentById(context.companyId, id);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.expires_at && doc.expires_at < new Date()) {
    return NextResponse.json({ error: "Document expired" }, { status: 410 });
  }

  const requestId = generateRequestId();
  await createAuditLog(context.companyId, {
    action: "contractor.document_download",
    entity_type: "ContractorDocument",
    entity_id: doc.id,
    user_id: context.userId,
    request_id: requestId,
  });

  const storageMode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (storageMode === "local") {
    const data = await fs.readFile(doc.file_path);
    return new NextResponse(data, {
      headers: {
        "content-type": doc.mime_type,
        "content-disposition": `attachment; filename="${doc.file_name}"`,
      },
    });
  }

  const url = await getSignedDownloadUrl(doc.file_path, 300);
  return NextResponse.redirect(url);
}
