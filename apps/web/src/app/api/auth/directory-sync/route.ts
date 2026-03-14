import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyDirectorySyncBatch,
  parseCompanySsoConfig,
  verifyDirectorySyncApiKey,
} from "@/lib/identity";
import { parseBearerToken } from "@/lib/http/auth-header";
import { createRequestLogger } from "@/lib/logger";
import { createSystemAuditLog } from "@/lib/repository/audit.repository";
import { findCompanySsoSettingsBySlug } from "@/lib/repository/company.repository";
import { generateRequestId } from "@/lib/auth/csrf";

export const runtime = "nodejs";

const userRecordSchema = z.object({
  externalId: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  name: z.string().trim().max(100).optional().default(""),
  role: z.enum(["ADMIN", "SITE_MANAGER", "VIEWER"]).optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});

const directorySyncPayloadSchema = z.object({
  users: z.array(userRecordSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/api/auth/directory-sync",
    method: "POST",
  });
  const url = new URL(request.url);
  const companySlug = (url.searchParams.get("company") ?? "")
    .trim()
    .toLowerCase();
  const apiKey = parseBearerToken(request.headers.get("authorization"));

  if (!companySlug) {
    return NextResponse.json(
      { success: false, error: "Missing company slug query parameter" },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Missing bearer token" },
      { status: 401 },
    );
  }

  const company = await findCompanySsoSettingsBySlug(companySlug);
  if (!company) {
    return NextResponse.json(
      { success: false, error: "Company not found" },
      { status: 404 },
    );
  }

  const config = parseCompanySsoConfig(company.sso_config);
  if (!config.enabled || !config.directorySync.enabled) {
    return NextResponse.json(
      { success: false, error: "Directory sync is disabled for this company" },
      { status: 403 },
    );
  }

  if (!verifyDirectorySyncApiKey(apiKey, config.directorySync.tokenHash)) {
    return NextResponse.json(
      { success: false, error: "Invalid directory sync token" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = directorySyncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error:
          parsed.error.issues[0]?.message ?? "Directory sync payload is invalid",
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyDirectorySyncBatch({
      companyId: company.id,
      provider: config.provider,
      users: parsed.data.users,
      defaultRole: config.defaultRole,
      autoProvisionUsers: config.autoProvisionUsers,
    });

    await createSystemAuditLog({
      company_id: company.id,
      action: "auth.directory_sync",
      entity_type: "Company",
      entity_id: company.id,
      details: {
        provider: config.provider,
        requested_users: parsed.data.users.length,
        created: result.created,
        updated: result.updated,
        deactivated: result.deactivated,
        skipped: result.skipped,
      },
      request_id: requestId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    log.error(
      {
        companyId: company.id,
        companySlug: company.slug,
        error: String(error),
      },
      "Directory sync apply failed",
    );

    return NextResponse.json(
      {
        success: false,
        error: "Directory sync failed",
      },
      { status: 500 },
    );
  }
}
