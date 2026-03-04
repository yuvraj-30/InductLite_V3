import { isFeatureEnabled } from "@/lib/feature-flags";
import { createRequestLogger } from "@/lib/logger";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { publicDb } from "@/lib/db/public-db";
import {
  applyDuePlanChanges,
} from "@/lib/repository/plan-change.repository";
import {
  countRiskScoreHistorySince,
  refreshAllContractorRiskScores,
} from "@/lib/repository/risk-passport.repository";
import {
  listContractorPrequalificationsExpiringSoon,
  listPermitRequestsExpiringSoon,
} from "@/lib/repository/permit.repository";
import { listSiteManagerNotificationRecipients } from "@/lib/repository/site.repository";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  createCommunicationEvent,
  findCommunicationEventByStatus,
} from "@/lib/repository/communication.repository";
import { createSystemAuditLog } from "@/lib/repository/audit.repository";

interface CompanyJobResult {
  companyId: string;
  permitRemindersQueued: number;
  prequalificationRemindersQueued: number;
  riskScoresRefreshed: number;
  planChangesApplied: number;
  planChangesFailed: number;
}

export interface MarketOpsSummary {
  companiesProcessed: number;
  permitRemindersQueued: number;
  prequalificationRemindersQueued: number;
  riskScoresRefreshed: number;
  planChangesApplied: number;
  planChangesFailed: number;
  companyResults: CompanyJobResult[];
}

function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function readMaxRiskRecalcPerDay(): number {
  const raw = Number(process.env.MAX_RISK_SCORE_RECALC_JOBS_PER_DAY ?? 300);
  if (!Number.isFinite(raw)) return 300;
  return Math.max(1, Math.trunc(raw));
}

function dedupeKey(prefix: string, id: string): string {
  const dayKey = new Date().toISOString().slice(0, 10);
  return `${prefix}:${id}:${dayKey}`;
}

async function isFeatureEntitled(
  companyId: string,
  feature: Parameters<typeof assertCompanyFeatureEnabled>[1],
): Promise<boolean> {
  try {
    await assertCompanyFeatureEnabled(companyId, feature);
    return true;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return false;
    }
    throw error;
  }
}

async function queuePermitReminders(companyId: string): Promise<{ permit: number; prequal: number }> {
  if (!isFeatureEnabled("PERMITS_V1")) {
    return { permit: 0, prequal: 0 };
  }

  const permitsEnabled = await isFeatureEntitled(companyId, "PERMITS_V1");
  if (!permitsEnabled) {
    return { permit: 0, prequal: 0 };
  }

  const expiringPermits = await listPermitRequestsExpiringSoon(companyId, {
    within_days: 14,
    limit: 200,
  });

  let permitQueued = 0;
  for (const permit of expiringPermits) {
    const dedupe = dedupeKey("permit", permit.id);
    const exists = await findCommunicationEventByStatus(companyId, {
      event_type: "permit.reminder.queued",
      status: dedupe,
    });
    if (exists) continue;

    const recipients = await listSiteManagerNotificationRecipients(companyId, permit.site_id);
    for (const recipient of recipients) {
      await queueEmailNotification(companyId, {
        to: recipient.email,
        subject: "Permit expiring soon",
        body:
          `Permit request ${permit.id} is approaching expiry on ` +
          `${permit.validity_end?.toLocaleString("en-NZ") ?? "an unknown date"}. ` +
          "Please review and renew if required.",
        user_id: recipient.userId,
      });
      permitQueued += 1;
    }

    await createCommunicationEvent(companyId, {
      site_id: permit.site_id,
      direction: "SYSTEM",
      event_type: "permit.reminder.queued",
      status: dedupe,
      payload: {
        permit_request_id: permit.id,
        recipients: recipients.length,
      },
    });
  }

  const prequalEnabled = await isFeatureEntitled(companyId, "PREQUALIFICATION_V1");
  if (!prequalEnabled) {
    return { permit: permitQueued, prequal: 0 };
  }

  const expiringPrequals = await listContractorPrequalificationsExpiringSoon(companyId, {
    within_days: 30,
    limit: 200,
  });

  let prequalQueued = 0;
  for (const prequal of expiringPrequals) {
    if (!prequal.site_id) continue;

    const dedupe = dedupeKey("prequal", prequal.id);
    const exists = await findCommunicationEventByStatus(companyId, {
      event_type: "prequalification.reminder.queued",
      status: dedupe,
    });
    if (exists) continue;

    const recipients = await listSiteManagerNotificationRecipients(companyId, prequal.site_id);
    for (const recipient of recipients) {
      await queueEmailNotification(companyId, {
        to: recipient.email,
        subject: "Contractor prequalification expiring soon",
        body:
          `Prequalification record ${prequal.id} is approaching expiry on ` +
          `${prequal.expires_at?.toLocaleString("en-NZ") ?? "an unknown date"}. ` +
          "Please review and renew supporting evidence.",
        user_id: recipient.userId,
      });
      prequalQueued += 1;
    }

    await createCommunicationEvent(companyId, {
      site_id: prequal.site_id,
      direction: "SYSTEM",
      event_type: "prequalification.reminder.queued",
      status: dedupe,
      payload: {
        prequalification_id: prequal.id,
        recipients: recipients.length,
      },
    });
  }

  return {
    permit: permitQueued,
    prequal: prequalQueued,
  };
}

async function runRiskRefresh(companyId: string): Promise<number> {
  if (!isFeatureEnabled("RISK_PASSPORT_V1")) {
    return 0;
  }

  const enabled = await isFeatureEntitled(companyId, "RISK_PASSPORT_V1");
  if (!enabled) {
    return 0;
  }

  const maxDaily = readMaxRiskRecalcPerDay();
  const usedToday = await countRiskScoreHistorySince(companyId, startOfUtcDay(new Date()));
  const remaining = Math.max(0, maxDaily - usedToday);
  if (remaining <= 0) {
    return 0;
  }

  const refreshed = await refreshAllContractorRiskScores(
    companyId,
    undefined,
    Math.min(remaining, 100),
  );
  return refreshed.length;
}

async function processCompanyJobs(companyId: string): Promise<CompanyJobResult> {
  const [reminders, riskRefreshed, planChanges] = await Promise.all([
    queuePermitReminders(companyId),
    runRiskRefresh(companyId),
    applyDuePlanChanges(companyId, { now: new Date(), acted_by: "system" }),
  ]);

  await createSystemAuditLog({
    company_id: companyId,
    action: "plan.change.apply.run",
    details: {
      applied: planChanges.applied,
      failed: planChanges.failed,
      request_ids: planChanges.request_ids,
      initiated_by: "system",
    },
  });

  return {
    companyId,
    permitRemindersQueued: reminders.permit,
    prequalificationRemindersQueued: reminders.prequal,
    riskScoresRefreshed: riskRefreshed,
    planChangesApplied: planChanges.applied,
    planChangesFailed: planChanges.failed,
  };
}

export async function runMarketOpsJobs(): Promise<MarketOpsSummary> {
  const log = createRequestLogger(`market-ops-${Date.now()}`);

  const companies = await publicDb.company.findMany({
    select: { id: true },
    orderBy: { created_at: "asc" },
    take: 250,
  });

  const companyResults: CompanyJobResult[] = [];
  for (const company of companies) {
    try {
      const result = await processCompanyJobs(company.id);
      companyResults.push(result);
    } catch (error) {
      log.warn(
        { company_id: company.id, error: String(error) },
        "Market ops processing failed for company",
      );
      companyResults.push({
        companyId: company.id,
        permitRemindersQueued: 0,
        prequalificationRemindersQueued: 0,
        riskScoresRefreshed: 0,
        planChangesApplied: 0,
        planChangesFailed: 1,
      });
    }
  }

  return {
    companiesProcessed: companies.length,
    permitRemindersQueued: companyResults.reduce(
      (sum, row) => sum + row.permitRemindersQueued,
      0,
    ),
    prequalificationRemindersQueued: companyResults.reduce(
      (sum, row) => sum + row.prequalificationRemindersQueued,
      0,
    ),
    riskScoresRefreshed: companyResults.reduce(
      (sum, row) => sum + row.riskScoresRefreshed,
      0,
    ),
    planChangesApplied: companyResults.reduce(
      (sum, row) => sum + row.planChangesApplied,
      0,
    ),
    planChangesFailed: companyResults.reduce(
      (sum, row) => sum + row.planChangesFailed,
      0,
    ),
    companyResults,
  };
}
