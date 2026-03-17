import { scopedDb } from "@/lib/db/scoped-db";
import type {
  ActionComment,
  ActionPriority,
  ActionRegisterEntry,
  ActionSourceType,
  ActionStatus,
  Prisma,
} from "@prisma/client";
import {
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  RepositoryError,
  requireCompanyId,
  type PaginatedResult,
  type PaginationParams,
} from "./base";

export interface ActionFilter {
  site_id?: string;
  source_type?: ActionSourceType | ActionSourceType[];
  source_id?: string;
  status?: ActionStatus | ActionStatus[];
  owner_user_id?: string;
  overdue_only?: boolean;
  search?: string;
}

export interface CreateActionInput {
  site_id?: string | null;
  source_type?: ActionSourceType;
  source_id?: string | null;
  title: string;
  description?: string | null;
  priority?: ActionPriority;
  owner_user_id?: string | null;
  reported_by_user_id?: string | null;
  due_at?: Date | null;
  evidence_refs?: Prisma.InputJsonValue | null;
}

export interface UpdateActionInput {
  title?: string;
  description?: string | null;
  priority?: ActionPriority;
  status?: ActionStatus;
  owner_user_id?: string | null;
  due_at?: Date | null;
  evidence_refs?: Prisma.InputJsonValue | null;
}

export interface ActionSummary {
  open: number;
  in_progress: number;
  blocked: number;
  closed: number;
  overdue: number;
}

function normalizeOptionalDate(value?: Date | null): Date | null {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) {
    throw new RepositoryError("Invalid date value", "VALIDATION");
  }
  return value;
}

function buildWhere(
  companyId: string,
  filter: ActionFilter | undefined,
  now: Date,
): Prisma.ActionRegisterEntryWhereInput {
  return {
    company_id: companyId,
    ...(filter?.site_id ? { site_id: filter.site_id } : {}),
    ...(filter?.source_id ? { source_id: filter.source_id } : {}),
    ...(filter?.owner_user_id ? { owner_user_id: filter.owner_user_id } : {}),
    ...(filter?.source_type
      ? {
          source_type: Array.isArray(filter.source_type)
            ? { in: filter.source_type }
            : filter.source_type,
        }
      : {}),
    ...(filter?.status
      ? {
          status: Array.isArray(filter.status)
            ? { in: filter.status }
            : filter.status,
        }
      : {}),
    ...(filter?.overdue_only
      ? {
          due_at: { lt: now },
          status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
        }
      : {}),
    ...(filter?.search
      ? {
          OR: [
            { title: { contains: filter.search, mode: "insensitive" } },
            { description: { contains: filter.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function listActionEntries(
  companyId: string,
  filter?: ActionFilter,
  pagination?: PaginationParams,
  now: Date = new Date(),
): Promise<PaginatedResult<ActionRegisterEntry>> {
  requireCompanyId(companyId);
  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});
  const db = scopedDb(companyId);
  const where = buildWhere(companyId, filter, now);

  try {
    const [items, total] = await Promise.all([
      db.actionRegisterEntry.findMany({
        where,
        orderBy: [{ due_at: "asc" }, { created_at: "desc" }],
        skip,
        take,
      }),
      db.actionRegisterEntry.count({ where }),
    ]);
    return paginatedResult(items, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function listActionEntriesForSource(
  companyId: string,
  input: {
    source_type: ActionSourceType;
    source_id: string;
    include_closed?: boolean;
  },
): Promise<ActionRegisterEntry[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.actionRegisterEntry.findMany({
      where: {
        company_id: companyId,
        source_type: input.source_type,
        source_id: input.source_id,
        ...(input.include_closed ? {} : { status: { not: "CLOSED" } }),
      },
      orderBy: [{ due_at: "asc" }, { created_at: "desc" }],
      take: 100,
    });
  } catch (error) {
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function findActionEntryById(
  companyId: string,
  actionId: string,
): Promise<ActionRegisterEntry | null> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.actionRegisterEntry.findFirst({
      where: { id: actionId, company_id: companyId },
    });
  } catch (error) {
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function createActionEntry(
  companyId: string,
  input: CreateActionInput,
): Promise<ActionRegisterEntry> {
  requireCompanyId(companyId);
  if (!input.title?.trim()) {
    throw new RepositoryError("Action title is required", "VALIDATION");
  }

  const db = scopedDb(companyId);
  const dueAt = normalizeOptionalDate(input.due_at);

  try {
    return await db.actionRegisterEntry.create({
      data: {
        site_id: input.site_id ?? null,
        source_type: input.source_type ?? "MANUAL",
        source_id: input.source_id ?? null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        priority: input.priority ?? "MEDIUM",
        status: "OPEN",
        owner_user_id: input.owner_user_id ?? null,
        reported_by_user_id: input.reported_by_user_id ?? null,
        due_at: dueAt,
        evidence_refs: (input.evidence_refs ?? null) as Prisma.InputJsonValue | null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function updateActionEntry(
  companyId: string,
  actionId: string,
  input: UpdateActionInput,
): Promise<ActionRegisterEntry> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    const result = await db.actionRegisterEntry.updateMany({
      where: { id: actionId, company_id: companyId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.owner_user_id !== undefined
          ? { owner_user_id: input.owner_user_id }
          : {}),
        ...(input.due_at !== undefined ? { due_at: normalizeOptionalDate(input.due_at) } : {}),
        ...(input.evidence_refs !== undefined
          ? { evidence_refs: input.evidence_refs as Prisma.InputJsonValue | null }
          : {}),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Action not found", "NOT_FOUND");
    }

    const updated = await db.actionRegisterEntry.findFirst({
      where: { id: actionId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Action not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function closeActionEntry(
  companyId: string,
  actionId: string,
  closedByUserId?: string | null,
): Promise<ActionRegisterEntry> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    const result = await db.actionRegisterEntry.updateMany({
      where: { id: actionId, company_id: companyId },
      data: {
        status: "CLOSED",
        closed_at: new Date(),
        closed_by_user_id: closedByUserId ?? null,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Action not found", "NOT_FOUND");
    }

    const updated = await db.actionRegisterEntry.findFirst({
      where: { id: actionId, company_id: companyId },
    });
    if (!updated) {
      throw new RepositoryError("Action not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ActionRegisterEntry");
  }
}

export async function listActionComments(
  companyId: string,
  actionId: string,
): Promise<ActionComment[]> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    return await db.actionComment.findMany({
      where: { company_id: companyId, action_id: actionId },
      orderBy: { created_at: "asc" },
      take: 100,
    });
  } catch (error) {
    handlePrismaError(error, "ActionComment");
  }
}

export async function addActionComment(
  companyId: string,
  input: {
    action_id: string;
    author_user_id?: string | null;
    body: string;
  },
): Promise<ActionComment> {
  requireCompanyId(companyId);
  if (!input.body?.trim()) {
    throw new RepositoryError("Action comment body is required", "VALIDATION");
  }

  const db = scopedDb(companyId);
  const action = await findActionEntryById(companyId, input.action_id);
  if (!action) {
    throw new RepositoryError("Action not found", "NOT_FOUND");
  }

  try {
    return await db.actionComment.create({
      data: {
        action_id: input.action_id,
        author_user_id: input.author_user_id ?? null,
        body: input.body.trim(),
      },
    });
  } catch (error) {
    handlePrismaError(error, "ActionComment");
  }
}

export async function getActionSummary(
  companyId: string,
  now: Date = new Date(),
): Promise<ActionSummary> {
  requireCompanyId(companyId);
  const db = scopedDb(companyId);

  try {
    const [open, inProgress, blocked, closed, overdue] = await Promise.all([
      db.actionRegisterEntry.count({
        where: { company_id: companyId, status: "OPEN" },
      }),
      db.actionRegisterEntry.count({
        where: { company_id: companyId, status: "IN_PROGRESS" },
      }),
      db.actionRegisterEntry.count({
        where: { company_id: companyId, status: "BLOCKED" },
      }),
      db.actionRegisterEntry.count({
        where: { company_id: companyId, status: "CLOSED" },
      }),
      db.actionRegisterEntry.count({
        where: {
          company_id: companyId,
          status: { in: ["OPEN", "IN_PROGRESS", "BLOCKED"] },
          due_at: { lt: now },
        },
      }),
    ]);

    return {
      open,
      in_progress: inProgress,
      blocked,
      closed,
      overdue,
    };
  } catch (error) {
    handlePrismaError(error, "ActionRegisterEntry");
  }
}
