import { scopedDb } from "@/lib/db/scoped-db";
import type {
  AccessDecisionStatus,
  AccessDecisionTrace,
  HardwareOutageEvent,
  HardwareOutageSeverity,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreateAccessDecisionTraceInput {
  site_id: string;
  correlation_id: string;
  decision_status: AccessDecisionStatus;
  reason?: string;
  sign_in_record_id?: string;
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  decided_at?: Date;
  fallback_mode?: boolean;
}

export interface UpdateAccessDecisionTraceAckInput {
  correlation_id: string;
  acknowledged_at?: Date;
  response_payload?: Record<string, unknown>;
}

export interface CreateHardwareOutageEventInput {
  site_id?: string;
  provider?: string;
  severity: HardwareOutageSeverity;
  reason: string;
  details?: Record<string, unknown>;
}

export async function createAccessDecisionTrace(
  companyId: string,
  input: CreateAccessDecisionTraceInput,
): Promise<AccessDecisionTrace> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.correlation_id.trim()) {
    throw new RepositoryError("correlation_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.accessDecisionTrace.create({
      data: {
        site_id: input.site_id,
        correlation_id: input.correlation_id,
        decision_status: input.decision_status,
        reason: input.reason?.trim() || null,
        sign_in_record_id: input.sign_in_record_id ?? null,
        request_payload: input.request_payload ?? null,
        response_payload: input.response_payload ?? null,
        decided_at: input.decided_at ?? null,
        fallback_mode: input.fallback_mode === true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "AccessDecisionTrace");
  }
}

export async function updateAccessDecisionTraceAck(
  companyId: string,
  input: UpdateAccessDecisionTraceAckInput,
): Promise<AccessDecisionTrace | null> {
  requireCompanyId(companyId);
  if (!input.correlation_id.trim()) return null;

  try {
    const db = scopedDb(companyId);
    await db.accessDecisionTrace.updateMany({
      where: { correlation_id: input.correlation_id },
      data: {
        acknowledged_at: input.acknowledged_at ?? new Date(),
        ...(input.response_payload !== undefined
          ? { response_payload: input.response_payload as object }
          : {}),
      },
    });

    return await db.accessDecisionTrace.findFirst({
      where: { correlation_id: input.correlation_id },
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "AccessDecisionTrace");
  }
}

export async function listAccessDecisionTraces(
  companyId: string,
  options?: { site_id?: string; limit?: number },
): Promise<AccessDecisionTrace[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));

  try {
    const db = scopedDb(companyId);
    return await db.accessDecisionTrace.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
      },
      orderBy: [{ requested_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "AccessDecisionTrace");
  }
}

export async function findAccessDecisionTraceByCorrelationId(
  companyId: string,
  correlationId: string,
): Promise<AccessDecisionTrace | null> {
  requireCompanyId(companyId);
  if (!correlationId.trim()) {
    throw new RepositoryError("correlationId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.accessDecisionTrace.findFirst({
      where: { correlation_id: correlationId },
      orderBy: [{ created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "AccessDecisionTrace");
  }
}

export async function createHardwareOutageEvent(
  companyId: string,
  input: CreateHardwareOutageEventInput,
): Promise<HardwareOutageEvent> {
  requireCompanyId(companyId);
  if (!input.reason.trim()) {
    throw new RepositoryError("reason is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.hardwareOutageEvent.create({
      data: {
        site_id: input.site_id ?? null,
        provider: input.provider?.trim() || null,
        severity: input.severity,
        reason: input.reason.trim(),
        details: input.details ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "HardwareOutageEvent");
  }
}

export async function resolveHardwareOutageEvent(
  companyId: string,
  outageId: string,
): Promise<HardwareOutageEvent> {
  requireCompanyId(companyId);
  if (!outageId.trim()) {
    throw new RepositoryError("outageId is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    const updated = await db.hardwareOutageEvent.updateMany({
      where: { id: outageId },
      data: {
        resolved_at: new Date(),
        severity: "RESTORED",
      },
    });
    if (updated.count === 0) {
      throw new RepositoryError("Hardware outage event not found", "NOT_FOUND");
    }

    const event = await db.hardwareOutageEvent.findFirst({
      where: { id: outageId },
    });
    if (!event) {
      throw new RepositoryError("Hardware outage event not found", "NOT_FOUND");
    }
    return event;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "HardwareOutageEvent");
  }
}

export async function listHardwareOutageEvents(
  companyId: string,
  options?: { site_id?: string; limit?: number },
): Promise<HardwareOutageEvent[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));

  try {
    const db = scopedDb(companyId);
    return await db.hardwareOutageEvent.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
      },
      orderBy: [{ started_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "HardwareOutageEvent");
  }
}
