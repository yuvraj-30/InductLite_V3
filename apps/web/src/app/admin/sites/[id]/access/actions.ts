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
  buildAccessControlConfig,
  parseAccessControlConfig,
} from "@/lib/access-control/config";

export type SiteAccessControlActionResult =
  | {
      success: true;
      message: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

const updateSiteAccessControlSchema = z.object({
  geofenceMode: z.enum(["AUDIT", "DENY", "OVERRIDE"]),
  geofenceAllowMissingLocation: z.boolean().optional(),
  geofenceOverrideCode: z.string().max(64).optional().or(z.literal("")),
  clearGeofenceOverrideCode: z.boolean().optional(),
  hardwareEnabled: z.boolean().optional(),
  hardwareProvider: z.string().max(80).optional().or(z.literal("")),
  hardwareEndpointUrl: z.string().optional().or(z.literal("")),
  hardwareAuthToken: z.string().optional().or(z.literal("")),
  clearHardwareAuthToken: z.boolean().optional(),
});

export async function updateSiteAccessControlAction(
  siteId: string,
  _prevState: SiteAccessControlActionResult | null,
  formData: FormData,
): Promise<SiteAccessControlActionResult> {
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

  const parsed = updateSiteAccessControlSchema.safeParse({
    geofenceMode: formData.get("geofenceMode")?.toString() ?? "AUDIT",
    geofenceAllowMissingLocation:
      formData.get("geofenceAllowMissingLocation") === "on",
    geofenceOverrideCode: formData.get("geofenceOverrideCode")?.toString() ?? "",
    clearGeofenceOverrideCode: formData.get("clearGeofenceOverrideCode") === "on",
    hardwareEnabled: formData.get("hardwareEnabled") === "on",
    hardwareProvider: formData.get("hardwareProvider")?.toString() ?? "",
    hardwareEndpointUrl: formData.get("hardwareEndpointUrl")?.toString() ?? "",
    hardwareAuthToken: formData.get("hardwareAuthToken")?.toString() ?? "",
    clearHardwareAuthToken: formData.get("clearHardwareAuthToken") === "on",
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
      error:
        parsed.error.issues[0]?.message ?? "Invalid access control configuration",
      fieldErrors,
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  const existingConfig = parseAccessControlConfig(site.access_control);

  if (parsed.data.geofenceMode !== "AUDIT") {
    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "GEOFENCE_ENFORCEMENT",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "Geofence enforcement is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        };
      }
      throw error;
    }
  }

  if (parsed.data.hardwareEnabled) {
    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "HARDWARE_ACCESS",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "Hardware access integration is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        };
      }
      throw error;
    }
  }

  const geofenceOverrideCode = (parsed.data.geofenceOverrideCode ?? "").trim();
  const hasExistingOverrideCode = existingConfig.geofence.overrideCodeHash !== null;
  if (
    parsed.data.geofenceMode === "OVERRIDE" &&
    geofenceOverrideCode.length === 0 &&
    !hasExistingOverrideCode
  ) {
    return {
      success: false,
      error: "Override mode requires a supervisor override code",
      fieldErrors: {
        geofenceOverrideCode: [
          "Provide a geofence override code before enabling override mode",
        ],
      },
    };
  }

  const hardwareEndpointUrl = (parsed.data.hardwareEndpointUrl ?? "").trim();
  if (parsed.data.hardwareEnabled && hardwareEndpointUrl.length === 0) {
    return {
      success: false,
      error: "Hardware endpoint URL is required when hardware access is enabled",
      fieldErrors: {
        hardwareEndpointUrl: ["Enter a valid https:// endpoint URL"],
      },
    };
  }

  const hardwareAuthToken = (parsed.data.hardwareAuthToken ?? "").trim();
  if (hardwareAuthToken.length > 0 && hardwareAuthToken.length < 12) {
    return {
      success: false,
      error: "Hardware auth token must be at least 12 characters",
      fieldErrors: {
        hardwareAuthToken: [
          "Hardware auth token must be at least 12 characters",
        ],
      },
    };
  }

  const nextConfig = buildAccessControlConfig({
    geofenceMode: parsed.data.geofenceMode,
    geofenceAllowMissingLocation: parsed.data.geofenceAllowMissingLocation !== false,
    geofenceOverrideCode,
    clearGeofenceOverrideCode: parsed.data.clearGeofenceOverrideCode,
    hardwareEnabled: parsed.data.hardwareEnabled === true,
    hardwareProvider: parsed.data.hardwareProvider ?? null,
    hardwareEndpointUrl,
    hardwareAuthToken,
    clearHardwareAuthToken: parsed.data.clearHardwareAuthToken,
    existingConfig,
  });

  try {
    await updateSite(context.companyId, siteId, {
      access_control: nextConfig as unknown as Prisma.InputJsonValue,
    });

    await createAuditLog(context.companyId, {
      action: "site.access_control_update",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        geofence_mode: nextConfig.geofence.mode,
        geofence_allow_missing_location: nextConfig.geofence.allowMissingLocation,
        geofence_has_override_code: Boolean(nextConfig.geofence.overrideCodeHash),
        hardware_enabled: nextConfig.hardware.enabled,
        hardware_provider: nextConfig.hardware.provider,
        hardware_endpoint_host: nextConfig.hardware.endpointUrl
          ? new URL(nextConfig.hardware.endpointUrl).host
          : null,
        hardware_has_auth_token: Boolean(nextConfig.hardware.authToken),
      },
      request_id: requestId,
    });

    revalidatePath(`/admin/sites/${siteId}`);
    revalidatePath(`/admin/sites/${siteId}/access`);

    return {
      success: true,
      message: "Access control settings updated",
    };
  } catch (error) {
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to update site access control settings",
    );

    return {
      success: false,
      error: "Failed to update access control settings",
    };
  }
}
