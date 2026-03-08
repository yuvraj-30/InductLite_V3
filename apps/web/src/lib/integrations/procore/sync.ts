import type { Prisma } from "@prisma/client";
import { parseProcoreConnectorConfig } from "./config";
import { findSiteById, updateSite } from "@/lib/repository/site.repository";
import { listSignInHistory } from "@/lib/repository/signin.repository";
import { listPermitRequests } from "@/lib/repository/permit.repository";
import {
  queueOutboundWebhookDeliveries,
  type QueueOutboundWebhookDeliveryInput,
} from "@/lib/repository/webhook-delivery.repository";
import { createCommunicationEvent } from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { RepositoryError } from "@/lib/repository/base";

interface QueueProcoreSyncInput {
  companyId: string;
  siteId: string;
  requestedBy: string;
}

export async function queueProcoreSiteSync(
  input: QueueProcoreSyncInput,
): Promise<{ queued: number; includedSignIns: number; includedPermits: number }> {
  const site = await findSiteById(input.companyId, input.siteId);
  if (!site) {
    throw new RepositoryError("Site not found", "NOT_FOUND");
  }

  const config = parseProcoreConnectorConfig(site.lms_connector);
  if (!config.enabled || !config.endpointUrl) {
    throw new RepositoryError("Procore connector is not enabled", "VALIDATION");
  }

  const deliveries: QueueOutboundWebhookDeliveryInput[] = [];
  let includedSignIns = 0;
  let includedPermits = 0;

  if (config.includeSignInEvents) {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const history = await listSignInHistory(
      input.companyId,
      {
        siteId: input.siteId,
        dateRange: { from },
      },
      { page: 1, pageSize: 100 },
    );
    includedSignIns = history.items.length;
    deliveries.push({
      siteId: input.siteId,
      eventType: "procore.signins.snapshot",
      targetUrl: config.endpointUrl,
      payload: {
        event: "procore.signins.snapshot",
        projectId: config.projectId,
        siteId: input.siteId,
        generatedAt: new Date().toISOString(),
        records: history.items.map((item) => ({
          signInId: item.id,
          visitorName: item.visitor_name,
          visitorPhone: item.visitor_phone,
          visitorEmail: item.visitor_email,
          employerName: item.employer_name,
          visitorType: item.visitor_type,
          signInTs: item.sign_in_ts.toISOString(),
          signOutTs: item.sign_out_ts?.toISOString() ?? null,
        })),
      } as Prisma.InputJsonValue,
    });
  }

  if (config.includePermitEvents) {
    const permitRequests = await listPermitRequests(input.companyId, {
      site_id: input.siteId,
    });
    includedPermits = permitRequests.length;
    deliveries.push({
      siteId: input.siteId,
      eventType: "procore.permits.snapshot",
      targetUrl: config.endpointUrl,
      payload: {
        event: "procore.permits.snapshot",
        projectId: config.projectId,
        siteId: input.siteId,
        generatedAt: new Date().toISOString(),
        records: permitRequests.map((permit) => ({
          permitId: permit.id,
          templateId: permit.permit_template_id,
          status: permit.status,
          visitorName: permit.visitor_name,
          visitorPhone: permit.visitor_phone,
          visitorEmail: permit.visitor_email,
          employerName: permit.employer_name,
          validityStart: permit.validity_start?.toISOString() ?? null,
          validityEnd: permit.validity_end?.toISOString() ?? null,
          approvedAt: permit.approved_at?.toISOString() ?? null,
          activeAt: permit.active_at?.toISOString() ?? null,
          closedAt: permit.closed_at?.toISOString() ?? null,
        })),
      } as Prisma.InputJsonValue,
    });
  }

  const queued = await queueOutboundWebhookDeliveries(input.companyId, deliveries);

  await updateSite(input.companyId, input.siteId, {
    lms_connector: {
      ...(site.lms_connector && typeof site.lms_connector === "object"
        ? (site.lms_connector as Record<string, unknown>)
        : {}),
      provider: "PROCORE",
      updatedAt: new Date().toISOString(),
    } as Prisma.InputJsonValue,
  });

  await createCommunicationEvent(input.companyId, {
    site_id: input.siteId,
    direction: "SYSTEM",
    event_type: "procore.sync.queued",
    status: queued > 0 ? "QUEUED" : "EMPTY",
    payload: {
      queued,
      include_signins: config.includeSignInEvents,
      include_permits: config.includePermitEvents,
      included_signins: includedSignIns,
      included_permits: includedPermits,
    },
  });

  await createAuditLog(input.companyId, {
    action: "procore.sync.queue",
    entity_type: "Site",
    entity_id: input.siteId,
    user_id: input.requestedBy,
    details: {
      queued,
      included_signins: includedSignIns,
      included_permits: includedPermits,
    },
  });

  return {
    queued,
    includedSignIns,
    includedPermits,
  };
}
