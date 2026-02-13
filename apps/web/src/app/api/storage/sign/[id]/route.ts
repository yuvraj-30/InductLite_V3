import fs from "fs/promises";
import { NextResponse } from "next/server";
import { getContractorSession } from "@/lib/auth/contractor-session";
import { generateRequestId } from "@/lib/auth/csrf";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findContractorDocumentForContractor } from "@/lib/repository/contractor.repository";
import { getSignedDownloadUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getContractorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await findContractorDocumentForContractor(
    session.companyId,
    session.contractorId,
    id,
  );
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (doc.expires_at && doc.expires_at < new Date()) {
    return NextResponse.json({ error: "Document expired" }, { status: 410 });
  }

  const requestId = generateRequestId();
  await createAuditLog(session.companyId, {
    action: "contractor.document_download",
    entity_type: "ContractorDocument",
    entity_id: doc.id,
    request_id: requestId,
    details: { actor: "contractor_portal", contractor_id: session.contractorId },
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
