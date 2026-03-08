import { scopedDb } from "@/lib/db/scoped-db";
import { encryptNullableString } from "@/lib/security/data-protection";
import type {
  AccessConnectorConfig,
  AccessConnectorHealthEvent,
  AccessConnectorHealthStatus,
  AccessConnectorProvider,
} from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface UpsertAccessConnectorConfigInput {
  site_id?: string | null;
  provider: AccessConnectorProvider;
  endpoint_url: string;
  auth_token?: string | null;
  settings?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface CreateAccessConnectorHealthEventInput {
  site_id?: string | null;
  connector_config_id?: string | null;
  provider: AccessConnectorProvider;
  status: AccessConnectorHealthStatus;
  reason: string;
  details?: Record<string, unknown> | null;
}

interface AccessConnectorDbDelegate {
  accessConnectorConfig: {
    create: (args: Record<string, unknown>) => Promise<AccessConnectorConfig>;
    findFirst: (args: Record<string, unknown>) => Promise<AccessConnectorConfig | null>;
    findMany: (args: Record<string, unknown>) => Promise<AccessConnectorConfig[]>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  accessConnectorHealthEvent: {
    create: (args: Record<string, unknown>) => Promise<AccessConnectorHealthEvent>;
    findMany: (args: Record<string, unknown>) => Promise<AccessConnectorHealthEvent[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  };
}

function getAccessConnectorDb(companyId: string): AccessConnectorDbDelegate {
  return scopedDb(companyId) as unknown as AccessConnectorDbDelegate;
}

function normalizeEndpointUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RepositoryError("endpoint_url is required", "VALIDATION");
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new RepositoryError("endpoint_url must use http/https", "VALIDATION");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    throw new RepositoryError("endpoint_url is invalid", "VALIDATION");
  }
}

export async function upsertAccessConnectorConfig(
  companyId: string,
  input: UpsertAccessConnectorConfigInput,
): Promise<AccessConnectorConfig> {
  requireCompanyId(companyId);
  const endpointUrl = normalizeEndpointUrl(input.endpoint_url);
  const db = getAccessConnectorDb(companyId);
  const normalizedSiteId = input.site_id?.trim() || null;

  try {
    const existing = await db.accessConnectorConfig.findFirst({
      where: {
        provider: input.provider,
        site_id: normalizedSiteId,
      },
    });

    const authTokenEncrypted =
      input.auth_token === undefined
        ? undefined
        : encryptNullableString(input.auth_token?.trim() || null);

    if (!existing) {
      return await db.accessConnectorConfig.create({
        data: {
          site_id: normalizedSiteId,
          provider: input.provider,
          endpoint_url: endpointUrl,
          auth_token_encrypted:
            authTokenEncrypted === undefined ? null : authTokenEncrypted,
          settings: input.settings ?? null,
          is_active: input.is_active !== false,
        },
      });
    }

    await db.accessConnectorConfig.updateMany({
      where: { id: existing.id },
      data: {
        endpoint_url: endpointUrl,
        ...(authTokenEncrypted !== undefined
          ? { auth_token_encrypted: authTokenEncrypted }
          : {}),
        ...(input.settings !== undefined ? { settings: input.settings } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });

    const updated = await db.accessConnectorConfig.findFirst({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new RepositoryError("Access connector config not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "AccessConnectorConfig");
  }
}

export async function findActiveAccessConnectorConfig(
  companyId: string,
  input: {
    provider: AccessConnectorProvider;
    site_id?: string | null;
  },
): Promise<AccessConnectorConfig | null> {
  requireCompanyId(companyId);
  const db = getAccessConnectorDb(companyId);
  const normalizedSiteId = input.site_id?.trim() || null;

  try {
    if (normalizedSiteId) {
      const siteScoped = await db.accessConnectorConfig.findFirst({
        where: {
          provider: input.provider,
          site_id: normalizedSiteId,
          is_active: true,
        },
      });
      if (siteScoped) return siteScoped;
    }

    return await db.accessConnectorConfig.findFirst({
      where: {
        provider: input.provider,
        site_id: null,
        is_active: true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "AccessConnectorConfig");
  }
}

export async function listAccessConnectorConfigs(
  companyId: string,
  input?: {
    site_id?: string;
    limit?: number;
  },
): Promise<AccessConnectorConfig[]> {
  requireCompanyId(companyId);
  const db = getAccessConnectorDb(companyId);
  const limit = Math.max(1, Math.min(input?.limit ?? 200, 1000));

  try {
    return await db.accessConnectorConfig.findMany({
      where: {
        ...(input?.site_id ? { site_id: input.site_id } : {}),
      },
      orderBy: [{ updated_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "AccessConnectorConfig");
  }
}

export async function createAccessConnectorHealthEvent(
  companyId: string,
  input: CreateAccessConnectorHealthEventInput,
): Promise<AccessConnectorHealthEvent> {
  requireCompanyId(companyId);
  if (!input.reason.trim()) {
    throw new RepositoryError("reason is required", "VALIDATION");
  }
  const db = getAccessConnectorDb(companyId);

  try {
    return await db.accessConnectorHealthEvent.create({
      data: {
        site_id: input.site_id?.trim() || null,
        connector_config_id: input.connector_config_id?.trim() || null,
        provider: input.provider,
        status: input.status,
        reason: input.reason.trim(),
        details: input.details ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "AccessConnectorHealthEvent");
  }
}

export async function listAccessConnectorHealthEvents(
  companyId: string,
  input?: {
    provider?: AccessConnectorProvider;
    site_id?: string;
    limit?: number;
  },
): Promise<AccessConnectorHealthEvent[]> {
  requireCompanyId(companyId);
  const db = getAccessConnectorDb(companyId);
  const limit = Math.max(1, Math.min(input?.limit ?? 200, 1000));

  try {
    return await db.accessConnectorHealthEvent.findMany({
      where: {
        ...(input?.provider ? { provider: input.provider } : {}),
        ...(input?.site_id ? { site_id: input.site_id } : {}),
      },
      orderBy: [{ occurred_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "AccessConnectorHealthEvent");
  }
}

export async function countAccessConnectorHealthFailuresSince(
  companyId: string,
  input: {
    since: Date;
    provider?: AccessConnectorProvider;
    site_id?: string;
  },
): Promise<number> {
  requireCompanyId(companyId);
  const db = getAccessConnectorDb(companyId);

  try {
    return await db.accessConnectorHealthEvent.count({
      where: {
        occurred_at: { gte: input.since },
        status: { in: ["DEGRADED", "OUTAGE"] },
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.site_id ? { site_id: input.site_id } : {}),
      },
    });
  } catch (error) {
    handlePrismaError(error, "AccessConnectorHealthEvent");
  }
}
