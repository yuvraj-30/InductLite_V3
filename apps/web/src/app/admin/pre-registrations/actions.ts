"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { headers } from "next/headers";
import { randomBytes } from "crypto";
import { formatToE164 } from "@inductlite/shared";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  createPreRegistrationInvite,
  deactivatePreRegistrationInvite,
  findSiteById,
  queueEmailNotification,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createPublicLinkForSite,
  findActivePublicLinkForSite,
} from "@/lib/repository/site.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { getPublicBaseUrl } from "@/lib/url/public-url";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

const createPreRegistrationSchema = z.object({
  siteId: z.string().cuid("Invalid site id"),
  visitorName: z.string().min(2, "Name must be at least 2 characters").max(100),
  visitorPhone: z
    .string()
    .min(6, "Phone number is too short")
    .max(20, "Phone number is too long")
    .regex(/^[\d\s\-+()]+$/, "Invalid phone number format"),
  visitorEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  employerName: z.string().max(100).optional().or(z.literal("")),
  visitorType: z.enum(["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"]),
  roleOnSite: z.string().max(100).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  expiresAt: z.string().optional().or(z.literal("")),
});

const BULK_INVITE_CSV_MAX_BYTES = 200_000;
const BULK_MAX_ROWS = 200;

const bulkInviteUploadSchema = z.object({
  siteId: z.string().cuid("Invalid site id"),
  csvData: z
    .string()
    .min(1, "CSV data is required")
    .max(
      BULK_INVITE_CSV_MAX_BYTES,
      `CSV payload exceeds ${BULK_INVITE_CSV_MAX_BYTES} characters`,
    ),
  sendInviteEmail: z.boolean().default(true),
});

const bulkInviteRowSchema = z.object({
  visitorName: z.string().min(2).max(100),
  visitorPhone: z
    .string()
    .min(6)
    .max(20)
    .regex(/^[\d\s\-+()]+$/),
  visitorEmail: z.string().email().optional(),
  employerName: z.string().max(100).optional(),
  visitorType: z.enum(["CONTRACTOR", "VISITOR", "EMPLOYEE", "DELIVERY"]),
  roleOnSite: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  expiresAt: z.string().optional(),
});

export type PreRegistrationActionResult =
  | {
      success: true;
      message: string;
      inviteId?: string;
      inviteLink?: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

export interface BulkInviteCreatedRow {
  row: number;
  inviteId: string;
  visitorName: string;
  visitorType: "CONTRACTOR" | "VISITOR" | "EMPLOYEE" | "DELIVERY";
  inviteLink: string;
  expiresAt: string;
  inviteEmailQueued: boolean;
}

export interface BulkInviteFailedRow {
  row: number;
  visitorName?: string;
  error: string;
}

export type BulkPreRegistrationActionResult =
  | {
      success: true;
      message: string;
      created: BulkInviteCreatedRow[];
      failed: BulkInviteFailedRow[];
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      created?: BulkInviteCreatedRow[];
      failed?: BulkInviteFailedRow[];
    };

function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] = fieldErrors[field] ?? [];
    fieldErrors[field].push(issue.message);
  }
  return fieldErrors;
}

function getOptionalFormString(
  formData: FormData,
  key: string,
): string | undefined {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function generateSecureSlug(): string {
  return randomBytes(16).toString("base64url");
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

const DEFAULT_BULK_HEADERS = [
  "visitorName",
  "visitorPhone",
  "visitorEmail",
  "employerName",
  "visitorType",
  "roleOnSite",
  "notes",
  "expiresAt",
] as const;

const HEADER_ALIASES: Record<string, (typeof DEFAULT_BULK_HEADERS)[number]> = {
  visitorname: "visitorName",
  visitor_name: "visitorName",
  name: "visitorName",
  visitorphone: "visitorPhone",
  visitor_phone: "visitorPhone",
  phone: "visitorPhone",
  visitoremail: "visitorEmail",
  visitor_email: "visitorEmail",
  email: "visitorEmail",
  employername: "employerName",
  employer_name: "employerName",
  employeename: "employerName",
  visitortype: "visitorType",
  visitor_type: "visitorType",
  type: "visitorType",
  roleonsite: "roleOnSite",
  role_on_site: "roleOnSite",
  role: "roleOnSite",
  notes: "notes",
  expiresat: "expiresAt",
  expires_at: "expiresAt",
  expiry: "expiresAt",
};

interface ParsedBulkInviteRow {
  row: number;
  values: Record<(typeof DEFAULT_BULK_HEADERS)[number], string>;
}

function parseBulkInviteCsv(input: string): {
  rows: ParsedBulkInviteRow[];
  errors: BulkInviteFailedRow[];
} {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return {
      rows: [],
      errors: [{ row: 0, error: "CSV input is empty" }],
    };
  }

  const firstLineCells = parseCsvLine(lines[0] ?? "");
  const normalizedHeaders = firstLineCells.map((value) =>
    value.toLowerCase().replace(/\s+/g, ""),
  );
  const inferredHeaders = normalizedHeaders.map((header) => HEADER_ALIASES[header]);
  const hasHeaderRow =
    inferredHeaders.includes("visitorName") || inferredHeaders.includes("visitorPhone");
  const activeHeaders = hasHeaderRow
    ? inferredHeaders.map((header, index) => header ?? DEFAULT_BULK_HEADERS[index] ?? null)
    : [...DEFAULT_BULK_HEADERS];

  const startIndex = hasHeaderRow ? 1 : 0;
  const rows: ParsedBulkInviteRow[] = [];
  const errors: BulkInviteFailedRow[] = [];

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line) continue;
    const cells = parseCsvLine(line);
    const values = {
      visitorName: "",
      visitorPhone: "",
      visitorEmail: "",
      employerName: "",
      visitorType: "",
      roleOnSite: "",
      notes: "",
      expiresAt: "",
    };

    for (let cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      const header = activeHeaders[cellIndex];
      if (!header) continue;
      values[header] = cells[cellIndex] ?? "";
    }

    rows.push({
      row: index + 1,
      values,
    });
  }

  if (rows.length > BULK_MAX_ROWS) {
    errors.push({
      row: 0,
      error: `Bulk upload exceeds max rows (${BULK_MAX_ROWS})`,
    });
  }

  return {
    rows: rows.slice(0, BULK_MAX_ROWS),
    errors,
  };
}

async function resolvePublicSlug(companyId: string, siteId: string): Promise<string> {
  const existingPublicLink = await findActivePublicLinkForSite(companyId, siteId);
  if (existingPublicLink?.slug) {
    return existingPublicLink.slug;
  }

  const createdLink = await createPublicLinkForSite(
    companyId,
    siteId,
    generateSecureSlug(),
  );
  return createdLink.slug;
}

function buildInviteLink(
  publicSlug: string,
  inviteToken: string,
  requestOrigin?: string,
): string {
  const invitePath = `/s/${publicSlug}?invite=${encodeURIComponent(inviteToken)}`;

  try {
    const publicBase = getPublicBaseUrl(requestOrigin);
    return new URL(invitePath, publicBase).toString();
  } catch {
    return invitePath;
  }
}

function buildInviteEmailBody(input: {
  siteName: string;
  visitorName: string;
  inviteLink: string;
  expiresAt: Date;
}) {
  return `
    <h1>Your Site Arrival Link</h1>
    <p>Hello ${input.visitorName},</p>
    <p>You have been pre-registered for <strong>${input.siteName}</strong>.</p>
    <p>Use this secure link when you arrive on site:</p>
    <p><a href="${input.inviteLink}">${input.inviteLink}</a></p>
    <p>This link expires at ${input.expiresAt.toISOString()}.</p>
  `;
}

function toRequestOrigin(headersList: Headers): string | undefined {
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  if (!host) return undefined;
  return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
}

export async function createPreRegistrationInviteAction(
  _prevState: PreRegistrationActionResult | null,
  formData: FormData,
): Promise<PreRegistrationActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/pre-registrations",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsed = createPreRegistrationSchema.safeParse({
    siteId: formData.get("siteId"),
    visitorName: formData.get("visitorName"),
    visitorPhone: formData.get("visitorPhone"),
    visitorEmail: getOptionalFormString(formData, "visitorEmail"),
    employerName: getOptionalFormString(formData, "employerName"),
    visitorType: formData.get("visitorType") ?? "CONTRACTOR",
    roleOnSite: getOptionalFormString(formData, "roleOnSite"),
    notes: getOptionalFormString(formData, "notes"),
    expiresAt: getOptionalFormString(formData, "expiresAt"),
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const permission = await checkSitePermission("site:manage", parsed.data.siteId);
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "PREREG_INVITES",
      parsed.data.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Pre-registration invites are disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    log.error(
      { requestId, siteId: parsed.data.siteId, error: String(error) },
      "Pre-registration entitlement check failed",
    );
    return { success: false, error: "Failed to create invite" };
  }

  const site = await findSiteById(context.companyId, parsed.data.siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  const formattedPhone = formatToE164(parsed.data.visitorPhone, "NZ");
  if (!formattedPhone) {
    return {
      success: false,
      error: "Invalid phone number",
      fieldErrors: { visitorPhone: ["Invalid NZ phone number"] },
    };
  }

  let expiresAt: Date | undefined;
  if (parsed.data.expiresAt) {
    const parsedDate = new Date(parsed.data.expiresAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return {
        success: false,
        error: "Invalid expiry date",
        fieldErrors: { expiresAt: ["Invalid expiry date"] },
      };
    }
    if (parsedDate.getTime() <= Date.now()) {
      return {
        success: false,
        error: "Expiry date must be in the future",
        fieldErrors: { expiresAt: ["Expiry date must be in the future"] },
      };
    }
    expiresAt = parsedDate;
  }

  try {
    const created = await createPreRegistrationInvite(context.companyId, {
      siteId: parsed.data.siteId,
      visitorName: parsed.data.visitorName,
      visitorPhone: formattedPhone,
      visitorEmail: parsed.data.visitorEmail || undefined,
      employerName: parsed.data.employerName || undefined,
      visitorType: parsed.data.visitorType,
      roleOnSite: parsed.data.roleOnSite || undefined,
      notes: parsed.data.notes || undefined,
      expiresAt,
      createdBy: context.userId,
    });

    const publicSlug = await resolvePublicSlug(context.companyId, parsed.data.siteId);

    const requestHeaders = await headers();
    const requestOrigin = toRequestOrigin(requestHeaders);
    const inviteLink = buildInviteLink(publicSlug, created.inviteToken, requestOrigin);

    await createAuditLog(context.companyId, {
      action: "preregistration.create",
      entity_type: "PreRegistrationInvite",
      entity_id: created.invite.id,
      user_id: context.userId,
      details: {
        site_id: parsed.data.siteId,
        site_name: site.name,
        visitor_name: created.invite.visitor_name,
        visitor_type: created.invite.visitor_type,
        expires_at: created.invite.expires_at.toISOString(),
      },
      request_id: requestId,
    });

    revalidatePath("/admin/pre-registrations");
    revalidatePath(`/admin/sites/${parsed.data.siteId}`);

    return {
      success: true,
      message: "Pre-registration invite created",
      inviteId: created.invite.id,
      inviteLink,
    };
  } catch (error) {
    log.error({ requestId, error: String(error) }, "Create invite failed");
    return { success: false, error: "Failed to create invite" };
  }
}

export async function bulkCreatePreRegistrationInvitesAction(
  _prevState: BulkPreRegistrationActionResult | null,
  formData: FormData,
): Promise<BulkPreRegistrationActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/pre-registrations",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const parsed = bulkInviteUploadSchema.safeParse({
    siteId: formData.get("siteId"),
    csvData: formData.get("csvData"),
    sendInviteEmail: formData.get("sendInviteEmail") === "on",
  });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid bulk CSV input",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const permission = await checkSitePermission("site:manage", parsed.data.siteId);
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "PREREG_INVITES",
      parsed.data.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Pre-registration invites are disabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    return { success: false, error: "Failed to process bulk invites" };
  }

  const site = await findSiteById(context.companyId, parsed.data.siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  const parsedCsv = parseBulkInviteCsv(parsed.data.csvData);
  const created: BulkInviteCreatedRow[] = [];
  const failed: BulkInviteFailedRow[] = [...parsedCsv.errors];

  if (parsedCsv.rows.length === 0) {
    return {
      success: false,
      error: failed[0]?.error ?? "No invite rows found in CSV input",
      failed,
    };
  }

  try {
    const requestHeaders = await headers();
    const requestOrigin = toRequestOrigin(requestHeaders);
    const publicSlug = await resolvePublicSlug(context.companyId, parsed.data.siteId);

    for (const row of parsedCsv.rows) {
      const normalizedRow = {
        visitorName: row.values.visitorName?.trim() ?? "",
        visitorPhone: row.values.visitorPhone?.trim() ?? "",
        visitorEmail: row.values.visitorEmail?.trim() || undefined,
        employerName: row.values.employerName?.trim() || undefined,
        visitorType: row.values.visitorType?.trim().toUpperCase() || "CONTRACTOR",
        roleOnSite: row.values.roleOnSite?.trim() || undefined,
        notes: row.values.notes?.trim() || undefined,
        expiresAt: row.values.expiresAt?.trim() || undefined,
      };

      const rowValidation = bulkInviteRowSchema.safeParse(normalizedRow);
      if (!rowValidation.success) {
        failed.push({
          row: row.row,
          visitorName: normalizedRow.visitorName || undefined,
          error: rowValidation.error.issues[0]?.message ?? "Invalid row format",
        });
        continue;
      }

      const formattedPhone = formatToE164(rowValidation.data.visitorPhone, "NZ");
      if (!formattedPhone) {
        failed.push({
          row: row.row,
          visitorName: rowValidation.data.visitorName,
          error: "Invalid NZ phone number",
        });
        continue;
      }

      let expiresAt: Date | undefined;
      if (rowValidation.data.expiresAt) {
        const parsedExpiry = new Date(rowValidation.data.expiresAt);
        if (Number.isNaN(parsedExpiry.getTime())) {
          failed.push({
            row: row.row,
            visitorName: rowValidation.data.visitorName,
            error: "Invalid expiry date",
          });
          continue;
        }
        if (parsedExpiry.getTime() <= Date.now()) {
          failed.push({
            row: row.row,
            visitorName: rowValidation.data.visitorName,
            error: "Expiry date must be in the future",
          });
          continue;
        }
        expiresAt = parsedExpiry;
      }

      try {
        const inviteResult = await createPreRegistrationInvite(context.companyId, {
          siteId: parsed.data.siteId,
          visitorName: rowValidation.data.visitorName,
          visitorPhone: formattedPhone,
          visitorEmail: rowValidation.data.visitorEmail,
          employerName: rowValidation.data.employerName,
          visitorType: rowValidation.data.visitorType,
          roleOnSite: rowValidation.data.roleOnSite,
          notes: rowValidation.data.notes,
          expiresAt,
          createdBy: context.userId,
        });

        const inviteLink = buildInviteLink(
          publicSlug,
          inviteResult.inviteToken,
          requestOrigin,
        );

        let inviteEmailQueued = false;
        if (parsed.data.sendInviteEmail && rowValidation.data.visitorEmail) {
          try {
            await queueEmailNotification(context.companyId, {
              to: rowValidation.data.visitorEmail,
              subject: `Pre-registration invite for ${site.name}`,
              body: buildInviteEmailBody({
                siteName: site.name,
                visitorName: rowValidation.data.visitorName,
                inviteLink,
                expiresAt: inviteResult.invite.expires_at,
              }),
            });
            inviteEmailQueued = true;
          } catch (emailError) {
            log.error(
              {
                requestId,
                siteId: parsed.data.siteId,
                inviteId: inviteResult.invite.id,
                row: row.row,
                error: String(emailError),
              },
              "Failed to queue invite email for bulk pre-registration row",
            );
          }
        }

        await createAuditLog(context.companyId, {
          action: "preregistration.create",
          entity_type: "PreRegistrationInvite",
          entity_id: inviteResult.invite.id,
          user_id: context.userId,
          details: {
            source: "bulk_csv",
            row: row.row,
            site_id: parsed.data.siteId,
            site_name: site.name,
            visitor_name: inviteResult.invite.visitor_name,
            visitor_type: inviteResult.invite.visitor_type,
            expires_at: inviteResult.invite.expires_at.toISOString(),
            invite_email_queued: inviteEmailQueued,
          },
          request_id: requestId,
        });

        created.push({
          row: row.row,
          inviteId: inviteResult.invite.id,
          visitorName: inviteResult.invite.visitor_name,
          visitorType: inviteResult.invite.visitor_type,
          inviteLink,
          expiresAt: inviteResult.invite.expires_at.toISOString(),
          inviteEmailQueued,
        });
      } catch (rowError) {
        failed.push({
          row: row.row,
          visitorName: normalizedRow.visitorName || undefined,
          error: rowError instanceof Error ? rowError.message : "Failed to create invite",
        });
      }
    }
  } catch (error) {
    log.error(
      { requestId, siteId: parsed.data.siteId, error: String(error) },
      "Bulk pre-registration processing failed",
    );
    return {
      success: false,
      error: "Failed to process bulk pre-registration invites",
      created,
      failed,
    };
  }

  revalidatePath("/admin/pre-registrations");
  revalidatePath(`/admin/sites/${parsed.data.siteId}`);

  if (created.length === 0) {
    return {
      success: false,
      error: "No invites were created from this CSV upload",
      failed,
    };
  }

  return {
    success: true,
    message:
      failed.length === 0
        ? `Created ${created.length} invites successfully`
        : `Created ${created.length} invites with ${failed.length} row errors`,
    created,
    failed,
  };
}

export async function deactivatePreRegistrationInviteAction(
  inviteId: string,
  siteId: string,
): Promise<PreRegistrationActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/pre-registrations",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const permission = await checkSitePermission("site:manage", siteId);
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  try {
    const deactivated = await deactivatePreRegistrationInvite(
      context.companyId,
      inviteId,
    );
    if (!deactivated) {
      return { success: false, error: "Invite not found" };
    }

    await createAuditLog(context.companyId, {
      action: "preregistration.deactivate",
      entity_type: "PreRegistrationInvite",
      entity_id: inviteId,
      user_id: context.userId,
      details: { site_id: siteId },
      request_id: requestId,
    });

    revalidatePath("/admin/pre-registrations");
    revalidatePath(`/admin/sites/${siteId}`);
    return { success: true, message: "Invite deactivated" };
  } catch (error) {
    log.error({ requestId, inviteId, siteId, error: String(error) }, "Deactivate invite failed");
    return { success: false, error: "Failed to deactivate invite" };
  }
}
