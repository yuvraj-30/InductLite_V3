import { scopedDb } from "@/lib/db/scoped-db";
import {
  claimOutboundWebhookDeliveryGlobal,
  listDueOutboundWebhookDeliveriesGlobal,
  markOutboundWebhookDeliveryFailureGlobal,
  markOutboundWebhookDeliverySentGlobal,
} from "@/lib/db/scoped";
import type { Prisma, WebhookDeliveryStatus } from "@prisma/client";
import { handlePrismaError, requireCompanyId } from "./base";

const PROCESSABLE_WEBHOOK_STATUSES: WebhookDeliveryStatus[] = [
  "PENDING",
  "RETRYING",
];

export interface QueueOutboundWebhookDeliveryInput {
  siteId: string;
  eventType: string;
  targetUrl: string;
  payload: Prisma.InputJsonValue;
  maxAttempts?: number;
}

export interface OutboundWebhookDeliveryWorkItem {
  id: string;
  company_id: string;
  site_id: string;
  event_type: string;
  target_url: string;
  payload: Prisma.JsonValue;
  status: WebhookDeliveryStatus;
  attempts: number;
  max_attempts: number;
}

export interface OutboundWebhookDeliveryListItem {
  id: string;
  site_id: string;
  event_type: string;
  target_url: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  max_attempts: number;
  next_attempt_at: Date;
  last_attempt_at: Date | null;
  last_status_code: number | null;
  last_error: string | null;
  sent_at: Date | null;
  created_at: Date;
  site: {
    id: string;
    name: string;
  };
}

export async function listOutboundWebhookDeliveries(
  companyId: string,
  filter?: {
    siteId?: string;
    status?: WebhookDeliveryStatus;
    limit?: number;
  },
): Promise<OutboundWebhookDeliveryListItem[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const take = Math.max(1, Math.min(filter?.limit ?? 100, 500));

    return await db.outboundWebhookDelivery.findMany({
      where: {
        company_id: companyId,
        site_id: filter?.siteId,
        status: filter?.status,
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ created_at: "desc" }],
      take,
    });
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function countOutboundWebhookDeliveriesByStatus(
  companyId: string,
  input?: {
    since?: Date;
  },
): Promise<Record<WebhookDeliveryStatus, number>> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const grouped = await db.outboundWebhookDelivery.groupBy({
      by: ["status"],
      where: {
        company_id: companyId,
        created_at: input?.since ? { gte: input.since } : undefined,
      },
      _count: {
        _all: true,
      },
    });

    const counts: Record<WebhookDeliveryStatus, number> = {
      PENDING: 0,
      PROCESSING: 0,
      RETRYING: 0,
      SENT: 0,
      DEAD: 0,
    };

    for (const row of grouped as Array<{
      status: WebhookDeliveryStatus;
      _count: { _all: number };
    }>) {
      counts[row.status] = row._count._all;
    }

    return counts;
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function countOutboundWebhookDeliveriesSince(
  companyId: string,
  input: {
    since: Date;
    eventType?: string;
    siteId?: string;
  },
): Promise<number> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.outboundWebhookDelivery.count({
      where: {
        company_id: companyId,
        created_at: { gte: input.since },
        ...(input.eventType ? { event_type: input.eventType } : {}),
        ...(input.siteId ? { site_id: input.siteId } : {}),
      },
    });
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function queueOutboundWebhookDeliveries(
  companyId: string,
  input: QueueOutboundWebhookDeliveryInput[],
): Promise<number> {
  requireCompanyId(companyId);

  if (input.length === 0) {
    return 0;
  }

  try {
    const db = scopedDb(companyId);
    let created = 0;

    for (const delivery of input) {
      await db.outboundWebhookDelivery.create({
        data: {
          site_id: delivery.siteId,
          event_type: delivery.eventType,
          target_url: delivery.targetUrl,
          payload: delivery.payload,
          max_attempts: Math.max(1, Math.min(delivery.maxAttempts ?? 5, 10)),
          status: "PENDING",
          next_attempt_at: new Date(),
        },
      });
      created += 1;
    }

    return created;
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function listDueOutboundWebhookDeliveries(
  now: Date,
  take: number,
): Promise<OutboundWebhookDeliveryWorkItem[]> {
  try {
    return await listDueOutboundWebhookDeliveriesGlobal(
      PROCESSABLE_WEBHOOK_STATUSES,
      now,
      take,
    );
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function claimOutboundWebhookDelivery(id: string): Promise<boolean> {
  try {
    const result = await claimOutboundWebhookDeliveryGlobal(
      id,
      PROCESSABLE_WEBHOOK_STATUSES,
    );
    return result.count > 0;
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function markOutboundWebhookDeliverySent(input: {
  id: string;
  statusCode: number;
  responseBody?: string | null;
}): Promise<void> {
  try {
    await markOutboundWebhookDeliverySentGlobal(input);
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}

export async function markOutboundWebhookDeliveryRetriableFailure(input: {
  id: string;
  statusCode?: number | null;
  errorMessage?: string | null;
  responseBody?: string | null;
  nextAttemptAt: Date;
  dead: boolean;
}): Promise<void> {
  try {
    await markOutboundWebhookDeliveryFailureGlobal(input);
  } catch (error) {
    handlePrismaError(error, "OutboundWebhookDelivery");
  }
}
