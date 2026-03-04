"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { resolveHardwareOutageEvent } from "@/lib/repository/hardware-trace.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const resolveOutageSchema = z.object({
  outageId: z.string().cuid(),
});

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/access-ops?${params.toString()}`);
}

async function ensureAccessOpsFeature(companyId: string) {
  try {
    await assertCompanyFeatureEnabled(companyId, "HARDWARE_ACCESS");
    return;
  } catch (error) {
    if (!(error instanceof EntitlementDeniedError)) {
      throw error;
    }
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "GATEWAY_TRACE_V1");
    return;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      statusRedirect(
        "error",
        "Access operations are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      );
    }
    throw error;
  }
}

export async function resolveHardwareOutageAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    statusRedirect("error", permission.error);
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    statusRedirect("error", "Too many admin updates right now. Please retry in a minute.");
  }

  await ensureAccessOpsFeature(context.companyId);

  const parsed = resolveOutageSchema.safeParse({
    outageId: formData.get("outageId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid outage ID");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/access-ops",
    method: "POST",
  });

  try {
    const resolved = await resolveHardwareOutageEvent(context.companyId, parsed.data.outageId);

    await createAuditLog(context.companyId, {
      action: "hardware.outage.resolve",
      entity_type: "HardwareOutageEvent",
      entity_id: resolved.id,
      user_id: context.userId,
      details: {
        site_id: resolved.site_id,
        provider: resolved.provider,
        resolved_at: resolved.resolved_at?.toISOString() ?? null,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Hardware outage marked as resolved");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to resolve hardware outage event");
    statusRedirect("error", "Failed to resolve hardware outage event");
  }
}
