/**
 * Audit Log Repository
 *
 * Handles audit logging with tenant scoping.
 * Audit logs are immutable - no update or delete operations.
 */

import { scopedDb } from "@/lib/db/scoped-db";
import { publicDb } from "@/lib/db/public-db";
import type { AuditLog, Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  buildDateRangeFilter,
  type PaginationParams,
  type PaginatedResult,
  type DateRangeFilter,
} from "./base";

/**
 * Audit log action types
 */
export type AuditAction =
  // Auth actions
  | "auth.login"
  | "auth.logout"
  | "auth.password_change"
  | "auth.login_failed"
  | "auth.lockout"
  // User actions
  | "user.create"
  | "user.update"
  | "user.deactivate"
  | "user.reactivate"
  // Site actions
  | "site.create"
  | "site.update"
  | "site.deactivate"
  | "site.reactivate"
  // Template actions
  | "template.create"
  | "template.update"
  | "template.deactivate"
  | "template.publish"
  | "template.new_version"
  | "template.archive"
  | "template.unarchive"
  | "template.delete"
  // Question actions
  | "question.create"
  | "question.update"
  | "question.delete"
  | "question.reorder"
  // Contractor actions
  | "contractor.create"
  | "contractor.update"
  | "contractor.deactivate"
  | "contractor.document_upload"
  | "contractor.document_delete"
  // Sign-in actions
  | "signin.create"
  | "signin.signout"
  // Visitor actions (public endpoints)
  | "visitor.sign_in"
  | "visitor.sign_out"
  // Export actions
  | "export.create"
  | "export.complete"
  | "export.download"
  // Public link actions
  | "publiclink.create"
  | "publiclink.deactivate";

/**
 * Audit log entry input
 */
export interface CreateAuditLogInput {
  action: AuditAction;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Prisma.InputJsonValue;
  request_id?: string;
}

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  action?: AuditAction | AuditAction[];
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  dateRange?: DateRangeFilter;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  companyId: string,
  input: CreateAuditLogInput,
): Promise<AuditLog> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.auditLog.create({
      data: {
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        user_id: input.user_id,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        details: input.details,
        request_id: input.request_id,
      },
    });
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}

/**
 * Create an audit log entry without requiring company_id (for system actions)
 */
export async function createSystemAuditLog(
  input: CreateAuditLogInput & { company_id: string },
): Promise<AuditLog> {
  try {
    // System logs can write to any company - use publicDb explicitly
    return await publicDb.auditLog.create({
      data: {
        company_id: input.company_id,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        user_id: input.user_id,
        ip_address: input.ip_address,
        user_agent: input.user_agent,
        details: input.details,
        request_id: input.request_id,
      },
    });
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}

/**
 * List audit logs for a company with pagination and filtering
 */
export async function listAuditLogs(
  companyId: string,
  filter?: AuditLogFilter,
  pagination?: PaginationParams,
): Promise<PaginatedResult<AuditLog>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination ?? {});

  const where: Prisma.AuditLogWhereInput = {
    company_id: companyId,
    ...(filter?.action && {
      action: Array.isArray(filter.action)
        ? { in: filter.action }
        : filter.action,
    }),
    ...(filter?.entity_type && { entity_type: filter.entity_type }),
    ...(filter?.entity_id && { entity_id: filter.entity_id }),
    ...(filter?.user_id && { user_id: filter.user_id }),
    ...(filter?.dateRange && {
      created_at: buildDateRangeFilter(filter.dateRange),
    }),
  };

  try {
    const db = scopedDb(companyId);
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
      }),
      db.auditLog.count({ where }),
    ]);

    return paginatedResult(logs, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  companyId: string,
  entityType: string,
  entityId: string,
  pagination?: PaginationParams,
): Promise<PaginatedResult<AuditLog>> {
  return listAuditLogs(
    companyId,
    { entity_type: entityType, entity_id: entityId },
    pagination,
  );
}

/**
 * Get recent activity for a user
 */
export async function getUserActivity(
  companyId: string,
  userId: string,
  limit: number = 20,
): Promise<AuditLog[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.auditLog.findMany({
      where: { company_id: companyId, user_id: userId },
      take: limit,
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}

/**
 * Get failed login attempts for a user
 */
export async function getFailedLoginAttempts(
  companyId: string,
  userId: string,
  since: Date,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.auditLog.count({
      where: {
        company_id: companyId,
        user_id: userId,
        action: "auth.login_failed",
        created_at: { gte: since },
      },
    });
  } catch (error) {
    // Don't throw on count failure - return 0 to allow login
    console.error("Failed to count login attempts:", error);
    return 0;
  }
}

/**
 * Clear old audit logs (for data retention compliance)
 */
export async function purgeOldAuditLogs(
  companyId: string,
  olderThan: Date,
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.auditLog.deleteMany({
      where: { company_id: companyId, created_at: { lt: olderThan } },
    });

    return result.count;
  } catch (error) {
    handlePrismaError(error, "AuditLog");
  }
}
