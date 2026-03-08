"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findCompanyComplianceSettings,
  findCompanySsoSettings,
  updateCompanyComplianceSettings,
  updateCompanySsoSettings,
} from "@/lib/repository/company.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  buildCompanyInvoicePreview,
  syncCompanyInvoicePreviewToAccounting,
} from "@/lib/plans";
import {
  generateDirectorySyncApiKey,
  generatePartnerApiKey,
  hashDirectorySyncApiKey,
  hashPartnerApiKey,
  parseCompanySsoConfig,
  serializeCompanySsoConfig,
  setClientSecret,
} from "@/lib/identity";

const MAX_RETENTION_DAYS = 36500;
const MAX_DATA_RESIDENCY_NOTES = 500;
const DATA_RESIDENCY_REGIONS = ["NZ", "AU", "APAC", "GLOBAL"] as const;
const DATA_RESIDENCY_SCOPES = [
  "PRIMARY_ONLY",
  "PRIMARY_AND_BACKUP",
  "PROCESSING_ONLY",
] as const;
const MAX_SSO_DISPLAY_NAME = 120;
const MAX_SSO_ISSUER_URL = 2000;
const MAX_SSO_CLIENT_ID = 300;
const MAX_SSO_ROLE_CLAIM_PATH = 120;
const MAX_SSO_CLIENT_SECRET = 2000;
const MAX_SSO_LIST_TEXT = 4000;
const MIN_PARTNER_API_MONTHLY_QUOTA = 100;
const MAX_PARTNER_API_MONTHLY_QUOTA = 1_000_000;

const updateComplianceSettingsSchema = z
  .object({
    retentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    inductionRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    auditRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    incidentRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    emergencyDrillRetentionDays: z.coerce.number().int().min(1).max(MAX_RETENTION_DAYS),
    complianceLegalHold: z.coerce.boolean().default(false),
    complianceLegalHoldReason: z
      .string()
      .max(500, "Legal hold reason must be 500 characters or less")
      .optional()
      .or(z.literal("")),
    dataResidencyRegion: z
      .enum(DATA_RESIDENCY_REGIONS)
      .optional()
      .or(z.literal("")),
    dataResidencyScope: z
      .enum(DATA_RESIDENCY_SCOPES)
      .optional()
      .or(z.literal("")),
    dataResidencyNotes: z
      .string()
      .max(
        MAX_DATA_RESIDENCY_NOTES,
        `Residency notes must be ${MAX_DATA_RESIDENCY_NOTES} characters or less`,
      )
      .optional()
      .or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    const reason = value.complianceLegalHoldReason?.trim() ?? "";
    if (value.complianceLegalHold && reason.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["complianceLegalHoldReason"],
        message: "Legal hold reason is required when legal hold is enabled",
      });
    }
  });

const updateSsoSettingsSchema = z
  .object({
    enabled: z.coerce.boolean().default(false),
    provider: z.enum(["OIDC_GENERIC", "MICROSOFT_ENTRA"]),
    displayName: z
      .string()
      .trim()
      .max(MAX_SSO_DISPLAY_NAME, "Display name is too long"),
    issuerUrl: z
      .string()
      .trim()
      .max(MAX_SSO_ISSUER_URL, "Issuer URL is too long")
      .optional()
      .or(z.literal("")),
    clientId: z
      .string()
      .trim()
      .max(MAX_SSO_CLIENT_ID, "Client ID is too long")
      .optional()
      .or(z.literal("")),
    clientSecret: z
      .string()
      .trim()
      .max(MAX_SSO_CLIENT_SECRET, "Client secret is too long")
      .optional()
      .or(z.literal("")),
    scopes: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Scopes are too long")
      .optional()
      .or(z.literal("")),
    autoProvisionUsers: z.coerce.boolean().default(true),
    defaultRole: z.enum(["ADMIN", "SITE_MANAGER", "VIEWER"]),
    roleClaimPath: z
      .string()
      .trim()
      .max(MAX_SSO_ROLE_CLAIM_PATH, "Role claim path is too long")
      .optional()
      .or(z.literal("")),
    roleMappingAdmin: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Role mappings are too long")
      .optional()
      .or(z.literal("")),
    roleMappingSiteManager: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Role mappings are too long")
      .optional()
      .or(z.literal("")),
    roleMappingViewer: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Role mappings are too long")
      .optional()
      .or(z.literal("")),
    allowedEmailDomains: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Allowed domains list is too long")
      .optional()
      .or(z.literal("")),
    directorySyncEnabled: z.coerce.boolean().default(false),
    partnerApiEnabled: z.coerce.boolean().default(false),
    partnerApiScopes: z
      .string()
      .trim()
      .max(MAX_SSO_LIST_TEXT, "Partner API scopes are too long")
      .optional()
      .or(z.literal("")),
    partnerApiMonthlyQuota: z.coerce
      .number()
      .int()
      .min(MIN_PARTNER_API_MONTHLY_QUOTA)
      .max(MAX_PARTNER_API_MONTHLY_QUOTA)
      .default(10_000),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) {
      return;
    }

    if (!value.issuerUrl?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuerUrl"],
        message: "Issuer URL is required when SSO is enabled",
      });
    }

    if (!value.clientId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientId"],
        message: "Client ID is required when SSO is enabled",
      });
    }
  });

export type ComplianceSettingsActionResult =
  | { success: true; message: string }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export type BillingSyncActionResult =
  | {
      success: true;
      message: string;
      statusCode: number;
      payloadBytes: number;
      endpointHost: string;
      sentAt: string;
    }
  | { success: false; error: string };

export type SsoSettingsActionResult =
  | { success: true; message: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type RotateDirectorySyncKeyActionResult =
  | { success: true; message: string; apiKey: string }
  | { success: false; error: string };

export type RotatePartnerApiKeyActionResult =
  | { success: true; message: string; apiKey: string }
  | { success: false; error: string };

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] = fieldErrors[field] ?? [];
    fieldErrors[field].push(issue.message);
  }
  return fieldErrors;
}

function mapActionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("not found")) {
    return "Company settings not found";
  }
  if (message.toLowerCase().includes("validation")) {
    return "Invalid compliance settings";
  }
  return "Failed to update compliance settings";
}

function resolveEndpointHost(endpointUrl: string): string {
  try {
    return new URL(endpointUrl).host;
  } catch {
    return "unknown";
  }
}

function toAuditSnapshot(
  settings:
    | Awaited<ReturnType<typeof findCompanyComplianceSettings>>
    | null,
) {
  if (!settings) {
    return null;
  }

  return {
    retention_days: settings.retention_days,
    induction_retention_days: settings.induction_retention_days,
    audit_retention_days: settings.audit_retention_days,
    incident_retention_days: settings.incident_retention_days,
    emergency_drill_retention_days: settings.emergency_drill_retention_days,
    compliance_legal_hold: settings.compliance_legal_hold,
    compliance_legal_hold_reason: settings.compliance_legal_hold_reason,
    compliance_legal_hold_set_at: settings.compliance_legal_hold_set_at
      ? settings.compliance_legal_hold_set_at.toISOString()
      : null,
    data_residency_region: settings.data_residency_region,
    data_residency_scope: settings.data_residency_scope,
    data_residency_notes: settings.data_residency_notes,
    data_residency_attested_at: settings.data_residency_attested_at
      ? settings.data_residency_attested_at.toISOString()
      : null,
    data_residency_attested_by: settings.data_residency_attested_by,
  };
}

function parseDelimitedList(value: string | undefined): string[] {
  if (!value) return [];
  const deduped = new Set<string>();
  for (const entry of value.split(/[\n,]/)) {
    const normalized = entry.trim();
    if (!normalized) continue;
    deduped.add(normalized);
    if (deduped.size >= 50) break;
  }
  return [...deduped];
}

function toSsoAuditSnapshot(configRaw: unknown): Record<string, unknown> {
  const config = parseCompanySsoConfig(configRaw);
  return {
    enabled: config.enabled,
    provider: config.provider,
    displayName: config.displayName,
    issuerUrl: config.issuerUrl,
    clientId: config.clientId,
    scopes: config.scopes,
    autoProvisionUsers: config.autoProvisionUsers,
    defaultRole: config.defaultRole,
    roleClaimPath: config.roleClaimPath,
    roleMapping: config.roleMapping,
    allowedEmailDomains: config.allowedEmailDomains,
    hasClientSecret: Boolean(config.clientSecretEncrypted),
    directorySync: {
      enabled: config.directorySync.enabled,
      hasToken: Boolean(config.directorySync.tokenHash),
    },
    partnerApi: {
      enabled: config.partnerApi.enabled,
      hasToken: Boolean(config.partnerApi.tokenHash),
      scopes: config.partnerApi.scopes,
      monthlyQuota: config.partnerApi.monthlyQuota,
    },
  };
}

export async function updateComplianceSettingsAction(
  _prevState: ComplianceSettingsActionResult | null,
  formData: FormData,
): Promise<ComplianceSettingsActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsed = updateComplianceSettingsSchema.safeParse({
    retentionDays: formData.get("retentionDays"),
    inductionRetentionDays: formData.get("inductionRetentionDays"),
    auditRetentionDays: formData.get("auditRetentionDays"),
    incidentRetentionDays: formData.get("incidentRetentionDays"),
    emergencyDrillRetentionDays: formData.get("emergencyDrillRetentionDays"),
    complianceLegalHold: formData.get("complianceLegalHold") ?? false,
    complianceLegalHoldReason: formData.get("complianceLegalHoldReason"),
    dataResidencyRegion: formData.get("dataResidencyRegion") ?? "",
    dataResidencyScope: formData.get("dataResidencyScope") ?? "",
    dataResidencyNotes: formData.get("dataResidencyNotes") ?? "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const previous = await findCompanyComplianceSettings(context.companyId);
    const updated = await updateCompanyComplianceSettings(context.companyId, {
      retention_days: parsed.data.retentionDays,
      induction_retention_days: parsed.data.inductionRetentionDays,
      audit_retention_days: parsed.data.auditRetentionDays,
      incident_retention_days: parsed.data.incidentRetentionDays,
      emergency_drill_retention_days: parsed.data.emergencyDrillRetentionDays,
      compliance_legal_hold: parsed.data.complianceLegalHold,
      compliance_legal_hold_reason:
        parsed.data.complianceLegalHoldReason?.trim() || null,
      data_residency_region: parsed.data.dataResidencyRegion?.trim() || null,
      data_residency_scope: parsed.data.dataResidencyScope?.trim() || null,
      data_residency_notes: parsed.data.dataResidencyNotes?.trim() || null,
      data_residency_attested_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "settings.update",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        previous: toAuditSnapshot(previous),
        updated: toAuditSnapshot(updated),
      },
      request_id: requestId,
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin");

    return {
      success: true,
      message: "Compliance settings updated",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update compliance settings");
    return { success: false, error: mapActionError(error) };
  }
}

export async function syncBillingPreviewAction(): Promise<BillingSyncActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings/sync-billing",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const invoicePreview = await buildCompanyInvoicePreview(context.companyId);
    const syncResult = await syncCompanyInvoicePreviewToAccounting({
      invoicePreview,
    });
    const endpointHost = resolveEndpointHost(syncResult.endpointUrl);

    await createAuditLog(context.companyId, {
      action: "billing.invoice_sync",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        endpoint_host: endpointHost,
        status_code: syncResult.statusCode,
        payload_bytes: syncResult.payloadBytes,
        active_site_count: invoicePreview.activeSiteCount,
        total_cents: invoicePreview.finalTotalCents,
        sent_at: syncResult.sentAt.toISOString(),
      },
      request_id: requestId,
    });

    revalidatePath("/admin/settings");

    return {
      success: true,
      message: "Billing preview synced to accounting endpoint",
      statusCode: syncResult.statusCode,
      payloadBytes: syncResult.payloadBytes,
      endpointHost,
      sentAt: syncResult.sentAt.toISOString(),
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to sync billing preview");

    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("ACCOUNTING_SYNC_ENDPOINT_URL") ||
      message.includes("Accounting sync failed")
    ) {
      return { success: false, error: message };
    }

    return { success: false, error: "Failed to sync billing preview" };
  }
}

export async function updateSsoSettingsAction(
  _prevState: SsoSettingsActionResult | null,
  formData: FormData,
): Promise<SsoSettingsActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings/sso",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const parsed = updateSsoSettingsSchema.safeParse({
    enabled: formData.get("enabled") ?? false,
    provider: formData.get("provider"),
    displayName: formData.get("displayName"),
    issuerUrl: formData.get("issuerUrl"),
    clientId: formData.get("clientId"),
    clientSecret: formData.get("clientSecret"),
    scopes: formData.get("scopes"),
    autoProvisionUsers: formData.get("autoProvisionUsers") ?? false,
    defaultRole: formData.get("defaultRole"),
    roleClaimPath: formData.get("roleClaimPath"),
    roleMappingAdmin: formData.get("roleMappingAdmin"),
    roleMappingSiteManager: formData.get("roleMappingSiteManager"),
    roleMappingViewer: formData.get("roleMappingViewer"),
    allowedEmailDomains: formData.get("allowedEmailDomains"),
    directorySyncEnabled: formData.get("directorySyncEnabled") ?? false,
    partnerApiEnabled: formData.get("partnerApiEnabled") ?? false,
    partnerApiScopes: formData.get("partnerApiScopes") ?? "",
    partnerApiMonthlyQuota: formData.get("partnerApiMonthlyQuota") ?? "10000",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid SSO settings",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const existing = await findCompanySsoSettings(context.companyId);
    if (!existing) {
      return { success: false, error: "Company settings not found" };
    }

    const currentConfig = parseCompanySsoConfig(existing.sso_config);
    const scopeList = parseDelimitedList(parsed.data.scopes).map((scope) =>
      scope.toLowerCase(),
    );
    const allowedDomains = parseDelimitedList(parsed.data.allowedEmailDomains).map(
      (domain) => domain.toLowerCase().replace(/^@/, ""),
    );

    let nextConfig = {
      ...currentConfig,
      enabled: parsed.data.enabled,
      provider: parsed.data.provider,
      displayName: parsed.data.displayName || "Company SSO",
      issuerUrl: parsed.data.issuerUrl?.trim() ?? "",
      clientId: parsed.data.clientId?.trim() ?? "",
      scopes: scopeList.length > 0 ? scopeList : currentConfig.scopes,
      autoProvisionUsers: parsed.data.autoProvisionUsers,
      defaultRole: parsed.data.defaultRole,
      roleClaimPath: parsed.data.roleClaimPath?.trim() || "roles",
      roleMapping: {
        ADMIN: parseDelimitedList(parsed.data.roleMappingAdmin),
        SITE_MANAGER: parseDelimitedList(parsed.data.roleMappingSiteManager),
        VIEWER: parseDelimitedList(parsed.data.roleMappingViewer),
      },
      allowedEmailDomains: allowedDomains,
      directorySync: {
        enabled: parsed.data.directorySyncEnabled,
        tokenHash: currentConfig.directorySync.tokenHash,
      },
      partnerApi: {
        enabled: parsed.data.partnerApiEnabled,
        tokenHash: currentConfig.partnerApi.tokenHash,
        scopes: parseDelimitedList(parsed.data.partnerApiScopes).map((scope) =>
          scope.toLowerCase(),
        ),
        monthlyQuota: parsed.data.partnerApiMonthlyQuota,
      },
    };

    if ((parsed.data.clientSecret ?? "").trim().length > 0) {
      nextConfig = setClientSecret(nextConfig, parsed.data.clientSecret ?? null);
    }

    const normalizedConfig = parseCompanySsoConfig(
      serializeCompanySsoConfig(nextConfig),
    );
    if (
      normalizedConfig.enabled &&
      (!normalizedConfig.issuerUrl || !normalizedConfig.clientId)
    ) {
      return {
        success: false,
        error: "Issuer URL and client ID are required when SSO is enabled",
      };
    }
    if (normalizedConfig.enabled && !normalizedConfig.clientSecretEncrypted) {
      return {
        success: false,
        error: "Client secret is required when SSO is enabled",
        fieldErrors: {
          clientSecret: ["Client secret is required when SSO is enabled"],
        },
      };
    }

    await updateCompanySsoSettings(
      context.companyId,
      serializeCompanySsoConfig(normalizedConfig) as Prisma.InputJsonValue,
    );

    await createAuditLog(context.companyId, {
      action: "settings.update",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        area: "sso",
        previous: toSsoAuditSnapshot(existing.sso_config),
        updated: toSsoAuditSnapshot(serializeCompanySsoConfig(normalizedConfig)),
      } as Prisma.InputJsonValue,
      request_id: requestId,
    });

    revalidatePath("/admin/settings");
    return { success: true, message: "SSO settings updated" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update SSO settings");
    return { success: false, error: "Failed to update SSO settings" };
  }
}

export async function rotateDirectorySyncApiKeyAction(): Promise<RotateDirectorySyncKeyActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings/sso/rotate-directory-sync-key",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const existing = await findCompanySsoSettings(context.companyId);
    if (!existing) {
      return { success: false, error: "Company settings not found" };
    }

    const config = parseCompanySsoConfig(existing.sso_config);
    const apiKey = generateDirectorySyncApiKey();
    const tokenHash = hashDirectorySyncApiKey(apiKey);

    const nextConfig = {
      ...config,
      directorySync: {
        enabled: config.directorySync.enabled,
        tokenHash,
      },
    };

    await updateCompanySsoSettings(
      context.companyId,
      serializeCompanySsoConfig(nextConfig) as Prisma.InputJsonValue,
    );

    await createAuditLog(context.companyId, {
      action: "settings.update",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        area: "directory_sync",
        rotated: true,
      } as Prisma.InputJsonValue,
      request_id: requestId,
    });

    revalidatePath("/admin/settings");
    return {
      success: true,
      message: "Directory sync API key rotated",
      apiKey,
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to rotate directory sync API key");
    return { success: false, error: "Failed to rotate directory sync API key" };
  }
}

export async function rotatePartnerApiKeyAction(): Promise<RotatePartnerApiKeyActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/settings/sso/rotate-partner-api-key",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const guard = await checkPermission("settings:manage");
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const existing = await findCompanySsoSettings(context.companyId);
    if (!existing) {
      return { success: false, error: "Company settings not found" };
    }

    const config = parseCompanySsoConfig(existing.sso_config);
    const apiKey = generatePartnerApiKey();
    const tokenHash = hashPartnerApiKey(apiKey);

    const nextConfig = {
      ...config,
      partnerApi: {
        enabled: config.partnerApi.enabled,
        tokenHash,
        scopes: config.partnerApi.scopes,
        monthlyQuota: config.partnerApi.monthlyQuota,
      },
    };

    await updateCompanySsoSettings(
      context.companyId,
      serializeCompanySsoConfig(nextConfig) as Prisma.InputJsonValue,
    );

    await createAuditLog(context.companyId, {
      action: "settings.update",
      entity_type: "Company",
      entity_id: context.companyId,
      user_id: context.userId,
      details: {
        area: "partner_api",
        rotated: true,
      } as Prisma.InputJsonValue,
      request_id: requestId,
    });

    revalidatePath("/admin/settings");
    return {
      success: true,
      message: "Partner API key rotated",
      apiKey,
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to rotate partner API key");
    return { success: false, error: "Failed to rotate partner API key" };
  }
}
