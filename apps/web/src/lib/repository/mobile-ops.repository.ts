import { scopedDb } from "@/lib/db/scoped-db";
import type {
  DeviceSubscription,
  MobileRuntimeEventStatus,
  MobileRuntimeEventType,
  PresenceHint,
  PresenceHintStatus,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface UpsertDeviceSubscriptionInput {
  endpoint: string;
  public_key: string;
  auth_key: string;
  platform?: string;
  site_id?: string;
  user_id?: string;
}

export interface CreatePresenceHintInput {
  site_id: string;
  sign_in_record_id: string;
  hint_type: string;
  hint_payload?: Record<string, unknown>;
}

export interface CreateMobileDeviceRuntimeEventInput {
  site_id?: string | null;
  device_subscription_id?: string | null;
  event_type: MobileRuntimeEventType;
  event_status?: MobileRuntimeEventStatus;
  correlation_id?: string | null;
  runtime_tag?: string | null;
  reason?: string | null;
  payload?: Record<string, unknown> | null;
}

interface MobileOpsRuntimeDbDelegate {
  deviceSubscription: {
    findFirst: (args: Record<string, unknown>) => Promise<DeviceSubscription | null>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  mobileDeviceRuntimeEvent: {
    create: (args: Record<string, unknown>) => Promise<unknown>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
}

function getMobileOpsRuntimeDb(companyId: string): MobileOpsRuntimeDbDelegate {
  return scopedDb(companyId) as unknown as MobileOpsRuntimeDbDelegate;
}

export async function upsertDeviceSubscription(
  companyId: string,
  input: UpsertDeviceSubscriptionInput,
): Promise<DeviceSubscription> {
  requireCompanyId(companyId);
  const endpoint = input.endpoint.trim();
  if (!endpoint) {
    throw new RepositoryError("endpoint is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const existing = await db.deviceSubscription.findFirst({
      where: { endpoint },
    });

    if (!existing) {
      return await db.deviceSubscription.create({
        data: {
          endpoint,
          public_key: input.public_key.trim(),
          auth_key: input.auth_key.trim(),
          platform: input.platform?.trim() || null,
          site_id: input.site_id ?? null,
          user_id: input.user_id ?? null,
          is_active: true,
          last_seen_at: new Date(),
        },
      });
    }

    await db.deviceSubscription.updateMany({
      where: { id: existing.id },
      data: {
        public_key: input.public_key.trim(),
        auth_key: input.auth_key.trim(),
        platform: input.platform?.trim() || null,
        site_id: input.site_id ?? existing.site_id,
        user_id: input.user_id ?? existing.user_id,
        is_active: true,
        last_seen_at: new Date(),
      },
    });

    const updated = await db.deviceSubscription.findFirst({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new RepositoryError("Device subscription not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function deactivateDeviceSubscription(
  companyId: string,
  endpoint: string,
): Promise<void> {
  requireCompanyId(companyId);
  const normalized = endpoint.trim();
  if (!normalized) return;

  try {
    const db = scopedDb(companyId);
    await db.deviceSubscription.updateMany({
      where: { endpoint: normalized },
      data: { is_active: false },
    });
  } catch (error) {
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function listActiveDeviceSubscriptions(
  companyId: string,
  options?: { site_id?: string; user_id?: string; limit?: number },
): Promise<DeviceSubscription[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 500, 5000));

  try {
    const db = scopedDb(companyId);
    return await db.deviceSubscription.findMany({
      where: {
        is_active: true,
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        ...(options?.user_id ? { user_id: options.user_id } : {}),
      },
      orderBy: [{ last_seen_at: "desc" }, { created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function findActiveDeviceSubscriptionByEndpoint(
  companyId: string,
  endpoint: string,
): Promise<DeviceSubscription | null> {
  requireCompanyId(companyId);
  const normalized = endpoint.trim();
  if (!normalized) {
    throw new RepositoryError("endpoint is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.deviceSubscription.findFirst({
      where: {
        endpoint: normalized,
        is_active: true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function touchDeviceSubscriptionHeartbeat(
  companyId: string,
  endpoint: string,
  input?: {
    platform?: string;
    active?: boolean;
  },
): Promise<DeviceSubscription | null> {
  requireCompanyId(companyId);
  const normalized = endpoint.trim();
  if (!normalized) {
    throw new RepositoryError("endpoint is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    await db.deviceSubscription.updateMany({
      where: { endpoint: normalized },
      data: {
        last_seen_at: new Date(),
        ...(input?.platform ? { platform: input.platform.trim() } : {}),
        ...(input?.active !== undefined ? { is_active: input.active } : {}),
      },
    });

    return await db.deviceSubscription.findFirst({
      where: {
        endpoint: normalized,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function rotateDeviceSubscriptionTokenVersion(
  companyId: string,
  endpoint: string,
): Promise<DeviceSubscription | null> {
  requireCompanyId(companyId);
  const normalized = endpoint.trim();
  if (!normalized) {
    throw new RepositoryError("endpoint is required", "VALIDATION");
  }

  const db = getMobileOpsRuntimeDb(companyId);
  try {
    const existing = await db.deviceSubscription.findFirst({
      where: { endpoint: normalized },
    });
    if (!existing) return null;

    await db.deviceSubscription.updateMany({
      where: { id: existing.id },
      data: {
        token_version: { increment: 1 },
        is_active: true,
        last_seen_at: new Date(),
      },
    });

    return await db.deviceSubscription.findFirst({
      where: { id: existing.id },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "DeviceSubscription");
  }
}

export async function createMobileDeviceRuntimeEvent(
  companyId: string,
  input: CreateMobileDeviceRuntimeEventInput,
): Promise<void> {
  requireCompanyId(companyId);

  const db = getMobileOpsRuntimeDb(companyId);
  try {
    await db.mobileDeviceRuntimeEvent.create({
      data: {
        site_id: input.site_id ?? null,
        device_subscription_id: input.device_subscription_id ?? null,
        event_type: input.event_type,
        event_status: input.event_status ?? "ACCEPTED",
        correlation_id: input.correlation_id?.trim() || null,
        runtime_tag: input.runtime_tag?.trim() || null,
        reason: input.reason?.trim() || null,
        payload: input.payload ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "MobileDeviceRuntimeEvent");
  }
}

export async function countMobileDeviceRuntimeEventsSince(
  companyId: string,
  input: {
    since: Date;
    event_type?: MobileRuntimeEventType;
    site_id?: string;
  },
): Promise<number> {
  requireCompanyId(companyId);

  const db = getMobileOpsRuntimeDb(companyId);
  try {
    return await db.mobileDeviceRuntimeEvent.count({
      where: {
        created_at: { gte: input.since },
        ...(input.event_type ? { event_type: input.event_type } : {}),
        ...(input.site_id ? { site_id: input.site_id } : {}),
      },
    });
  } catch (error) {
    handlePrismaError(error, "MobileDeviceRuntimeEvent");
  }
}

export async function createPresenceHint(
  companyId: string,
  input: CreatePresenceHintInput,
): Promise<PresenceHint> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.sign_in_record_id.trim()) {
    throw new RepositoryError("sign_in_record_id is required", "VALIDATION");
  }
  if (!input.hint_type.trim()) {
    throw new RepositoryError("hint_type is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.presenceHint.create({
      data: {
        site_id: input.site_id,
        sign_in_record_id: input.sign_in_record_id,
        hint_type: input.hint_type.trim(),
        hint_payload: input.hint_payload ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PresenceHint");
  }
}

export async function listPresenceHints(
  companyId: string,
  options?: {
    site_id?: string;
    status?: PresenceHintStatus;
    sign_in_record_id?: string;
    limit?: number;
  },
): Promise<PresenceHint[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));

  try {
    const db = scopedDb(companyId);
    return await db.presenceHint.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        ...(options?.status ? { status: options.status } : {}),
        ...(options?.sign_in_record_id
          ? { sign_in_record_id: options.sign_in_record_id }
          : {}),
      },
      orderBy: [{ suggested_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "PresenceHint");
  }
}

export async function resolvePresenceHint(
  companyId: string,
  hintId: string,
  status: PresenceHintStatus,
  resolutionNotes?: string,
): Promise<PresenceHint> {
  requireCompanyId(companyId);
  if (!hintId.trim()) {
    throw new RepositoryError("hintId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const result = await db.presenceHint.updateMany({
      where: { id: hintId },
      data: {
        status,
        resolved_at: new Date(),
        resolution_notes: resolutionNotes?.trim() || null,
      },
    });
    if (result.count === 0) {
      throw new RepositoryError("Presence hint not found", "NOT_FOUND");
    }

    const updated = await db.presenceHint.findFirst({ where: { id: hintId } });
    if (!updated) {
      throw new RepositoryError("Presence hint not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PresenceHint");
  }
}
