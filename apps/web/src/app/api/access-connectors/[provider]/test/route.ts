import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AccessConnectorProvider } from "@prisma/client";
import { assertOrigin } from "@/lib/auth/csrf";
import { checkSitePermission } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findSiteById } from "@/lib/repository/site.repository";
import {
  findActiveAccessConnectorConfig,
  upsertAccessConnectorConfig,
} from "@/lib/repository/access-connector.repository";
import { dispatchAccessConnectorCommand } from "@/lib/access-connectors";

const requestSchema = z.object({
  siteId: z.string().cuid(),
  endpointUrl: z.string().url().max(2000).optional().or(z.literal("")),
  authToken: z.string().max(512).optional().or(z.literal("")),
  settings: z.record(z.string(), z.unknown()).optional(),
});

function parseProvider(value: string): AccessConnectorProvider | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "HID_ORIGO") return "HID_ORIGO";
  if (normalized === "BRIVO") return "BRIVO";
  if (normalized === "GALLAGHER") return "GALLAGHER";
  if (normalized === "LENELS2") return "LENELS2";
  if (normalized === "GENETEC") return "GENETEC";
  if (normalized === "GENERIC") return "GENERIC";
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    await assertOrigin();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request origin" },
      { status: 403 },
    );
  }

  const { provider: providerParam } = await params;
  const provider = parseProvider(providerParam);
  if (!provider) {
    return NextResponse.json(
      { success: false, error: "Unsupported connector provider" },
      { status: 400 },
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
        error:
          parsed.error.issues[0]?.message ?? "Invalid connector test payload",
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

  if (!isFeatureEnabled("ACCESS_CONNECTORS_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Access connectors are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "ACCESS_CONNECTORS_V1",
      parsed.data.siteId,
    );
    await assertCompanyFeatureEnabled(
      context.companyId,
      "HARDWARE_ACCESS",
      parsed.data.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Access connectors are disabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const site = await findSiteById(context.companyId, parsed.data.siteId);
  if (!site) {
    return NextResponse.json(
      { success: false, error: "Site not found" },
      { status: 404 },
    );
  }

  if (parsed.data.endpointUrl) {
    await upsertAccessConnectorConfig(context.companyId, {
      site_id: parsed.data.siteId,
      provider,
      endpoint_url: parsed.data.endpointUrl,
      auth_token: parsed.data.authToken || undefined,
      settings: parsed.data.settings ?? null,
      is_active: true,
    });
  }

  const connectorConfig = await findActiveAccessConnectorConfig(context.companyId, {
    provider,
    site_id: parsed.data.siteId,
  });
  if (!connectorConfig) {
    return NextResponse.json(
      {
        success: false,
        error: "No active connector config found for this provider/site",
      },
      { status: 404 },
    );
  }

  const dispatch = await dispatchAccessConnectorCommand({
    companyId: context.companyId,
    siteId: parsed.data.siteId,
    siteName: site.name,
    accessControl: site.access_control,
    correlationId: `connector-test:${provider}:${Date.now()}`,
    command: "status",
    reason: "admin_connector_test",
    metadata: {
      requested_by: context.userId,
      provider,
    },
  });

  await createAuditLog(context.companyId, {
    action: "access.connector.test",
    entity_type: "Site",
    entity_id: parsed.data.siteId,
    user_id: context.userId,
    details: {
      provider,
      dispatch_mode: dispatch.mode,
      dispatch_reason: dispatch.reason,
      target_url: dispatch.targetUrl,
      queued: dispatch.queued,
      control_id: dispatch.controlId ?? null,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      provider,
      queued: dispatch.queued,
      mode: dispatch.mode,
      reason: dispatch.reason,
      targetUrl: dispatch.targetUrl,
      controlId: dispatch.controlId ?? null,
    },
  });
}
