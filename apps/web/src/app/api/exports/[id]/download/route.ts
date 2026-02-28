import { NextResponse } from "next/server";
import { checkPermissionReadOnly } from "@/lib/auth";
import {
  checkExportDownloadGuardrails,
  findExportJobById,
} from "@/lib/repository/export.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getSignedDownloadUrl } from "@/lib/storage";
import { generateRequestId } from "@/lib/auth/csrf";
import { guardrailDeniedResponse } from "@/lib/api";
import fs from "fs/promises";

function inferContentType(fileName?: string | null): string {
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  return "text/csv";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await checkPermissionReadOnly("export:create");
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = guard.user;
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

  const downloadBytes = Number(job.file_size ?? 0);
  if (!Number.isFinite(downloadBytes) || downloadBytes <= 0) {
    return NextResponse.json(
      { error: "Export metadata incomplete" },
      { status: 409 },
    );
  }

  const budgetCheck = await checkExportDownloadGuardrails(
    context.companyId,
    downloadBytes,
  );
  if (!budgetCheck.allowed) {
    return NextResponse.json(
      guardrailDeniedResponse(
        budgetCheck.controlId,
        budgetCheck.violatedLimit,
        budgetCheck.scope,
        budgetCheck.message,
      ),
      { status: 429 },
    );
  }

  const requestId = generateRequestId();
  await createAuditLog(context.companyId, {
    action: "export.download",
    entity_type: "ExportJob",
    entity_id: job.id,
    user_id: context.id,
    request_id: requestId,
    details: {
      export_type: job.export_type,
      file_name: job.file_name,
      download_bytes: downloadBytes,
    },
  });

  const storageMode = (process.env.STORAGE_MODE || "local").toLowerCase();
  if (storageMode === "local") {
    const data = await fs.readFile(job.file_path);
    const contentType = inferContentType(job.file_name);
    return new NextResponse(data, {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${job.file_name ?? "export.csv"}"`,
      },
    });
  }

  const url = await getSignedDownloadUrl(job.file_path, 300);
  return NextResponse.redirect(url);
}
