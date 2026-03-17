"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  assertOrigin,
  checkPermission,
  checkSitePermission,
} from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  addActionComment,
  closeActionEntry,
  createActionEntry,
  findActionEntryById,
  updateActionEntry,
} from "@/lib/repository/action.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";

const createActionSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  sourceType: z
    .enum([
      "MANUAL",
      "INCIDENT",
      "HAZARD",
      "PERMIT",
      "EMERGENCY",
      "INSPECTION",
      "COMPETENCY",
      "RESOURCE",
    ])
    .default("MANUAL"),
  sourceId: z.string().optional().or(z.literal("")),
  title: z.string().min(3).max(160),
  description: z.string().max(4000).optional().or(z.literal("")),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  ownerUserId: z.string().cuid().optional().or(z.literal("")),
  dueAt: z.string().optional().or(z.literal("")),
});

const updateActionStatusSchema = z.object({
  actionId: z.string().cuid(),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "CLOSED"]),
});

const commentActionSchema = z.object({
  actionId: z.string().cuid(),
  body: z.string().min(2).max(2000),
});

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({
    flashStatus: status,
    flashMessage: message,
  });
  redirect(`/admin/actions?${params.toString()}`);
}

async function authorizeForSite(siteId?: string | null) {
  if (siteId) {
    const siteGuard = await checkSitePermission("site:manage", siteId);
    if (!siteGuard.success) {
      statusRedirect("error", siteGuard.error);
    }
  } else {
    const permission = await checkPermission("site:manage");
    if (!permission.success) {
      statusRedirect("error", permission.error);
    }
  }

  return requireAuthenticatedContextReadOnly();
}

export async function createActionEntryAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = createActionSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    sourceType: formData.get("sourceType")?.toString() ?? "MANUAL",
    sourceId: formData.get("sourceId")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    priority: formData.get("priority")?.toString() ?? "MEDIUM",
    ownerUserId: formData.get("ownerUserId")?.toString() ?? "",
    dueAt: formData.get("dueAt")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid action input");
  }

  const context = await authorizeForSite(parsed.data.siteId || null);
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/actions",
    method: "POST",
  });

  const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    statusRedirect("error", "Due date is invalid");
  }

  try {
    const created = await createActionEntry(context.companyId, {
      site_id: parsed.data.siteId || null,
      source_type: parsed.data.sourceType,
      source_id: parsed.data.sourceId || null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      priority: parsed.data.priority,
      owner_user_id: parsed.data.ownerUserId || null,
      reported_by_user_id: context.userId,
      due_at: dueAt,
    });

    await createAuditLog(context.companyId, {
      action: "action.create",
      entity_type: "ActionRegisterEntry",
      entity_id: created.id,
      user_id: context.userId,
      details: {
        site_id: created.site_id,
        source_type: created.source_type,
        source_id: created.source_id,
        priority: created.priority,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Action created");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create action");
    statusRedirect("error", "Failed to create action");
  }
}

export async function updateActionStatusAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = updateActionStatusSchema.safeParse({
    actionId: formData.get("actionId")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "OPEN",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid action update");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findActionEntryById(context.companyId, parsed.data.actionId);
  if (!existing) {
    statusRedirect("error", "Action not found");
  }

  await authorizeForSite(existing.site_id);
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/actions",
    method: "POST",
  });

  try {
    const updated =
      parsed.data.status === "CLOSED"
        ? await closeActionEntry(context.companyId, parsed.data.actionId, context.userId)
        : await updateActionEntry(context.companyId, parsed.data.actionId, {
            status: parsed.data.status,
          });

    await createAuditLog(context.companyId, {
      action: "action.status_update",
      entity_type: "ActionRegisterEntry",
      entity_id: updated.id,
      user_id: context.userId,
      details: {
        status: updated.status,
        site_id: updated.site_id,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Action updated");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update action status");
    statusRedirect("error", "Failed to update action");
  }
}

export async function addActionCommentAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = commentActionSchema.safeParse({
    actionId: formData.get("actionId")?.toString() ?? "",
    body: formData.get("body")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid comment");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const existing = await findActionEntryById(context.companyId, parsed.data.actionId);
  if (!existing) {
    statusRedirect("error", "Action not found");
  }

  await authorizeForSite(existing.site_id);
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/actions",
    method: "POST",
  });

  try {
    const comment = await addActionComment(context.companyId, {
      action_id: parsed.data.actionId,
      author_user_id: context.userId,
      body: parsed.data.body,
    });

    await createAuditLog(context.companyId, {
      action: "action.comment_add",
      entity_type: "ActionComment",
      entity_id: comment.id,
      user_id: context.userId,
      details: {
        action_id: parsed.data.actionId,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Comment added");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to add action comment");
    statusRedirect("error", "Failed to add comment");
  }
}
