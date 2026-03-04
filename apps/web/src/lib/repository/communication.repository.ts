import { createHash } from "crypto";
import { scopedDb } from "@/lib/db/scoped-db";
import type {
  BroadcastChannel,
  BroadcastRecipient,
  BroadcastRecipientStatus,
  ChannelDelivery,
  ChannelDeliveryStatus,
  ChannelIntegrationConfig,
  ChannelProvider,
  CommunicationEvent,
  CommunicationDirection,
  EmergencyBroadcast,
  BroadcastSeverity,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreateEmergencyBroadcastInput {
  site_id?: string;
  severity: BroadcastSeverity;
  message: string;
  initiated_by?: string;
  channels: BroadcastChannel[];
  acknowledgement_required?: boolean;
  expires_at?: Date;
  scope?: Record<string, unknown>;
}

export interface CreateBroadcastRecipientInput {
  broadcast_id: string;
  channel: BroadcastChannel;
  recipient_name?: string;
  recipient_email?: string;
  recipient_phone?: string;
  recipient_user_id?: string;
  token_seed?: string;
}

export interface UpdateBroadcastRecipientStatusInput {
  recipient_id: string;
  status: BroadcastRecipientStatus;
  error_message?: string;
  increment_retry?: boolean;
  acknowledged_at?: Date;
}

export interface UpsertChannelIntegrationConfigInput {
  id?: string;
  site_id?: string;
  provider: ChannelProvider;
  endpoint_url: string;
  signing_secret?: string;
  auth_token?: string;
  mappings?: Record<string, unknown>;
  is_active?: boolean;
}

export interface CreateChannelDeliveryInput {
  integration_config_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  idempotency_key?: string;
}

function hashRecipientToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createEmergencyBroadcast(
  companyId: string,
  input: CreateEmergencyBroadcastInput,
): Promise<EmergencyBroadcast> {
  requireCompanyId(companyId);
  if (!input.message.trim()) {
    throw new RepositoryError("message is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.emergencyBroadcast.create({
      data: {
        site_id: input.site_id ?? null,
        severity: input.severity,
        message: input.message.trim(),
        acknowledgement_required: input.acknowledgement_required !== false,
        initiated_by: input.initiated_by ?? null,
        channels: input.channels as unknown as object,
        expires_at: input.expires_at ?? null,
        scope: input.scope ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "EmergencyBroadcast");
  }
}

export async function listEmergencyBroadcasts(
  companyId: string,
  siteId?: string,
): Promise<EmergencyBroadcast[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.emergencyBroadcast.findMany({
      where: {
        ...(siteId ? { site_id: siteId } : {}),
      },
      orderBy: [{ started_at: "desc" }],
      take: 100,
    });
  } catch (error) {
    handlePrismaError(error, "EmergencyBroadcast");
  }
}

export async function createBroadcastRecipient(
  companyId: string,
  input: CreateBroadcastRecipientInput,
): Promise<BroadcastRecipient> {
  requireCompanyId(companyId);
  if (!input.broadcast_id.trim()) {
    throw new RepositoryError("broadcast_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const ackTokenHash = input.token_seed
      ? hashRecipientToken(
          `${companyId}:${input.broadcast_id}:${input.channel}:${input.token_seed}`,
        )
      : null;

    return await db.broadcastRecipient.create({
      data: {
        broadcast_id: input.broadcast_id,
        channel: input.channel,
        recipient_name: input.recipient_name?.trim() || null,
        recipient_email: input.recipient_email?.trim().toLowerCase() || null,
        recipient_phone: input.recipient_phone?.trim() || null,
        recipient_user_id: input.recipient_user_id ?? null,
        ack_token_hash: ackTokenHash,
      },
    });
  } catch (error) {
    handlePrismaError(error, "BroadcastRecipient");
  }
}

export async function listBroadcastRecipients(
  companyId: string,
  broadcastId: string,
): Promise<BroadcastRecipient[]> {
  requireCompanyId(companyId);
  if (!broadcastId.trim()) {
    throw new RepositoryError("broadcastId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.broadcastRecipient.findMany({
      where: { broadcast_id: broadcastId },
      orderBy: [{ created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "BroadcastRecipient");
  }
}

export async function findBroadcastRecipientByTokenHash(
  companyId: string,
  tokenHash: string,
): Promise<BroadcastRecipient | null> {
  requireCompanyId(companyId);
  if (!tokenHash.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.broadcastRecipient.findFirst({
      where: { ack_token_hash: tokenHash },
    });
  } catch (error) {
    handlePrismaError(error, "BroadcastRecipient");
  }
}

export async function updateBroadcastRecipientStatus(
  companyId: string,
  input: UpdateBroadcastRecipientStatusInput,
): Promise<BroadcastRecipient> {
  requireCompanyId(companyId);
  if (!input.recipient_id.trim()) {
    throw new RepositoryError("recipient_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const current = await db.broadcastRecipient.findFirst({
      where: { id: input.recipient_id },
    });
    if (!current) {
      throw new RepositoryError("Broadcast recipient not found", "NOT_FOUND");
    }

    await db.broadcastRecipient.updateMany({
      where: { id: input.recipient_id },
      data: {
        status: input.status,
        retries: input.increment_retry ? current.retries + 1 : current.retries,
        last_attempt_at: new Date(),
        acknowledged_at: input.acknowledged_at ?? current.acknowledged_at,
        error_message: input.error_message?.trim() || null,
      },
    });

    const updated = await db.broadcastRecipient.findFirst({
      where: { id: input.recipient_id },
    });
    if (!updated) {
      throw new RepositoryError("Broadcast recipient not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "BroadcastRecipient");
  }
}

export async function createCommunicationEvent(
  companyId: string,
  input: {
    site_id?: string;
    broadcast_id?: string;
    direction: CommunicationDirection;
    channel?: BroadcastChannel;
    event_type: string;
    payload?: Record<string, unknown>;
    status?: string;
  },
): Promise<CommunicationEvent> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    return await db.communicationEvent.create({
      data: {
        site_id: input.site_id ?? null,
        broadcast_id: input.broadcast_id ?? null,
        direction: input.direction,
        channel: input.channel ?? null,
        event_type: input.event_type,
        payload: input.payload ?? null,
        status: input.status ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "CommunicationEvent");
  }
}

export async function listCommunicationEvents(
  companyId: string,
  options?: {
    site_id?: string;
    broadcast_id?: string;
    event_type?: string;
    status?: string;
    limit?: number;
  },
): Promise<CommunicationEvent[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));

  try {
    const db = scopedDb(companyId);
    return await db.communicationEvent.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        ...(options?.broadcast_id ? { broadcast_id: options.broadcast_id } : {}),
        ...(options?.event_type ? { event_type: options.event_type } : {}),
        ...(options?.status ? { status: options.status } : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "CommunicationEvent");
  }
}

export async function findCommunicationEventByStatus(
  companyId: string,
  input: { event_type: string; status: string },
): Promise<CommunicationEvent | null> {
  requireCompanyId(companyId);
  if (!input.event_type.trim() || !input.status.trim()) {
    return null;
  }

  try {
    const db = scopedDb(companyId);
    return await db.communicationEvent.findFirst({
      where: {
        event_type: input.event_type.trim(),
        status: input.status.trim(),
      },
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "CommunicationEvent");
  }
}

export async function upsertChannelIntegrationConfig(
  companyId: string,
  input: UpsertChannelIntegrationConfigInput,
): Promise<ChannelIntegrationConfig> {
  requireCompanyId(companyId);
  if (!input.endpoint_url.trim()) {
    throw new RepositoryError("endpoint_url is required", "VALIDATION");
  }

  const endpointUrl = input.endpoint_url.trim();
  let parsed: URL;
  try {
    parsed = new URL(endpointUrl);
  } catch {
    throw new RepositoryError("endpoint_url has invalid format", "VALIDATION");
  }
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new RepositoryError("endpoint_url must be http(s)", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    if (!input.id) {
      return await db.channelIntegrationConfig.create({
        data: {
          site_id: input.site_id ?? null,
          provider: input.provider,
          endpoint_url: endpointUrl,
          signing_secret: input.signing_secret?.trim() || null,
          auth_token: input.auth_token?.trim() || null,
          mappings: input.mappings ?? null,
          is_active: input.is_active !== false,
        },
      });
    }

    const updatedCount = await db.channelIntegrationConfig.updateMany({
      where: { id: input.id },
      data: {
        site_id: input.site_id ?? null,
        provider: input.provider,
        endpoint_url: endpointUrl,
        signing_secret: input.signing_secret?.trim() || null,
        auth_token: input.auth_token?.trim() || null,
        mappings: input.mappings ?? null,
        is_active: input.is_active !== false,
      },
    });

    if (updatedCount.count === 0) {
      throw new RepositoryError("Channel integration not found", "NOT_FOUND");
    }

    const updated = await db.channelIntegrationConfig.findFirst({
      where: { id: input.id },
    });
    if (!updated) {
      throw new RepositoryError("Channel integration not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ChannelIntegrationConfig");
  }
}

export async function listChannelIntegrationConfigs(
  companyId: string,
  siteId?: string,
): Promise<ChannelIntegrationConfig[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.channelIntegrationConfig.findMany({
      where: {
        ...(siteId ? { site_id: siteId } : {}),
      },
      orderBy: [{ is_active: "desc" }, { updated_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "ChannelIntegrationConfig");
  }
}

export async function findChannelIntegrationConfigById(
  companyId: string,
  id: string,
): Promise<ChannelIntegrationConfig | null> {
  requireCompanyId(companyId);
  if (!id.trim()) return null;
  try {
    const db = scopedDb(companyId);
    return await db.channelIntegrationConfig.findFirst({
      where: { id },
    });
  } catch (error) {
    handlePrismaError(error, "ChannelIntegrationConfig");
  }
}

export async function createChannelDelivery(
  companyId: string,
  input: CreateChannelDeliveryInput,
): Promise<ChannelDelivery> {
  requireCompanyId(companyId);
  if (!input.integration_config_id.trim()) {
    throw new RepositoryError("integration_config_id is required", "VALIDATION");
  }
  if (!input.event_type.trim()) {
    throw new RepositoryError("event_type is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.channelDelivery.create({
      data: {
        integration_config_id: input.integration_config_id,
        event_type: input.event_type.trim(),
        payload: input.payload,
        status: "PENDING",
        idempotency_key: input.idempotency_key ?? null,
        next_attempt_at: new Date(),
      },
    });
  } catch (error) {
    handlePrismaError(error, "ChannelDelivery");
  }
}

export async function listChannelDeliveries(
  companyId: string,
  options?: {
    status?: ChannelDeliveryStatus;
    integration_config_id?: string;
    limit?: number;
  },
): Promise<ChannelDelivery[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 100, 500));

  try {
    const db = scopedDb(companyId);
    return await db.channelDelivery.findMany({
      where: {
        ...(options?.status ? { status: options.status } : {}),
        ...(options?.integration_config_id
          ? { integration_config_id: options.integration_config_id }
          : {}),
      },
      orderBy: [{ created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "ChannelDelivery");
  }
}

export async function markChannelDeliveryStatus(
  companyId: string,
  input: {
    delivery_id: string;
    status: ChannelDeliveryStatus;
    response_status_code?: number;
    response_body?: string;
    increment_retry?: boolean;
    next_attempt_at?: Date;
  },
): Promise<ChannelDelivery> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const current = await db.channelDelivery.findFirst({
      where: { id: input.delivery_id },
    });
    if (!current) {
      throw new RepositoryError("Channel delivery not found", "NOT_FOUND");
    }

    await db.channelDelivery.updateMany({
      where: { id: input.delivery_id },
      data: {
        status: input.status,
        response_status_code: input.response_status_code ?? null,
        response_body: input.response_body ?? null,
        retries: input.increment_retry ? current.retries + 1 : current.retries,
        next_attempt_at: input.next_attempt_at ?? current.next_attempt_at,
      },
    });

    const updated = await db.channelDelivery.findFirst({
      where: { id: input.delivery_id },
    });
    if (!updated) {
      throw new RepositoryError("Channel delivery not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ChannelDelivery");
  }
}

export function buildBroadcastAckToken(
  input: {
    companyId: string;
    broadcastId: string;
    channel: BroadcastChannel;
    recipientSeed: string;
  },
): string {
  return hashRecipientToken(
    `${input.companyId}:${input.broadcastId}:${input.channel}:${input.recipientSeed}`,
  );
}
