"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createInspectionSchedule,
  findInspectionScheduleById,
  recordInspectionRun,
} from "@/lib/repository/inspection.repository";
import { createSafetyFormSubmission } from "@/lib/repository/safety-form.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({
    flashStatus: status,
    flashMessage: message,
  });
  redirect(`/admin/inspections?${params.toString()}`);
}

const createScheduleSchema = z.object({
  siteId: z.string().cuid(),
  templateId: z.string().cuid(),
  name: z.string().min(3).max(160),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "AD_HOC"]),
  startsAt: z.string().min(1),
  assignedUserId: z.string().cuid().optional().or(z.literal("")),
});

const completeRunSchema = z.object({
  scheduleId: z.string().cuid(),
  scorePercent: z.coerce.number().int().min(0).max(100).optional(),
  failedItemCount: z.coerce.number().int().min(0).max(500).default(0),
  summary: z.string().max(2000).optional().or(z.literal("")),
  createFollowUpAction: z.coerce.boolean().default(true),
});

export async function createInspectionScheduleAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = createScheduleSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    templateId: formData.get("templateId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    frequency: formData.get("frequency")?.toString() ?? "WEEKLY",
    startsAt: formData.get("startsAt")?.toString() ?? "",
    assignedUserId: formData.get("assignedUserId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid inspection schedule");
  }

  const guard = await checkSitePermission("site:manage", parsed.data.siteId);
  if (!guard.success) {
    statusRedirect("error", guard.error);
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    statusRedirect("error", "Inspection start date is invalid");
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const schedule = await createInspectionSchedule(context.companyId, {
      site_id: parsed.data.siteId,
      template_id: parsed.data.templateId,
      name: parsed.data.name,
      frequency: parsed.data.frequency,
      starts_at: startsAt,
      assigned_user_id: parsed.data.assignedUserId || null,
    });

    await createAuditLog(context.companyId, {
      action: "inspection.schedule.create",
      entity_type: "InspectionSchedule",
      entity_id: schedule.id,
      user_id: context.userId,
      details: {
        site_id: schedule.site_id,
        template_id: schedule.template_id,
        frequency: schedule.frequency,
      },
    });

    statusRedirect("ok", "Inspection schedule created");
  } catch (error) {
    statusRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to create inspection schedule",
    );
  }
}

export async function recordInspectionRunAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const parsed = completeRunSchema.safeParse({
    scheduleId: formData.get("scheduleId")?.toString() ?? "",
    scorePercent: formData.get("scorePercent")?.toString() ?? undefined,
    failedItemCount: formData.get("failedItemCount")?.toString() ?? "0",
    summary: formData.get("summary")?.toString() ?? "",
    createFollowUpAction: formData.get("createFollowUpAction") ?? true,
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid inspection run");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const schedule = await findInspectionScheduleById(context.companyId, parsed.data.scheduleId);
  if (!schedule) {
    statusRedirect("error", "Inspection schedule not found");
  }

  const guard = await checkSitePermission("site:manage", schedule.site_id);
  if (!guard.success) {
    statusRedirect("error", guard.error);
  }

  try {
    const submission = await createSafetyFormSubmission(context.companyId, {
      site_id: schedule.site_id,
      template_id: schedule.template_id,
      submitted_by_name: context.userName,
      submitted_by_email: context.userEmail,
      payload: {
        inspectionScheduleId: schedule.id,
        failedItemCount: parsed.data.failedItemCount,
        scorePercent: parsed.data.scorePercent ?? null,
      },
      summary: parsed.data.summary || `Inspection run completed for ${schedule.name}.`,
    });

    const result = await recordInspectionRun(context.companyId, {
      schedule_id: schedule.id,
      performed_by_user_id: context.userId,
      submission_id: submission.id,
      score_percent: parsed.data.scorePercent ?? null,
      failed_item_count: parsed.data.failedItemCount,
      summary: parsed.data.summary || null,
      create_follow_up_action: parsed.data.createFollowUpAction,
      action_owner_user_id: schedule.assigned_user_id,
    });

    await createAuditLog(context.companyId, {
      action: "inspection.run.record",
      entity_type: "InspectionRun",
      entity_id: result.run.id,
      user_id: context.userId,
      details: {
        site_id: schedule.site_id,
        schedule_id: schedule.id,
        failed_item_count: result.run.failed_item_count,
        follow_up_action_id: result.followUpActionId,
      },
    });

    statusRedirect("ok", "Inspection run recorded");
  } catch (error) {
    statusRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to record inspection run",
    );
  }
}
