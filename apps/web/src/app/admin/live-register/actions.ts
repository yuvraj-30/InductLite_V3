"use server";

/**
 * Live Register Server Actions
 *
 * Handles admin sign-out of visitors and live register queries.
 * Origin verification is enforced for mutating operations.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAdmin, assertOrigin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findSignInById,
  signOutVisitor,
  listCurrentlyOnSite,
  countCurrentlyOnSite,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  type ApiResponse,
  successResponse,
  errorResponse,
  permissionDeniedResponse,
  validationErrorResponse,
} from "@/lib/api";

/**
 * Zod schema for sign-in ID validation
 */
const signInIdSchema = z.string().cuid("Invalid sign-in record ID");

/**
 * Admin sign-out action
 * Only admins can sign out visitors on their behalf
 */
export async function adminSignOutAction(
  signInId: string,
): Promise<ApiResponse<{ signInId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  // Validate input
  const parsed = signInIdSchema.safeParse(signInId);
  if (!parsed.success) {
    return validationErrorResponse(
      { signInId: parsed.error.errors.map((e) => e.message) },
      "Invalid sign-in record ID",
    );
  }

  // Check admin permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  // Get tenant context
  const context = await requireAuthenticatedContextReadOnly();

  // Verify the sign-in record exists and belongs to company
  const signInRecord = await findSignInById(context.companyId, signInId);
  if (!signInRecord) {
    return errorResponse("NOT_FOUND", "Sign-in record not found");
  }

  if (signInRecord.sign_out_ts) {
    return errorResponse("INVALID_INPUT", "Visitor has already signed out");
  }

  try {
    // Perform sign-out with admin user ID
    await signOutVisitor(context.companyId, signInId, context.userId);

    // Audit log
    await createAuditLog(context.companyId, {
      action: "signin.signout",
      entity_type: "SignInRecord",
      entity_id: signInId,
      user_id: context.userId,
      details: {
        visitor_name: signInRecord.visitor_name,
        site_name: signInRecord.site.name,
        sign_in_ts: signInRecord.sign_in_ts.toISOString(),
        signed_out_by: "admin",
      },
      request_id: requestId,
    });

    log.info(
      { signInId, visitorName: signInRecord.visitor_name },
      "Admin signed out visitor",
    );

    revalidatePath("/admin/live-register");
    revalidatePath("/admin/history");

    return successResponse(
      { signInId },
      `${signInRecord.visitor_name} has been signed out`,
    );
  } catch (error) {
    log.error({ error: String(error) }, "Failed to sign out visitor");
    return errorResponse("INTERNAL_ERROR", "Failed to sign out visitor");
  }
}

/**
 * Get current on-site count for a specific site or all sites
 */
export async function getOnSiteCountAction(
  siteId?: string,
): Promise<ApiResponse<{ count: number }>> {
  const context = await requireAuthenticatedContextReadOnly();
  const count = await countCurrentlyOnSite(context.companyId, siteId);
  return successResponse({ count });
}

/**
 * Get all currently on-site visitors
 */
export async function getCurrentlyOnSiteAction(siteId?: string) {
  const context = await requireAuthenticatedContextReadOnly();
  const records = await listCurrentlyOnSite(context.companyId, siteId);
  return records;
}
