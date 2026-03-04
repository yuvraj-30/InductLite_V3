import { NextResponse } from "next/server";
import { checkAuthReadOnly, checkSitePermissionReadOnly } from "@/lib/auth";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getRollCallEventExportCsv } from "@/lib/repository/emergency.repository";
import { RepositoryError } from "@/lib/repository/base";
import { generateRequestId } from "@/lib/auth/csrf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = guard.user;
  const { eventId } = await params;

  try {
    const exportPayload = await getRollCallEventExportCsv(
      context.companyId,
      eventId,
    );

    const siteGuard = await checkSitePermissionReadOnly(
      "site:manage",
      exportPayload.siteId,
    );
    if (!siteGuard.success) {
      return NextResponse.json(
        { error: siteGuard.error },
        { status: siteGuard.code === "FORBIDDEN" ? 403 : 401 },
      );
    }

    const requestId = generateRequestId();
    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.export",
      entity_type: "EvacuationEvent",
      entity_id: eventId,
      user_id: context.id,
      request_id: requestId,
      details: {
        site_id: exportPayload.siteId,
        file_name: exportPayload.fileName,
      },
    });

    return new NextResponse(exportPayload.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exportPayload.fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Roll call event not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to export roll call event" },
      { status: 500 },
    );
  }
}
