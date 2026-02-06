"use server";

/**
 * Site Management Server Actions
 *
 * All actions are tenant-scoped via session and use the repository layer.
 * Origin verification is enforced for all mutating operations.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAdmin, checkSitePermission, assertOrigin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant";
import {
  createSite,
  updateSite,
  deactivateSite,
  reactivateSite,
  findSiteById,
} from "@/lib/repository";
import {
  createPublicLinkForSite,
  deactivatePublicLinksForSite,
  findActivePublicLinkForSite,
} from "@/lib/repository/site.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { randomBytes } from "crypto";

/**
 * Site creation schema
 */
const createSiteSchema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters")
    .max(100, "Site name must be less than 100 characters"),
  address: z
    .string()
    .max(200, "Address must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * Site update schema
 */
const updateSiteSchema = z.object({
  name: z
    .string()
    .min(2, "Site name must be at least 2 characters")
    .max(100, "Site name must be less than 100 characters")
    .optional(),
  address: z
    .string()
    .max(200, "Address must be less than 200 characters")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .or(z.literal("")),
});

export type SiteActionResult =
  | { success: true; siteId?: string; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Generate a cryptographically secure slug for public links
 * Uses 16 bytes (128 bits) of entropy, encoded as base64url
 */
function generateSecureSlug(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Create a new site with an active public link
 */
export async function createSiteAction(
  _prevState: SiteActionResult | null,
  formData: FormData,
): Promise<SiteActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // SECURITY: Verify request origin to prevent CSRF
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  // Check permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Parse and validate input
  const rawData = {
    name: formData.get("name"),
    address: formData.get("address"),
    description: formData.get("description"),
  };

  const parsed = createSiteSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((err) => {
      const field = err.path[0]?.toString() || "form";
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(err.message);
    });
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Validation failed",
      fieldErrors,
    };
  }

  try {
    // Create the site
    const site = await createSite(context.companyId, {
      name: parsed.data.name,
      address: parsed.data.address || undefined,
      description: parsed.data.description || undefined,
    });

    // Create the initial public link with secure slug
    await createPublicLinkForSite(
      context.companyId,
      site.id,
      generateSecureSlug(),
    );

    // Audit log
    await createAuditLog(context.companyId, {
      action: "site.create",
      entity_type: "Site",
      entity_id: site.id,
      user_id: context.userId,
      details: { name: site.name },
      request_id: requestId,
    });

    log.info(
      { siteId: site.id, siteName: site.name },
      "Site created successfully",
    );

    revalidatePath("/admin/sites");
    return {
      success: true,
      siteId: site.id,
      message: "Site created successfully",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create site");

    if (String(error).includes("already exists")) {
      return { success: false, error: "A site with this name already exists" };
    }

    return { success: false, error: "Failed to create site" };
  }
}

/**
 * Update an existing site
 */
export async function updateSiteAction(
  siteId: string,
  _prevState: SiteActionResult | null,
  formData: FormData,
): Promise<SiteActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // SECURITY: Verify request origin to prevent CSRF
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  // Check permission
  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Verify site exists and belongs to company
  const existingSite = await findSiteById(context.companyId, siteId);
  if (!existingSite) {
    return { success: false, error: "Site not found" };
  }

  // Parse and validate input
  const rawData = {
    name: formData.get("name"),
    address: formData.get("address"),
    description: formData.get("description"),
  };

  const parsed = updateSiteSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message || "Validation failed",
    };
  }

  try {
    const site = await updateSite(context.companyId, siteId, {
      name: parsed.data.name,
      address: parsed.data.address || undefined,
      description: parsed.data.description || undefined,
    });

    // Audit log
    await createAuditLog(context.companyId, {
      action: "site.update",
      entity_type: "Site",
      entity_id: site.id,
      user_id: context.userId,
      details: {
        changes: {
          name:
            parsed.data.name !== existingSite.name
              ? parsed.data.name
              : undefined,
          address:
            parsed.data.address !== existingSite.address
              ? parsed.data.address
              : undefined,
        },
      },
      request_id: requestId,
    });

    log.info({ siteId: site.id }, "Site updated successfully");

    revalidatePath("/admin/sites");
    revalidatePath(`/admin/sites/${siteId}`);
    return { success: true, message: "Site updated successfully" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update site");
    return { success: false, error: "Failed to update site" };
  }
}

/**
 * Deactivate a site
 */
export async function deactivateSiteAction(
  siteId: string,
): Promise<SiteActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // SECURITY: Verify request origin to prevent CSRF
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  // Check permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Verify site exists
  const existingSite = await findSiteById(context.companyId, siteId);
  if (!existingSite) {
    return { success: false, error: "Site not found" };
  }

  try {
    await deactivateSite(context.companyId, siteId);

    // Deactivate all public links for this site
    await deactivatePublicLinksForSite(context.companyId, siteId);

    // Audit log
    await createAuditLog(context.companyId, {
      action: "site.deactivate",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      details: { name: existingSite.name },
      request_id: requestId,
    });

    log.info({ siteId }, "Site deactivated");

    revalidatePath("/admin/sites");
    return { success: true, message: "Site deactivated" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to deactivate site");
    return { success: false, error: "Failed to deactivate site" };
  }
}

/**
 * Reactivate a site
 */
export async function reactivateSiteAction(
  siteId: string,
): Promise<SiteActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // SECURITY: Verify request origin to prevent CSRF
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  // Check permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Verify site exists and belongs to company
  const existingSite = await findSiteById(context.companyId, siteId);
  if (!existingSite) {
    return { success: false, error: "Site not found" };
  }

  try {
    await reactivateSite(context.companyId, siteId);

    // Create a new public link if none active
    const activeLink = await findActivePublicLinkForSite(
      context.companyId,
      siteId,
    );

    if (!activeLink) {
      await createPublicLinkForSite(
        context.companyId,
        siteId,
        generateSecureSlug(),
      );
    }

    // Audit log
    await createAuditLog(context.companyId, {
      action: "site.reactivate",
      entity_type: "Site",
      entity_id: siteId,
      user_id: context.userId,
      request_id: requestId,
    });

    log.info({ siteId }, "Site reactivated");

    revalidatePath("/admin/sites");
    return { success: true, message: "Site reactivated" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to reactivate site");
    return { success: false, error: "Failed to reactivate site" };
  }
}

/**
 * Rotate the public link for a site
 * Deactivates the old link and creates a new one with a fresh slug
 */
export async function rotatePublicLinkAction(
  siteId: string,
): Promise<SiteActionResult & { newSlug?: string }> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  try {
    // SECURITY: Verify request origin to prevent CSRF
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  // Check permission
  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    return { success: false, error: guard.error };
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Verify site exists and belongs to company
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    return { success: false, error: "Site not found" };
  }

  try {
    // Get old active link slug for audit
    const oldLink = await findActivePublicLinkForSite(
      context.companyId,
      siteId,
    );

    // Deactivate all existing links for this site
    await deactivatePublicLinksForSite(context.companyId, siteId);

    // Create new link with fresh secure slug
    const newSlug = generateSecureSlug();
    await createPublicLinkForSite(context.companyId, siteId, newSlug);

    // Audit log
    await createAuditLog(context.companyId, {
      action: "publiclink.create",
      entity_type: "SitePublicLink",
      entity_id: siteId,
      user_id: context.userId,
      details: {
        reason: "rotation",
        oldSlugPrefix: oldLink?.slug.substring(0, 8) + "...",
        newSlugPrefix: newSlug.substring(0, 8) + "...",
      },
      request_id: requestId,
    });

    log.info({ siteId }, "Public link rotated");

    revalidatePath(`/admin/sites/${siteId}`);
    return {
      success: true,
      newSlug,
      message: "QR code link rotated successfully",
    };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to rotate public link");
    return { success: false, error: "Failed to rotate public link" };
  }
}
