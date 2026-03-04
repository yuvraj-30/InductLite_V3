"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findSiteById, updateSite } from "@/lib/repository/site.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import {
  buildLmsConnectorConfig,
  parseLmsConnectorConfig,
} from "@/lib/lms/config";

export type SiteLmsConnectorActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

const updateSiteLmsSchema = z.object({
  enabled: z.boolean().optional(),
  endpointUrl: z.string().optional().or(z.literal("")),
  provider: z.string().max(80).optional().or(z.literal("")),
  courseCode: z.string().max(120).optional().or(z.literal("")),
  authToken: z.string().optional().or(z.literal("")),
  clearAuthToken: z.boolean().optional(),
});

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function updateSiteLmsConnectorAction(
  siteId: string,
  _prevState: SiteLmsConnectorActionResult | null,
  formData: FormData,
): Promise<SiteLmsConnectorActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const permission = await checkSitePermission("site:manage", siteId);
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const parsed = updateSiteLmsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    endpointUrl: formData.get("endpointUrl")?.toString() ?? "",
    provider: formData.get("provider")?.toString() ?? "",
    courseCode: formData.get("courseCode")?.toString() ?? "",
    authToken: formData.get("authToken")?.toString() ?? "",
    clearAuthToken: formData.get("clearAuthToken") === "on",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() ?? "form";
      fieldErrors[field] = fieldErrors[field] ?? [];
      fieldErrors[field].push(issue.message);
    }

    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid LMS connector settings",
      fieldErrors,
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "LMS_CONNECTOR", siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "LMS connector is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }

    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to evaluate LMS connector entitlement",
    );
    return {
      success: false,
      error: "Failed to evaluate LMS connector entitlement",
    };
  }

  const endpointUrl = normalizeUrl(parsed.data.endpointUrl ?? "");
  if (parsed.data.enabled && !endpointUrl) {
    return {
      success: false,
      error: "Endpoint URL is required when LMS sync is enabled",
      fieldErrors: {
        endpointUrl: ["Enter a valid https:// endpoint URL"],
      },
    };
  }

  const rawAuthToken = (parsed.data.authToken ?? "").trim();
  if (rawAuthToken && rawAuthToken.length < 12) {
    return {
      success: false,
      error: "Auth token must be at least 12 characters",
      fieldErrors: {
        authToken: ["Auth token must be at least 12 characters"],
      },
    };
  }

  const existingConfig = parseLmsConnectorConfig(site.lms_connector);
  const nextAuthToken = parsed.data.clearAuthToken
    ? null
    : rawAuthToken || existingConfig.authToken;
  const nextConfig = buildLmsConnectorConfig({
    enabled: parsed.data.enabled ?? false,
    endpointUrl,
    provider: parsed.data.provider ?? null,
    courseCode: parsed.data.courseCode ?? null,
    authToken: nextAuthToken,
    existingConfig,
  });

  try {
    await updateSite(context.companyId, siteId, {
      lms_connector: nextConfig as unknown as Prisma.InputJsonValue,
    });

    await createAuditLog(context.companyId, {
      action: "site.lms_connector_update",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        enabled: nextConfig.enabled,
        endpoint_host: nextConfig.endpointUrl
          ? new URL(nextConfig.endpointUrl).host
          : null,
        provider: nextConfig.provider,
        course_code: nextConfig.courseCode,
        has_auth_token: Boolean(nextConfig.authToken),
      },
      request_id: requestId,
    });

    revalidatePath(`/admin/sites/${siteId}`);
    revalidatePath(`/admin/sites/${siteId}/lms`);

    return {
      success: true,
      message: "LMS connector settings updated",
    };
  } catch (error) {
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to update LMS connector settings",
    );

    return {
      success: false,
      error: "Failed to update LMS connector settings",
    };
  }
}

