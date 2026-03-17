import { scopedDb } from "@/lib/db/scoped-db";
import type {
  InspectionFrequency,
  InspectionRun,
  InspectionRunStatus,
  InspectionSchedule,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";
import { createActionEntry } from "./action.repository";

export interface ListInspectionScheduleFilter {
  site_id?: string;
  is_active?: boolean;
  due_before?: Date;
}

export interface CreateInspectionScheduleInput {
  site_id: string;
  template_id: string;
  name: string;
  frequency?: InspectionFrequency;
  starts_at: Date;
  assigned_user_id?: string | null;
}

export interface RecordInspectionRunInput {
  schedule_id: string;
  performed_by_user_id?: string | null;
  submission_id?: string | null;
  status?: InspectionRunStatus;
  score_percent?: number | null;
  failed_item_count?: number;
  summary?: string | null;
  create_follow_up_action?: boolean;
  action_owner_user_id?: string | null;
  action_due_at?: Date | null;
}

export interface InspectionSummary {
  active_schedules: number;
  overdue_schedules: number;
  completed_runs_last_30_days: number;
  failed_runs_last_30_days: number;
}

function assertDate(value: Date, label: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new RepositoryError(`${label} is invalid`, "VALIDATION");
  }
  return value;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function calculateNextDueAt(
  currentDueAt: Date,
  frequency: InspectionFrequency,
): Date {
  switch (frequency) {
    case "DAILY":
      return addDays(currentDueAt, 1);
    case "WEEKLY":
      return addDays(currentDueAt, 7);
    case "MONTHLY":
      return addDays(currentDueAt, 30);
    case "QUARTERLY":
      return addDays(currentDueAt, 90);
    case "AD_HOC":
    default:
      return addDays(currentDueAt, 3650);
  }
}

export async function listInspectionSchedules(
  companyId: string,
  filter?: ListInspectionScheduleFilter,
): Promise<InspectionSchedule[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.inspectionSchedule.findMany({
      where: {
        company_id: companyId,
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.is_active !== undefined ? { is_active: filter.is_active } : {}),
        ...(filter?.due_before ? { next_due_at: { lte: filter.due_before } } : {}),
      },
      orderBy: [{ next_due_at: "asc" }, { created_at: "desc" }],
      take: 300,
    });
  } catch (error) {
    handlePrismaError(error, "InspectionSchedule");
  }
}

export async function findInspectionScheduleById(
  companyId: string,
  scheduleId: string,
): Promise<InspectionSchedule | null> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.inspectionSchedule.findFirst({
      where: { company_id: companyId, id: scheduleId },
    });
  } catch (error) {
    handlePrismaError(error, "InspectionSchedule");
  }
}

export async function createInspectionSchedule(
  companyId: string,
  input: CreateInspectionScheduleInput,
): Promise<InspectionSchedule> {
  requireCompanyId(companyId);
  if (!input.site_id?.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.template_id?.trim()) {
    throw new RepositoryError("template_id is required", "VALIDATION");
  }
  if (!input.name?.trim()) {
    throw new RepositoryError("Inspection schedule name is required", "VALIDATION");
  }

  const startsAt = assertDate(input.starts_at, "starts_at");
  const db = scopedDb(companyId);

  try {
    return await db.inspectionSchedule.create({
      data: {
        site_id: input.site_id,
        template_id: input.template_id,
        name: input.name.trim(),
        frequency: input.frequency ?? "WEEKLY",
        starts_at: startsAt,
        next_due_at: startsAt,
        assigned_user_id: input.assigned_user_id ?? null,
        is_active: true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "InspectionSchedule");
  }
}

export async function listInspectionRuns(
  companyId: string,
  input?: { site_id?: string; schedule_id?: string },
): Promise<InspectionRun[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.inspectionRun.findMany({
      where: {
        company_id: companyId,
        ...(input?.site_id ? { site_id: input.site_id } : {}),
        ...(input?.schedule_id ? { schedule_id: input.schedule_id } : {}),
      },
      orderBy: [{ completed_at: "desc" }, { created_at: "desc" }],
      take: 300,
    });
  } catch (error) {
    handlePrismaError(error, "InspectionRun");
  }
}

export async function recordInspectionRun(
  companyId: string,
  input: RecordInspectionRunInput,
): Promise<{ run: InspectionRun; followUpActionId: string | null }> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);
  const schedule = await findInspectionScheduleById(companyId, input.schedule_id);
  if (!schedule) {
    throw new RepositoryError("Inspection schedule not found", "NOT_FOUND");
  }

  const failedItemCount = Math.max(0, Math.trunc(input.failed_item_count ?? 0));
  const completedAt = new Date();

  try {
    const run = await db.inspectionRun.create({
      data: {
        site_id: schedule.site_id,
        schedule_id: schedule.id,
        submission_id: input.submission_id ?? null,
        performed_by_user_id: input.performed_by_user_id ?? null,
        status: input.status ?? "COMPLETED",
        score_percent:
          input.score_percent !== undefined && input.score_percent !== null
            ? Math.max(0, Math.min(100, Math.trunc(input.score_percent)))
            : null,
        failed_item_count: failedItemCount,
        summary: input.summary?.trim() || null,
        started_at: completedAt,
        completed_at: completedAt,
      },
    });

    const nextDueAt = calculateNextDueAt(
      schedule.next_due_at ?? schedule.starts_at,
      schedule.frequency,
    );
    await db.inspectionSchedule.updateMany({
      where: { id: schedule.id, company_id: companyId },
      data: {
        next_due_at: nextDueAt,
      },
    });

    let followUpActionId: string | null = null;
    if ((input.create_follow_up_action ?? true) && failedItemCount > 0) {
      const action = await createActionEntry(companyId, {
        site_id: schedule.site_id,
        source_type: "INSPECTION",
        source_id: run.id,
        title: `Inspection follow-up: ${schedule.name}`,
        description:
          input.summary?.trim() ||
          `${failedItemCount} inspection findings require follow-up.`,
        priority: failedItemCount >= 3 ? "HIGH" : "MEDIUM",
        owner_user_id: input.action_owner_user_id ?? schedule.assigned_user_id,
        reported_by_user_id: input.performed_by_user_id ?? null,
        due_at: input.action_due_at ?? nextDueAt,
      });
      followUpActionId = action.id;
    }

    return { run, followUpActionId };
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "InspectionRun");
  }
}

export async function getInspectionSummary(
  companyId: string,
  now: Date = new Date(),
): Promise<InspectionSummary> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);
  const last30Days = addDays(now, -30);

  try {
    const [activeSchedules, overdueSchedules, completedRunsLast30Days, failedRunsLast30Days] =
      await Promise.all([
        db.inspectionSchedule.count({
          where: { company_id: companyId, is_active: true },
        }),
        db.inspectionSchedule.count({
          where: {
            company_id: companyId,
            is_active: true,
            next_due_at: { lt: now },
          },
        }),
        db.inspectionRun.count({
          where: {
            company_id: companyId,
            completed_at: { gte: last30Days },
          },
        }),
        db.inspectionRun.count({
          where: {
            company_id: companyId,
            completed_at: { gte: last30Days },
            failed_item_count: { gt: 0 },
          },
        }),
      ]);

    return {
      active_schedules: activeSchedules,
      overdue_schedules: overdueSchedules,
      completed_runs_last_30_days: completedRunsLast30Days,
      failed_runs_last_30_days: failedRunsLast30Days,
    };
  } catch (error) {
    handlePrismaError(error, "InspectionSchedule");
  }
}
