import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import { findExportJobById } from "@/lib/repository/export.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getSignedDownloadUrl } from "@/lib/storage";
import { generateRequestId } from "@/lib/auth/csrf";
import fs from "fs/promises";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await checkPermission("export:create");
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const { id } = await params;

  const job = await findExportJobById(context.companyId, id);
  if (!job || job.status !== "SUCCEEDED" || !job.file_path) {
    return NextResponse.json(
      { error: "Export not available" },
      { status: 404 },
    );
  }

  if (job.expires_at && job.expires_at < new Date()) {
    return NextResponse.json({ error: "Export expired" }, { status: 410 });
  }

  const requestId = generateRequestId();
  await createAuditLog(context.companyId, {
    action: "export.download",
    entity_type: "ExportJob",
    entity_id: job.id,
    user_id: context.userId,
    request_id: requestId,
  });

  const storageMode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (storageMode === "local") {
    const data = await fs.readFile(job.file_path);
    return new NextResponse(data, {
      headers: {
        "content-type": "text/csv",
        "content-disposition": `attachment; filename="${job.file_name ?? "export.csv"}"`,
      },
    });
  }

  const url = await getSignedDownloadUrl(job.file_path, 300);
  return NextResponse.redirect(url);
}
