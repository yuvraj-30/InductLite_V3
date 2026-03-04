import { scopedDb } from "@/lib/db/scoped-db";
import type {
  ContractorPrequalification,
  ContractorPrequalificationStatus,
  PermitApproval,
  PermitApprovalDecision,
  PermitCondition,
  PermitLifecycleStatus,
  PermitRequest,
  PermitTemplate,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreatePermitTemplateInput {
  site_id?: string;
  name: string;
  permit_type: string;
  description?: string;
  approval_policy?: Record<string, unknown>;
  is_required_for_signin?: boolean;
}

export interface CreatePermitConditionInput {
  permit_template_id: string;
  stage: string;
  condition_type: string;
  title: string;
  details?: string;
  is_required?: boolean;
  sort_order?: number;
}

export interface CreatePermitRequestInput {
  site_id: string;
  permit_template_id: string;
  contractor_id?: string;
  requestor_user_id?: string;
  assignee_user_id?: string;
  visitor_name?: string;
  visitor_phone?: string;
  visitor_email?: string;
  employer_name?: string;
  notes?: string;
  validity_start?: Date;
  validity_end?: Date;
}

export interface ListPermitRequestFilter {
  site_id?: string;
  status?: PermitLifecycleStatus;
  permit_template_id?: string;
  visitor_phone?: string;
}

export interface TransitionPermitRequestInput {
  permit_request_id: string;
  status: PermitLifecycleStatus;
  actor_user_id?: string;
  notes?: string;
}

export interface CreatePermitApprovalInput {
  permit_request_id: string;
  stage: number;
  approver_user_id: string;
  decision: PermitApprovalDecision;
  notes?: string;
}

export interface UpsertContractorPrequalificationInput {
  contractor_id: string;
  site_id?: string;
  score: number;
  status: ContractorPrequalificationStatus;
  checklist?: Record<string, unknown>;
  evidence_refs?: Record<string, unknown>;
  expires_at?: Date;
  reviewed_by?: string;
}

const ACTIVE_PERMIT_STATUSES: PermitLifecycleStatus[] = [
  "APPROVED",
  "ACTIVE",
];

function normalizeOptionalDate(value?: Date): Date | null {
  if (!value) return null;
  return Number.isNaN(value.getTime()) ? null : value;
}

export async function listPermitTemplates(
  companyId: string,
  siteId?: string,
): Promise<PermitTemplate[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    return await db.permitTemplate.findMany({
      where: {
        ...(siteId ? { site_id: siteId } : {}),
      },
      orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "PermitTemplate");
  }
}

export async function findRequiredPermitTemplateForSite(
  companyId: string,
  siteId: string,
): Promise<PermitTemplate | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    return await db.permitTemplate.findFirst({
      where: {
        site_id: siteId,
        is_active: true,
        is_required_for_signin: true,
      },
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "PermitTemplate");
  }
}

export async function createPermitTemplate(
  companyId: string,
  input: CreatePermitTemplateInput,
): Promise<PermitTemplate> {
  requireCompanyId(companyId);
  if (!input.name.trim()) {
    throw new RepositoryError("Template name is required", "VALIDATION");
  }
  if (!input.permit_type.trim()) {
    throw new RepositoryError("Permit type is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.permitTemplate.create({
      data: {
        site_id: input.site_id ?? null,
        name: input.name.trim(),
        permit_type: input.permit_type.trim(),
        description: input.description?.trim() || null,
        approval_policy: input.approval_policy ?? null,
        is_required_for_signin: input.is_required_for_signin === true,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PermitTemplate");
  }
}

export async function updatePermitTemplate(
  companyId: string,
  permitTemplateId: string,
  input: Partial<CreatePermitTemplateInput> & { is_active?: boolean },
): Promise<PermitTemplate> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const result = await db.permitTemplate.updateMany({
      where: { id: permitTemplateId },
      data: {
        ...(input.site_id !== undefined ? { site_id: input.site_id } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.permit_type !== undefined
          ? { permit_type: input.permit_type.trim() }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.approval_policy !== undefined
          ? { approval_policy: input.approval_policy as object }
          : {}),
        ...(input.is_required_for_signin !== undefined
          ? { is_required_for_signin: input.is_required_for_signin }
          : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Permit template not found", "NOT_FOUND");
    }

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const updated = await db.permitTemplate.findFirst({
      where: { id: permitTemplateId },
    });
    if (!updated) {
      throw new RepositoryError("Permit template not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PermitTemplate");
  }
}

export async function listPermitConditions(
  companyId: string,
  permitTemplateId: string,
): Promise<PermitCondition[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.permitCondition.findMany({
      where: { permit_template_id: permitTemplateId },
      orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "PermitCondition");
  }
}

export async function createPermitCondition(
  companyId: string,
  input: CreatePermitConditionInput,
): Promise<PermitCondition> {
  requireCompanyId(companyId);
  if (!input.permit_template_id.trim()) {
    throw new RepositoryError("permit_template_id is required", "VALIDATION");
  }
  if (!input.title.trim()) {
    throw new RepositoryError("Condition title is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.permitCondition.create({
      data: {
        permit_template_id: input.permit_template_id,
        stage: input.stage.trim(),
        condition_type: input.condition_type.trim(),
        title: input.title.trim(),
        details: input.details?.trim() || null,
        is_required: input.is_required !== false,
        sort_order: input.sort_order ?? 0,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PermitCondition");
  }
}

export async function createPermitRequest(
  companyId: string,
  input: CreatePermitRequestInput,
): Promise<PermitRequest> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.permit_template_id.trim()) {
    throw new RepositoryError("permit_template_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.permitRequest.create({
      data: {
        site_id: input.site_id,
        permit_template_id: input.permit_template_id,
        contractor_id: input.contractor_id || null,
        requestor_user_id: input.requestor_user_id || null,
        assignee_user_id: input.assignee_user_id || null,
        visitor_name: input.visitor_name?.trim() || null,
        visitor_phone: input.visitor_phone?.trim() || null,
        visitor_email: input.visitor_email?.trim().toLowerCase() || null,
        employer_name: input.employer_name?.trim() || null,
        notes: input.notes?.trim() || null,
        status: "REQUESTED",
        requested_at: new Date(),
        validity_start: normalizeOptionalDate(input.validity_start),
        validity_end: normalizeOptionalDate(input.validity_end),
      },
    });
  } catch (error) {
    handlePrismaError(error, "PermitRequest");
  }
}

export async function listPermitRequests(
  companyId: string,
  filter: ListPermitRequestFilter = {},
): Promise<PermitRequest[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    return await db.permitRequest.findMany({
      where: {
        ...(filter.site_id ? { site_id: filter.site_id } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.permit_template_id
          ? { permit_template_id: filter.permit_template_id }
          : {}),
        ...(filter.visitor_phone ? { visitor_phone: filter.visitor_phone } : {}),
      },
      orderBy: [{ created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "PermitRequest");
  }
}

export async function transitionPermitRequest(
  companyId: string,
  input: TransitionPermitRequestInput,
): Promise<PermitRequest> {
  requireCompanyId(companyId);
  if (!input.permit_request_id.trim()) {
    throw new RepositoryError("permit_request_id is required", "VALIDATION");
  }

  const now = new Date();
  const lifecycleData: Record<string, Date | string | null> = {
    status: input.status,
  };
  if (input.status === "APPROVED") lifecycleData.approved_at = now;
  if (input.status === "ACTIVE") lifecycleData.active_at = now;
  if (input.status === "SUSPENDED") lifecycleData.suspended_at = now;
  if (input.status === "CLOSED" || input.status === "DENIED") {
    lifecycleData.closed_at = now;
  }
  if (input.notes !== undefined) {
    lifecycleData.notes = input.notes.trim() || null;
  }

  try {
    const db = scopedDb(companyId);
    const updated = await db.permitRequest.updateMany({
      where: { id: input.permit_request_id },
      data: lifecycleData,
    });
    if (updated.count === 0) {
      throw new RepositoryError("Permit request not found", "NOT_FOUND");
    }

    const request = await db.permitRequest.findFirst({
      where: { id: input.permit_request_id },
    });
    if (!request) {
      throw new RepositoryError("Permit request not found", "NOT_FOUND");
    }
    return request;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "PermitRequest");
  }
}

export async function createPermitApproval(
  companyId: string,
  input: CreatePermitApprovalInput,
): Promise<PermitApproval> {
  requireCompanyId(companyId);
  if (!input.permit_request_id.trim()) {
    throw new RepositoryError("permit_request_id is required", "VALIDATION");
  }
  if (!input.approver_user_id.trim()) {
    throw new RepositoryError("approver_user_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.permitApproval.create({
      data: {
        permit_request_id: input.permit_request_id,
        stage: input.stage,
        approver_user_id: input.approver_user_id,
        decision: input.decision,
        notes: input.notes?.trim() || null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "PermitApproval");
  }
}

export async function findActivePermitForVisitor(
  companyId: string,
  input: {
    site_id: string;
    visitor_phone?: string;
    visitor_email?: string;
  },
): Promise<PermitRequest | null> {
  requireCompanyId(companyId);

  const visitorPhone = input.visitor_phone?.trim();
  const visitorEmail = input.visitor_email?.trim().toLowerCase();
  if (!visitorPhone && !visitorEmail) {
    return null;
  }

  const now = new Date();

  try {
    const db = scopedDb(companyId);
    return await db.permitRequest.findFirst({
      where: {
        site_id: input.site_id,
        status: { in: ACTIVE_PERMIT_STATUSES },
        AND: [
          {
            OR: [
              ...(visitorPhone ? [{ visitor_phone: visitorPhone }] : []),
              ...(visitorEmail ? [{ visitor_email: visitorEmail }] : []),
            ],
          },
          {
            OR: [
              { validity_start: null },
              { validity_start: { lte: now } },
            ],
          },
          {
            OR: [{ validity_end: null }, { validity_end: { gte: now } }],
          },
        ],
      },
      orderBy: [{ active_at: "desc" }, { approved_at: "desc" }, { created_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "PermitRequest");
  }
}

export async function upsertContractorPrequalification(
  companyId: string,
  input: UpsertContractorPrequalificationInput,
): Promise<ContractorPrequalification> {
  requireCompanyId(companyId);
  if (!input.contractor_id.trim()) {
    throw new RepositoryError("contractor_id is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const existing = await db.contractorPrequalification.findFirst({
      where: {
        contractor_id: input.contractor_id,
        site_id: input.site_id ?? null,
      },
    });

    if (!existing) {
      return await db.contractorPrequalification.create({
        data: {
          contractor_id: input.contractor_id,
          site_id: input.site_id ?? null,
          score: Math.max(0, Math.min(100, Math.trunc(input.score))),
          status: input.status,
          checklist: input.checklist ?? null,
          evidence_refs: input.evidence_refs ?? null,
          expires_at: normalizeOptionalDate(input.expires_at),
          reviewed_by: input.reviewed_by ?? null,
          reviewed_at: input.reviewed_by ? new Date() : null,
        },
      });
    }

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    await db.contractorPrequalification.updateMany({
      where: { id: existing.id },
      data: {
        score: Math.max(0, Math.min(100, Math.trunc(input.score))),
        status: input.status,
        checklist: input.checklist ?? null,
        evidence_refs: input.evidence_refs ?? null,
        expires_at: normalizeOptionalDate(input.expires_at),
        reviewed_by: input.reviewed_by ?? existing.reviewed_by,
        reviewed_at: input.reviewed_by ? new Date() : existing.reviewed_at,
      },
    });

    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    const updated = await db.contractorPrequalification.findFirst({
      where: { id: existing.id },
    });
    if (!updated) {
      throw new RepositoryError("Prequalification not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ContractorPrequalification");
  }
}

export async function listContractorPrequalifications(
  companyId: string,
  options?: { site_id?: string; contractor_id?: string },
): Promise<ContractorPrequalification[]> {
  requireCompanyId(companyId);
  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    return await db.contractorPrequalification.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        ...(options?.contractor_id ? { contractor_id: options.contractor_id } : {}),
      },
      orderBy: [{ updated_at: "desc" }],
    });
  } catch (error) {
    handlePrismaError(error, "ContractorPrequalification");
  }
}

export async function listPermitRequestsExpiringSoon(
  companyId: string,
  options?: { within_days?: number; site_id?: string; limit?: number },
): Promise<PermitRequest[]> {
  requireCompanyId(companyId);
  const withinDays = Math.max(1, Math.min(options?.within_days ?? 14, 120));
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));
  const now = new Date();
  const upperBound = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  try {
    const db = scopedDb(companyId);
    return await db.permitRequest.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        status: { in: ACTIVE_PERMIT_STATUSES },
        validity_end: {
          not: null,
          gte: now,
          lte: upperBound,
        },
      },
      orderBy: [{ validity_end: "asc" }, { updated_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "PermitRequest");
  }
}

export async function listContractorPrequalificationsExpiringSoon(
  companyId: string,
  options?: { within_days?: number; site_id?: string; limit?: number },
): Promise<ContractorPrequalification[]> {
  requireCompanyId(companyId);
  const withinDays = Math.max(1, Math.min(options?.within_days ?? 30, 180));
  const limit = Math.max(1, Math.min(options?.limit ?? 200, 1000));
  const now = new Date();
  const upperBound = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  try {
    const db = scopedDb(companyId);
    // eslint-disable-next-line security-guardrails/require-company-id -- company_id is enforced by scopedDb
    return await db.contractorPrequalification.findMany({
      where: {
        ...(options?.site_id ? { site_id: options.site_id } : {}),
        status: { in: ["APPROVED", "PENDING"] },
        expires_at: {
          not: null,
          gte: now,
          lte: upperBound,
        },
      },
      orderBy: [{ expires_at: "asc" }, { updated_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "ContractorPrequalification");
  }
}
