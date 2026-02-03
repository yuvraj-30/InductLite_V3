/**
 * Scoped Prisma queries for tenant isolation
 *
 * CRITICAL: All data access MUST go through these scoped functions
 * to ensure tenant isolation. Direct prisma access is only allowed for:
 * - Auth bootstrap (login/session lookup)
 * - Public slug resolution (slug -> site -> company_id)
 */

import { prisma } from "./prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

export type ScopedPrisma = {
  company_id: string;
  prisma: PrismaClient;
};

/**
 * Create a company-scoped query context
 * All queries through this context are automatically scoped to the company
 */
export function scopedPrisma(companyId: string): ScopedPrisma {
  return {
    company_id: companyId,
    prisma,
  };
}

/**
 * Scoped query helpers for each tenant-owned entity
 */
export const scopedQueries = {
  // Users
  users: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.UserFindManyArgs, "where"> & {
        where?: Prisma.UserWhereInput;
      },
    ) =>
      prisma.user.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.UserFindFirstArgs, "where"> & {
        where?: Prisma.UserWhereInput;
      },
    ) =>
      prisma.user.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, userId: string) =>
      prisma.user.findFirst({
        where: { id: userId, company_id: companyId },
      }),
    update: (companyId: string, userId: string, data: Prisma.UserUpdateInput) =>
      prisma.user.updateMany({
        where: { id: userId, company_id: companyId },
        data,
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.UserCountArgs, "where"> & {
        where?: Prisma.UserWhereInput;
      },
    ) =>
      prisma.user.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Sites
  sites: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.SiteFindManyArgs, "where"> & {
        where?: Prisma.SiteWhereInput;
      },
    ) =>
      prisma.site.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.SiteFindFirstArgs, "where"> & {
        where?: Prisma.SiteWhereInput;
      },
    ) =>
      prisma.site.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, siteId: string) =>
      prisma.site.findFirst({
        where: { id: siteId, company_id: companyId },
      }),
    create: (
      companyId: string,
      data: Omit<Prisma.SiteCreateInput, "company">,
    ) =>
      prisma.site.create({
        data: { ...data, company: { connect: { id: companyId } } },
      }),
    update: (companyId: string, siteId: string, data: Prisma.SiteUpdateInput) =>
      prisma.site.updateMany({
        where: { id: siteId, company_id: companyId },
        data,
      }),
    delete: (companyId: string, siteId: string) =>
      prisma.site.deleteMany({
        where: { id: siteId, company_id: companyId },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.SiteCountArgs, "where"> & {
        where?: Prisma.SiteWhereInput;
      },
    ) =>
      prisma.site.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Induction Templates
  inductionTemplates: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.InductionTemplateFindManyArgs, "where"> & {
        where?: Prisma.InductionTemplateWhereInput;
      },
    ) =>
      prisma.inductionTemplate.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.InductionTemplateFindFirstArgs, "where"> & {
        where?: Prisma.InductionTemplateWhereInput;
      },
    ) =>
      prisma.inductionTemplate.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, templateId: string) =>
      prisma.inductionTemplate.findFirst({
        where: { id: templateId, company_id: companyId },
        include: { questions: { orderBy: { display_order: "asc" } } },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.InductionTemplateCountArgs, "where"> & {
        where?: Prisma.InductionTemplateWhereInput;
      },
    ) =>
      prisma.inductionTemplate.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Sign-in Records
  signInRecords: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.SignInRecordFindManyArgs, "where"> & {
        where?: Prisma.SignInRecordWhereInput;
      },
    ) =>
      prisma.signInRecord.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.SignInRecordFindFirstArgs, "where"> & {
        where?: Prisma.SignInRecordWhereInput;
      },
    ) =>
      prisma.signInRecord.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, recordId: string) =>
      prisma.signInRecord.findFirst({
        where: { id: recordId, company_id: companyId },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.SignInRecordCountArgs, "where"> & {
        where?: Prisma.SignInRecordWhereInput;
      },
    ) =>
      prisma.signInRecord.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Contractors
  contractors: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.ContractorFindManyArgs, "where"> & {
        where?: Prisma.ContractorWhereInput;
      },
    ) =>
      prisma.contractor.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.ContractorFindFirstArgs, "where"> & {
        where?: Prisma.ContractorWhereInput;
      },
    ) =>
      prisma.contractor.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, contractorId: string) =>
      prisma.contractor.findFirst({
        where: { id: contractorId, company_id: companyId },
        include: { documents: true },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.ContractorCountArgs, "where"> & {
        where?: Prisma.ContractorWhereInput;
      },
    ) =>
      prisma.contractor.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Export Jobs
  exportJobs: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.ExportJobFindManyArgs, "where"> & {
        where?: Prisma.ExportJobWhereInput;
      },
    ) =>
      prisma.exportJob.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findFirst: (
      companyId: string,
      args?: Omit<Prisma.ExportJobFindFirstArgs, "where"> & {
        where?: Prisma.ExportJobWhereInput;
      },
    ) =>
      prisma.exportJob.findFirst({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    findUnique: (companyId: string, jobId: string) =>
      prisma.exportJob.findFirst({
        where: { id: jobId, company_id: companyId },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.ExportJobCountArgs, "where"> & {
        where?: Prisma.ExportJobWhereInput;
      },
    ) =>
      prisma.exportJob.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },

  // Audit Logs (read-only for queries)
  auditLogs: {
    findMany: (
      companyId: string,
      args?: Omit<Prisma.AuditLogFindManyArgs, "where"> & {
        where?: Prisma.AuditLogWhereInput;
      },
    ) =>
      prisma.auditLog.findMany({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
    count: (
      companyId: string,
      args?: Omit<Prisma.AuditLogCountArgs, "where"> & {
        where?: Prisma.AuditLogWhereInput;
      },
    ) =>
      prisma.auditLog.count({
        ...args,
        where: { ...args?.where, company_id: companyId },
      }),
  },
};

/**
 * Create an audit log entry (append-only)
 */
export async function createAuditLog(
  companyId: string,
  data: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
  },
) {
  return prisma.auditLog.create({
    data: {
      company_id: companyId,
      user_id: data.userId,
      action: data.action,
      entity_type: data.entityType,
      entity_id: data.entityId,
      details: data.details as object | undefined,
      ip_address: data.ipAddress,
      user_agent: data.userAgent,
      request_id: data.requestId,
    },
  });
}
