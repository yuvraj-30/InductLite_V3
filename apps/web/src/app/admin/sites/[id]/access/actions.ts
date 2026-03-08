"use server";

import { revalidatePath } from "next/cache";
import type { AccessConnectorProvider, Prisma } from "@prisma/client";
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
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  buildAccessControlConfig,
  parseAccessControlConfig,
} from "@/lib/access-control/config";
import { upsertAccessConnectorConfig } from "@/lib/repository/access-connector.repository";

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
  geofenceAutomationMode: z.enum(["OFF", "ASSIST", "AUTO"]).optional(),
  geofenceAutoCheckoutGraceMinutes: z.coerce.number().int().min(5).max(720).default(30),
  hardwareEnabled: z.boolean().optional(),
  hardwareProvider: z.string().max(80).optional().or(z.literal("")),
  hardwareEndpointUrl: z.string().optional().or(z.literal("")),
  hardwareAuthToken: z.string().optional().or(z.literal("")),
  clearHardwareAuthToken: z.boolean().optional(),
  identityEnabled: z.boolean().optional(),
  identityRequirePhoto: z.boolean().optional(),
  identityRequireIdScan: z.boolean().optional(),
  identityRequireConsent: z.boolean().optional(),
  identityRequireOcrVerification: z.boolean().optional(),
  identityAllowedDocumentTypes: z
    .string()
    .trim()
    .max(240)
    .optional()
    .or(z.literal("")),
  identityOcrDecisionMode: z.enum(["assist", "strict"]).optional(),
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
    geofenceAutomationMode:
      formData.get("geofenceAutomationMode")?.toString() ?? "OFF",
    geofenceAutoCheckoutGraceMinutes:
      formData.get("geofenceAutoCheckoutGraceMinutes")?.toString() ?? "30",
    hardwareEnabled: formData.get("hardwareEnabled") === "on",
    hardwareProvider: formData.get("hardwareProvider")?.toString() ?? "",
    hardwareEndpointUrl: formData.get("hardwareEndpointUrl")?.toString() ?? "",
    hardwareAuthToken: formData.get("hardwareAuthToken")?.toString() ?? "",
    clearHardwareAuthToken: formData.get("clearHardwareAuthToken") === "on",
    identityEnabled: formData.get("identityEnabled") === "on",
    identityRequirePhoto: formData.get("identityRequirePhoto") === "on",
    identityRequireIdScan: formData.get("identityRequireIdScan") === "on",
    identityRequireConsent: formData.get("identityRequireConsent") === "on",
    identityRequireOcrVerification:
      formData.get("identityRequireOcrVerification") === "on",
    identityAllowedDocumentTypes:
      formData.get("identityAllowedDocumentTypes")?.toString() ?? "",
    identityOcrDecisionMode:
      formData.get("identityOcrDecisionMode")?.toString() ?? "assist",
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

  if (parsed.data.geofenceAutomationMode !== "OFF") {
    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "MOBILE_OFFLINE_ASSIST_V1",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "Mobile geofence automation is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
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

  if (parsed.data.identityEnabled) {
    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "ID_HARDENING_V1",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "Visitor identity evidence is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        };
      }
      throw error;
    }
  }

  if (parsed.data.identityRequireOcrVerification) {
    if (!parsed.data.identityEnabled) {
      return {
        success: false,
        error:
          "Enable visitor identity evidence before enabling OCR verification",
        fieldErrors: {
          identityRequireOcrVerification: [
            "Turn on identity evidence first.",
          ],
        },
      };
    }
    if (!parsed.data.identityRequireIdScan) {
      return {
        success: false,
        error:
          "ID image upload is required when OCR verification is enabled",
        fieldErrors: {
          identityRequireIdScan: ["Enable ID image upload to use OCR verification."],
        },
      };
    }

    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "ID_OCR_VERIFICATION_V1",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "OCR verification is disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
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

  const identityAllowedDocumentTypes = (parsed.data.identityAllowedDocumentTypes ?? "")
    .split(",")
    .map((value) =>
      value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, ""),
    )
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index)
    .slice(0, 10);

  const hardwareProviderNormalized = (parsed.data.hardwareProvider ?? "")
    .trim()
    .toUpperCase();
  const namedConnectorProviders: AccessConnectorProvider[] = [
    "HID_ORIGO",
    "BRIVO",
    "GALLAGHER",
    "LENELS2",
    "GENETEC",
  ];
  const namedConnectorProvider =
    namedConnectorProviders.find(
      (provider) => provider === hardwareProviderNormalized,
    ) ?? null;

  if (namedConnectorProvider) {
    if (!isFeatureEnabled("ACCESS_CONNECTORS_V1")) {
      return {
        success: false,
        error:
          "Provider connectors are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      };
    }

    try {
      await assertCompanyFeatureEnabled(
        context.companyId,
        "ACCESS_CONNECTORS_V1",
        siteId,
      );
    } catch (error) {
      if (error instanceof EntitlementDeniedError) {
        return {
          success: false,
          error:
            "Provider connectors are disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        };
      }
      throw error;
    }
  }

  const nextConfig = buildAccessControlConfig({
    geofenceMode: parsed.data.geofenceMode,
    geofenceAllowMissingLocation: parsed.data.geofenceAllowMissingLocation !== false,
    geofenceOverrideCode,
    clearGeofenceOverrideCode: parsed.data.clearGeofenceOverrideCode,
    geofenceAutomationMode: parsed.data.geofenceAutomationMode ?? "OFF",
    geofenceAutoCheckoutGraceMinutes:
      parsed.data.geofenceAutoCheckoutGraceMinutes,
    hardwareEnabled: parsed.data.hardwareEnabled === true,
    hardwareProvider: parsed.data.hardwareProvider ?? null,
    hardwareEndpointUrl,
    hardwareAuthToken,
    clearHardwareAuthToken: parsed.data.clearHardwareAuthToken,
    identityEnabled: parsed.data.identityEnabled === true,
    identityRequirePhoto: parsed.data.identityRequirePhoto === true,
    identityRequireIdScan: parsed.data.identityRequireIdScan === true,
    identityRequireConsent: parsed.data.identityRequireConsent !== false,
    identityRequireOcrVerification:
      parsed.data.identityRequireOcrVerification === true,
    identityAllowedDocumentTypes,
    identityOcrDecisionMode: parsed.data.identityOcrDecisionMode ?? "assist",
    existingConfig,
  });

  try {
    await updateSite(context.companyId, siteId, {
      access_control: nextConfig as unknown as Prisma.InputJsonValue,
    });

    if (
      nextConfig.hardware.enabled &&
      nextConfig.hardware.endpointUrl &&
      namedConnectorProvider
    ) {
      await upsertAccessConnectorConfig(context.companyId, {
        site_id: siteId,
        provider: namedConnectorProvider,
        endpoint_url: nextConfig.hardware.endpointUrl,
        auth_token: nextConfig.hardware.authToken,
        settings: {
          source: "site_access_control",
          updated_by: context.userId,
        },
        is_active: true,
      });
    }

    await createAuditLog(context.companyId, {
      action: "site.access_control_update",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        geofence_mode: nextConfig.geofence.mode,
        geofence_allow_missing_location: nextConfig.geofence.allowMissingLocation,
        geofence_has_override_code: Boolean(nextConfig.geofence.overrideCodeHash),
        geofence_automation_mode: nextConfig.geofence.automationMode,
        geofence_auto_checkout_grace_minutes:
          nextConfig.geofence.autoCheckoutGraceMinutes,
        hardware_enabled: nextConfig.hardware.enabled,
        hardware_provider: nextConfig.hardware.provider,
        hardware_endpoint_host: nextConfig.hardware.endpointUrl
          ? new URL(nextConfig.hardware.endpointUrl).host
          : null,
        hardware_has_auth_token: Boolean(nextConfig.hardware.authToken),
        hardware_named_connector_provider: namedConnectorProvider,
        identity_enabled: nextConfig.identity.enabled,
        identity_require_photo: nextConfig.identity.requirePhoto,
        identity_require_id_scan: nextConfig.identity.requireIdScan,
        identity_require_consent: nextConfig.identity.requireConsent,
        identity_require_ocr_verification:
          nextConfig.identity.requireOcrVerification,
        identity_allowed_document_types: nextConfig.identity.allowedDocumentTypes,
        identity_ocr_decision_mode: nextConfig.identity.ocrDecisionMode,
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
