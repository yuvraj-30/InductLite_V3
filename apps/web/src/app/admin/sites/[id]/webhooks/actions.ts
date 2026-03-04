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
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  buildWebhookConfigFromUrls,
  parseWebhookConfig,
  rotateWebhookSigningSecret,
} from "@/lib/webhook/config";

export type SiteWebhookActionResult =
  | {
      success: true;
      message: string;
      generatedSecret?: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

const updateSiteWebhooksSchema = z.object({
  endpointUrls: z.string().optional().or(z.literal("")),
  signingSecret: z.string().optional().or(z.literal("")),
  clearSigningSecret: z.boolean().optional(),
});

function parseUrlLines(value: string): {
  urls: string[];
  invalidLines: string[];
} {
  const deduped = new Set<string>();
  const invalidLines: string[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        invalidLines.push(trimmed);
        continue;
      }
      deduped.add(parsed.toString());
    } catch {
      invalidLines.push(trimmed);
    }
  }

  return {
    urls: [...deduped],
    invalidLines,
  };
}

export async function updateSiteWebhooksAction(
  siteId: string,
  _prevState: SiteWebhookActionResult | null,
  formData: FormData,
): Promise<SiteWebhookActionResult> {
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

  const parsed = updateSiteWebhooksSchema.safeParse({
    endpointUrls: formData.get("endpointUrls")?.toString() ?? "",
    signingSecret: formData.get("signingSecret")?.toString() ?? "",
    clearSigningSecret: formData.get("clearSigningSecret") === "on",
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
      error: parsed.error.issues[0]?.message ?? "Invalid webhook settings",
      fieldErrors,
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "WEBHOOKS_OUTBOUND",
      siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Webhook integrations are disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to evaluate webhook entitlements",
    );
    return {
      success: false,
      error: "Failed to evaluate webhook entitlements",
    };
  }

  const existingConfig = parseWebhookConfig(site.webhooks);
  const { urls, invalidLines } = parseUrlLines(parsed.data.endpointUrls ?? "");

  if (invalidLines.length > 0) {
    return {
      success: false,
      error: "One or more webhook URLs are invalid",
      fieldErrors: {
        endpointUrls: [
          `Invalid URL(s): ${invalidLines.slice(0, 3).join(", ")}`,
        ],
      },
    };
  }

  const requestedSecret = (parsed.data.signingSecret ?? "").trim();
  let nextSigningSecret = existingConfig.signingSecret;

  if (parsed.data.clearSigningSecret) {
    nextSigningSecret = null;
  } else if (requestedSecret.length > 0) {
    if (requestedSecret.length < 16) {
      return {
        success: false,
        error: "Signing secret must be at least 16 characters",
        fieldErrors: {
          signingSecret: ["Signing secret must be at least 16 characters"],
        },
      };
    }
    nextSigningSecret = requestedSecret;
  }

  const nextConfig = buildWebhookConfigFromUrls({
    urls,
    existingConfig,
    signingSecret: nextSigningSecret,
  });

  try {
    await updateSite(context.companyId, siteId, {
      webhooks: nextConfig as unknown as Prisma.InputJsonValue,
    });

    await createAuditLog(context.companyId, {
      action: "site.webhooks_update",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        endpoint_count: nextConfig.endpoints.length,
        signing_enabled: Boolean(nextConfig.signingSecret),
      },
      request_id: requestId,
    });

    revalidatePath(`/admin/sites/${siteId}`);
    revalidatePath(`/admin/sites/${siteId}/webhooks`);
    revalidatePath("/admin/webhooks");

    return {
      success: true,
      message: "Webhook settings updated",
    };
  } catch (error) {
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to update site webhook settings",
    );

    return {
      success: false,
      error: "Failed to update webhook settings",
    };
  }
}

export async function rotateSiteWebhookSecretAction(
  siteId: string,
  _prevState: SiteWebhookActionResult | null,
  _formData: FormData,
): Promise<SiteWebhookActionResult> {
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

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "WEBHOOKS_OUTBOUND",
      siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Webhook integrations are disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to evaluate webhook entitlements",
    );
    return {
      success: false,
      error: "Failed to evaluate webhook entitlements",
    };
  }

  const existingConfig = parseWebhookConfig(site.webhooks);
  const nextSecret = rotateWebhookSigningSecret();
  const nextConfig = buildWebhookConfigFromUrls({
    urls: existingConfig.endpoints.map((endpoint) => endpoint.url),
    existingConfig,
    signingSecret: nextSecret,
  });

  try {
    await updateSite(context.companyId, siteId, {
      webhooks: nextConfig as unknown as Prisma.InputJsonValue,
    });

    await createAuditLog(context.companyId, {
      action: "site.webhooks_secret_rotate",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        endpoint_count: nextConfig.endpoints.length,
      },
      request_id: requestId,
    });

    revalidatePath(`/admin/sites/${siteId}`);
    revalidatePath(`/admin/sites/${siteId}/webhooks`);
    revalidatePath("/admin/webhooks");

    return {
      success: true,
      message: "Webhook signing secret rotated",
      generatedSecret: nextSecret,
    };
  } catch (error) {
    log.error(
      {
        requestId,
        companyId: context.companyId,
        siteId,
        errorType: error instanceof Error ? error.name : "unknown",
      },
      "Failed to rotate site webhook signing secret",
    );

    return {
      success: false,
      error: "Failed to rotate webhook signing secret",
    };
  }
}
