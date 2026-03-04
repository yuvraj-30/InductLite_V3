"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { listCurrentlyOnSite } from "@/lib/repository/signin.repository";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import { sendSmsWithQuota } from "@/lib/sms/wrapper";
import {
  createBroadcastRecipient,
  createChannelDelivery,
  createCommunicationEvent,
  createEmergencyBroadcast,
  findChannelIntegrationConfigById,
  listChannelIntegrationConfigs,
  markChannelDeliveryStatus,
} from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import type { BroadcastChannel, BroadcastSeverity } from "@prisma/client";

export type CommunicationActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const createBroadcastSchema = z.object({
  siteId: z.string().cuid().optional().or(z.literal("")),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  message: z.string().min(3).max(1200),
  channels: z.array(z.enum(["EMAIL", "SMS", "WEB_PUSH", "TEAMS", "SLACK"])).min(1),
  expiresAt: z.string().optional().or(z.literal("")),
  requireAck: z.boolean().optional(),
});

const channelTestSchema = z.object({
  integrationConfigId: z.string().cuid(),
  message: z.string().min(2).max(600),
});

function parseOptionalDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseCsvChannels(value: string): BroadcastChannel[] {
  const normalized = value
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => entry.length > 0);
  const allowed = new Set<BroadcastChannel>([
    "EMAIL",
    "SMS",
    "WEB_PUSH",
    "TEAMS",
    "SLACK",
  ]);
  return normalized.filter((entry): entry is BroadcastChannel =>
    allowed.has(entry as BroadcastChannel),
  );
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function authorizeMutation(): Promise<
  | { success: true; companyId: string; userId: string; requestId: string }
  | { success: false; error: string }
> {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  return {
    success: true,
    companyId: context.companyId,
    userId: context.userId,
    requestId: generateRequestId(),
  };
}

async function ensureEmergencyFeatures(
  companyId: string,
): Promise<CommunicationActionResult | null> {
  try {
    await assertCompanyFeatureEnabled(companyId, "EMERGENCY_COMMS_V1");
    await assertCompanyFeatureEnabled(companyId, "COMMUNICATION_HUB_V1");
    return null;
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Emergency communication hub is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }
}

function getBroadcastLimits() {
  const maxBroadcastsPerDay = Number(
    process.env.MAX_BROADCASTS_PER_COMPANY_PER_DAY ?? 3,
  );
  const maxRecipientsPerEvent = Number(
    process.env.MAX_BROADCAST_RECIPIENTS_PER_EVENT ?? 500,
  );
  return {
    maxBroadcastsPerDay: Number.isFinite(maxBroadcastsPerDay)
      ? Math.max(1, Math.trunc(maxBroadcastsPerDay))
      : 3,
    maxRecipientsPerEvent: Number.isFinite(maxRecipientsPerEvent)
      ? Math.max(1, Math.trunc(maxRecipientsPerEvent))
      : 500,
  };
}

async function deliverChannelWebhook(input: {
  companyId: string;
  integrationConfigId: string;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const delivery = await createChannelDelivery(input.companyId, {
    integration_config_id: input.integrationConfigId,
    event_type: input.eventType,
    payload: input.payload,
    idempotency_key: randomUUID(),
  });

  const config = await findChannelIntegrationConfigById(
    input.companyId,
    input.integrationConfigId,
  );
  if (!config || !config.is_active) {
    await markChannelDeliveryStatus(input.companyId, {
      delivery_id: delivery.id,
      status: "FAILED",
      response_body: "Integration config is inactive or missing",
      increment_retry: true,
    });
    return;
  }

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-inductlite-event-type": input.eventType,
      "x-inductlite-delivery-id": delivery.id,
    };
    if (config.auth_token) {
      headers.authorization = `Bearer ${config.auth_token}`;
    }

    const response = await fetch(config.endpoint_url, {
      method: "POST",
      headers,
      body: JSON.stringify(input.payload),
    });

    const responseBody = await response.text();
    await markChannelDeliveryStatus(input.companyId, {
      delivery_id: delivery.id,
      status: response.ok ? "SENT" : "FAILED",
      response_status_code: response.status,
      response_body: responseBody.slice(0, 1500),
      increment_retry: !response.ok,
    });
  } catch (error) {
    await markChannelDeliveryStatus(input.companyId, {
      delivery_id: delivery.id,
      status: "FAILED",
      response_body:
        error instanceof Error ? error.message : "Unknown webhook error",
      increment_retry: true,
    });
  }
}

export async function createEmergencyBroadcastAction(
  _prevState: CommunicationActionResult | null,
  formData: FormData,
): Promise<CommunicationActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = createBroadcastSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    severity: (formData.get("severity")?.toString() ?? "WARNING") as BroadcastSeverity,
    message: formData.get("message")?.toString() ?? "",
    channels: parseCsvChannels(formData.get("channels")?.toString() ?? "EMAIL"),
    expiresAt: formData.get("expiresAt")?.toString() ?? "",
    requireAck: formData.get("requireAck") === "on",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureEmergencyFeatures(auth.companyId);
  if (featureError) return featureError;

  const log = createRequestLogger(auth.requestId, {
    path: "/admin/communications",
    method: "POST",
  });

  try {
    const { maxRecipientsPerEvent } = getBroadcastLimits();
    const activeRecords = await listCurrentlyOnSite(
      auth.companyId,
      parsed.data.siteId || undefined,
      maxRecipientsPerEvent,
    );

    if (activeRecords.length === 0) {
      return {
        success: false,
        error: "No active attendees found for the selected scope",
      };
    }

    const broadcast = await createEmergencyBroadcast(auth.companyId, {
      site_id: parsed.data.siteId || undefined,
      severity: parsed.data.severity,
      message: parsed.data.message,
      acknowledgement_required: parsed.data.requireAck !== false,
      initiated_by: auth.userId,
      channels: parsed.data.channels,
      expires_at: parseOptionalDate(parsed.data.expiresAt ?? ""),
      scope: {
        active_attendees_count: activeRecords.length,
        site_id: parsed.data.siteId || null,
      },
    });

    await createCommunicationEvent(auth.companyId, {
      site_id: parsed.data.siteId || undefined,
      broadcast_id: broadcast.id,
      direction: "SYSTEM",
      event_type: "broadcast.created",
      payload: {
        severity: broadcast.severity,
        channels: parsed.data.channels,
        recipients: activeRecords.length,
      },
      status: "created",
    });

    const appUrl = getAppUrl();
    const channelConfigs = await listChannelIntegrationConfigs(
      auth.companyId,
      parsed.data.siteId || undefined,
    );

    for (const attendee of activeRecords) {
      for (const channel of parsed.data.channels) {
        const tokenSeed = randomUUID();
        const recipient = await createBroadcastRecipient(auth.companyId, {
          broadcast_id: broadcast.id,
          channel,
          recipient_name: attendee.visitor_name,
          recipient_email: attendee.visitor_email || undefined,
          recipient_phone: attendee.visitor_phone || undefined,
          token_seed: tokenSeed,
        });

        const ackUrl = `${appUrl}/api/broadcasts/ack?broadcast=${encodeURIComponent(
          broadcast.id,
        )}&channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(tokenSeed)}`;

        if (channel === "EMAIL" && attendee.visitor_email) {
          await queueEmailNotification(auth.companyId, {
            to: attendee.visitor_email,
            subject: `Emergency alert: ${broadcast.severity}`,
            body: `${broadcast.message}\n\nAcknowledge: ${ackUrl}`,
          });
          await createCommunicationEvent(auth.companyId, {
            site_id: attendee.site_id,
            broadcast_id: broadcast.id,
            direction: "OUTBOUND",
            channel: "EMAIL",
            event_type: "broadcast.email.queued",
            payload: {
              recipient_id: recipient.id,
              to: attendee.visitor_email,
            },
            status: "queued",
          });
        } else if (channel === "SMS" && attendee.visitor_phone) {
          const smsResult = await sendSmsWithQuota({
            companyId: auth.companyId,
            siteId: attendee.site_id,
            toE164: attendee.visitor_phone,
            message: `${broadcast.message} Ack: ${ackUrl}`,
            requestId: auth.requestId,
            metadata: {
              broadcast_id: broadcast.id,
              recipient_id: recipient.id,
            },
          });
          await createCommunicationEvent(auth.companyId, {
            site_id: attendee.site_id,
            broadcast_id: broadcast.id,
            direction: "OUTBOUND",
            channel: "SMS",
            event_type: "broadcast.sms.result",
            payload: {
              recipient_id: recipient.id,
              to: attendee.visitor_phone,
              result: smsResult,
            },
            status: smsResult.status,
          });
        } else if (channel === "WEB_PUSH") {
          await createCommunicationEvent(auth.companyId, {
            site_id: attendee.site_id,
            broadcast_id: broadcast.id,
            direction: "OUTBOUND",
            channel: "WEB_PUSH",
            event_type: "broadcast.push.placeholder",
            payload: {
              recipient_id: recipient.id,
              visitor_name: attendee.visitor_name,
              ack_url: ackUrl,
            },
            status: "queued",
          });
        } else if (channel === "TEAMS" || channel === "SLACK") {
          const targets = channelConfigs.filter(
            (config) => config.provider === channel && config.is_active,
          );
          for (const target of targets) {
            await deliverChannelWebhook({
              companyId: auth.companyId,
              integrationConfigId: target.id,
              eventType: "emergency.broadcast",
              payload: {
                broadcast_id: broadcast.id,
                severity: broadcast.severity,
                message: broadcast.message,
                site_id: attendee.site_id,
                visitor_name: attendee.visitor_name,
                channel,
                ack_url: ackUrl,
              },
            });
          }
        }
      }
    }

    await createAuditLog(auth.companyId, {
      action: "emergency.broadcast.create",
      entity_type: "EmergencyBroadcast",
      entity_id: broadcast.id,
      user_id: auth.userId,
      details: {
        site_id: broadcast.site_id,
        severity: broadcast.severity,
        channels: parsed.data.channels,
        recipients: activeRecords.length,
      },
      request_id: auth.requestId,
    });

    revalidatePath("/admin/communications");
    revalidatePath("/admin/command-mode");
    return { success: true, message: "Emergency broadcast created" };
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create emergency broadcast");
    return { success: false, error: "Failed to create emergency broadcast" };
  }
}

export async function sendChannelTestMessageAction(
  _prevState: CommunicationActionResult | null,
  formData: FormData,
): Promise<CommunicationActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorizeMutation();
  if (!auth.success) return auth;

  const parsed = channelTestSchema.safeParse({
    integrationConfigId: formData.get("integrationConfigId")?.toString() ?? "",
    message: formData.get("message")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const featureError = await ensureEmergencyFeatures(auth.companyId);
  if (featureError) return featureError;

  await deliverChannelWebhook({
    companyId: auth.companyId,
    integrationConfigId: parsed.data.integrationConfigId,
    eventType: "integration.test",
    payload: {
      message: parsed.data.message,
      sent_at: new Date().toISOString(),
      actor_user_id: auth.userId,
    },
  });

  await createAuditLog(auth.companyId, {
    action: "channel.integration.test_send",
    entity_type: "ChannelIntegrationConfig",
    entity_id: parsed.data.integrationConfigId,
    user_id: auth.userId,
    details: {
      message_length: parsed.data.message.length,
    },
    request_id: auth.requestId,
  });

  revalidatePath("/admin/integrations/channels");
  revalidatePath("/admin/communications");
  return { success: true, message: "Channel test message sent" };
}
