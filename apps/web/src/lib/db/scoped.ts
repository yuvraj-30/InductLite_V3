/**
 * Scoped Prisma queries for tenant isolation
 *
 * CRITICAL: All data access MUST go through these scoped functions
 * to ensure tenant isolation. Direct prisma access is only allowed for:
 * - Auth bootstrap (login/session lookup)
 * - Public slug resolution (slug -> site -> company_id)
 * - Public sign-in ownership probes that must distinguish missing vs cross-tenant IDs
 */

import { prisma } from "./prisma";
import type { Prisma, PrismaClient, User, WebhookDeliveryStatus } from "@prisma/client";

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

export async function findUnscopedUserByEmail(
  email: string,
): Promise<User | null>;
export async function findUnscopedUserByEmail<T extends Prisma.UserFindFirstArgs>(
  email: string,
  args: T,
): Promise<Prisma.UserGetPayload<T> | null>;
export async function findUnscopedUserByEmail(
  email: string,
  args?: Prisma.UserFindFirstArgs,
) {
  const { where, ...rest } = args ?? {};

  return prisma.user.findFirst({
    ...rest,
    where: {
      ...(where ?? {}),
      email: email.toLowerCase().trim(),
    },
  });
}

export async function findActiveSiteByPublicSlug(slug: string) {
  return prisma.sitePublicLink.findUnique({
    where: { slug },
    include: {
      site: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
}

export async function listPublicSitemapLinks(limit: number) {
  return prisma.sitePublicLink.findMany({
    where: { is_active: true },
    select: { slug: true, created_at: true },
    take: limit,
    orderBy: { created_at: "desc" },
  });
}

export async function findBroadcastForAcknowledgement(broadcastId: string) {
  return prisma.emergencyBroadcast.findFirst({
    where: { id: broadcastId },
    select: { id: true, company_id: true, site_id: true },
  });
}

export async function findActiveChannelIntegrationConfig(
  integrationConfigId: string,
) {
  return prisma.channelIntegrationConfig.findFirst({
    where: { id: integrationConfigId, is_active: true },
    select: {
      id: true,
      company_id: true,
      provider: true,
      signing_secret: true,
      site_id: true,
    },
  });
}

export async function countRunningExportJobsGlobal() {
  return prisma.exportJob.count({
    where: { status: "RUNNING" },
  });
}

type ScopedDbClient = Prisma.TransactionClient | PrismaClient;

export async function aggregateSucceededExportJobBytesSince(
  since: Date,
  client: ScopedDbClient = prisma,
) {
  return client.exportJob.aggregate({
    _sum: { file_size: true },
    where: {
      status: "SUCCEEDED",
      completed_at: { gte: since },
    },
  });
}

export async function findInductionTemplateOwnershipById(
  templateId: string,
  client: ScopedDbClient = prisma,
) {
  return client.inductionTemplate.findFirst({
    where: { id: templateId },
    select: {
      id: true,
      company_id: true,
      version: true,
      force_reinduction: true,
    },
  });
}

export async function findOldestQueuedExportJob(now: Date) {
  return prisma.exportJob.findFirst({
    where: {
      status: "QUEUED",
      run_at: { lte: now },
    },
    orderBy: { queued_at: "asc" },
  });
}

export async function requeueStaleRunningExportJobs(input: {
  staleBefore: Date;
  maxAttempts: number;
}) {
  return prisma.exportJob.updateMany({
    where: {
      status: "RUNNING",
      started_at: { lt: input.staleBefore },
      attempts: { lt: input.maxAttempts },
    },
    data: {
      status: "QUEUED",
      run_at: new Date(),
      locked_at: null,
      lock_token: null,
    },
  });
}

export async function listGlobalExportDownloadAuditLogsSince(since: Date) {
  return prisma.auditLog.findMany({
    where: {
      action: "export.download",
      created_at: { gte: since },
    },
    select: { details: true },
  });
}

export async function listDueOutboundWebhookDeliveriesGlobal(
  statuses: string[],
  now: Date,
  take: number,
) {
  return prisma.outboundWebhookDelivery.findMany({
    where: {
      status: { in: statuses as WebhookDeliveryStatus[] },
      next_attempt_at: { lte: now },
    },
    orderBy: [{ next_attempt_at: "asc" }, { created_at: "asc" }],
    take,
    select: {
      id: true,
      company_id: true,
      site_id: true,
      event_type: true,
      target_url: true,
      payload: true,
      status: true,
      attempts: true,
      max_attempts: true,
    },
  });
}

export async function claimOutboundWebhookDeliveryGlobal(
  id: string,
  statuses: string[],
) {
  return prisma.outboundWebhookDelivery.updateMany({
    where: {
      id,
      status: { in: statuses as WebhookDeliveryStatus[] },
    },
    data: {
      status: "PROCESSING",
      last_attempt_at: new Date(),
    },
  });
}

export async function markOutboundWebhookDeliverySentGlobal(input: {
  id: string;
  statusCode: number;
  responseBody?: string | null;
}) {
  return prisma.outboundWebhookDelivery.updateMany({
    where: {
      id: input.id,
      status: "PROCESSING",
    },
    data: {
      status: "SENT",
      attempts: { increment: 1 },
      sent_at: new Date(),
      last_status_code: input.statusCode,
      last_response_body: input.responseBody ?? null,
      last_error: null,
    },
  });
}

export async function markOutboundWebhookDeliveryFailureGlobal(input: {
  id: string;
  statusCode?: number | null;
  errorMessage?: string | null;
  responseBody?: string | null;
  nextAttemptAt: Date;
  dead: boolean;
}) {
  return prisma.outboundWebhookDelivery.updateMany({
    where: {
      id: input.id,
      status: "PROCESSING",
    },
    data: {
      status: input.dead ? "DEAD" : "RETRYING",
      attempts: { increment: 1 },
      next_attempt_at: input.nextAttemptAt,
      last_status_code: input.statusCode ?? null,
      last_error: input.errorMessage ?? null,
      last_response_body: input.responseBody ?? null,
    },
  });
}

export async function countGlobalIdentityOcrVerifications(since: Date) {
  return prisma.identityOcrVerification.count({
    where: {
      created_at: { gte: since },
    },
  });
}

export async function consumeMagicLinkTokenByHash(
  tokenHash: string,
  now: Date,
) {
  return prisma.magicLinkToken.updateMany({
    where: {
      token_hash: tokenHash,
      used_at: null,
      expires_at: { gt: now },
    },
    data: { used_at: now },
  });
}

export async function findMagicLinkTokenByHash(tokenHash: string) {
  return prisma.magicLinkToken.findFirst({
    where: { token_hash: tokenHash },
    include: {
      contractor: {
        select: { id: true, name: true, contact_email: true },
      },
      company: {
        select: { id: true, name: true, slug: true },
      },
    },
  });
}

export async function completePublicSignOutByToken(input: {
  signInRecordId: string;
  tokenHash: string;
  now: Date;
}) {
  return prisma.signInRecord.updateMany({
    where: {
      id: input.signInRecordId,
      sign_out_ts: null,
      sign_out_token: input.tokenHash,
      OR: [
        { sign_out_token_exp: null },
        { sign_out_token_exp: { gte: input.now } },
      ],
    },
    data: {
      sign_out_ts: input.now,
      signed_out_by: null,
      sign_out_token: null,
      sign_out_token_exp: null,
    },
  });
}

export async function findPublicSignOutRecordState(signInRecordId: string) {
  return prisma.signInRecord.findFirst({
    where: { id: signInRecordId },
    select: {
      id: true,
      visitor_phone: true,
      sign_out_ts: true,
      sign_out_token: true,
      sign_out_token_exp: true,
    },
  });
}

export async function findPublicSignOutRecordResult(signInRecordId: string) {
  return prisma.signInRecord.findFirst({
    where: { id: signInRecordId },
    select: {
      id: true,
      visitor_name: true,
      company_id: true,
      site_id: true,
      site: {
        select: { name: true },
      },
    },
  });
}

export async function findPublicSignInSummary(signInRecordId: string) {
  return prisma.signInRecord.findFirst({
    where: { id: signInRecordId },
    select: {
      id: true,
      visitor_name: true,
      sign_in_ts: true,
      sign_out_ts: true,
      site: {
        select: { name: true },
      },
      company: {
        select: { name: true },
      },
    },
  });
}

export async function listPendingRedFlagResponsesForEmailWorker(input: {
  createdAfter: Date;
  take: number;
  cursorId?: string;
}) {
  return prisma.inductionResponse.findMany({
    where: {
      passed: true,
      sign_in_record: {
        created_at: { gte: input.createdAfter },
      },
    },
    select: {
      id: true,
      answers: true,
      sign_in_record: {
        select: {
          company_id: true,
          site_id: true,
          visitor_name: true,
          site: {
            select: {
              name: true,
              site_managers: {
                select: {
                  user: {
                    select: { email: true },
                  },
                },
              },
            },
          },
        },
      },
      template: {
        select: {
          questions: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: input.take,
    ...(input.cursorId ? { skip: 1, cursor: { id: input.cursorId } } : {}),
  });
}

export async function listAuditLogEntityIdsByAction(input: {
  action: string;
  entityIds: string[];
}) {
  if (input.entityIds.length === 0) {
    return [];
  }

  return prisma.auditLog.findMany({
    where: {
      action: input.action,
      entity_id: { in: input.entityIds },
    },
    select: { entity_id: true },
  });
}

export async function getWeeklyDigestMetricsByCompany(input: {
  companyIds: string[];
  lastWeek: Date;
  now: Date;
  thirtyDaysFromNow: Date;
}) {
  const [inductionCounts, redFlagCounts, expiringDocuments] = await Promise.all([
    prisma.signInRecord.groupBy({
      by: ["company_id"],
      where: {
        company_id: { in: input.companyIds },
        sign_in_ts: { gte: input.lastWeek },
      },
      _count: { id: true },
    }),
    prisma.auditLog.groupBy({
      by: ["company_id"],
      where: {
        company_id: { in: input.companyIds },
        action: "email.red_flag_alert",
        created_at: { gte: input.lastWeek },
      },
      _count: { id: true },
    }),
    prisma.contractorDocument.findMany({
      where: {
        contractor: { company_id: { in: input.companyIds } },
        expires_at: {
          gt: input.now,
          lt: input.thirtyDaysFromNow,
        },
      },
      select: {
        contractor: {
          select: { company_id: true },
        },
      },
    }),
  ]);

  return {
    inductionCounts,
    redFlagCounts,
    expiringDocuments,
  };
}
