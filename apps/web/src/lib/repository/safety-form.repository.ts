import { scopedDb } from "@/lib/db/scoped-db";
import {
  DEFAULT_SAFETY_FORM_TEMPLATES,
  type DefaultSafetyFormTemplate,
} from "@/lib/safety-forms/defaults";
import type {
  Prisma,
  SafetyFormSubmission,
  SafetyFormSubmissionStatus,
  SafetyFormTemplate,
  SafetyFormType,
} from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface CreateSafetyFormTemplateInput {
  site_id?: string | null;
  form_type: SafetyFormType;
  name: string;
  description?: string | null;
  field_schema: Prisma.InputJsonValue;
  created_by?: string | null;
  is_active?: boolean;
}

export interface ListSafetyFormTemplateFilter {
  site_id?: string;
  form_type?: SafetyFormType;
  include_inactive?: boolean;
  limit?: number;
}

export interface CreateSafetyFormSubmissionInput {
  site_id: string;
  template_id: string;
  sign_in_record_id?: string | null;
  submitted_by_name: string;
  submitted_by_email?: string | null;
  submitted_by_phone?: string | null;
  payload: Prisma.InputJsonValue;
  summary?: string | null;
}

export interface ListSafetyFormSubmissionFilter {
  site_id?: string;
  template_id?: string;
  status?: SafetyFormSubmissionStatus;
  limit?: number;
}

interface SafetyFormDbDelegate {
  safetyFormTemplate: {
    create: (args: Record<string, unknown>) => Promise<SafetyFormTemplate>;
    findFirst: (args: Record<string, unknown>) => Promise<SafetyFormTemplate | null>;
    findMany: (args: Record<string, unknown>) => Promise<SafetyFormTemplate[]>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  safetyFormSubmission: {
    create: (args: Record<string, unknown>) => Promise<SafetyFormSubmission>;
    findFirst: (args: Record<string, unknown>) => Promise<SafetyFormSubmission | null>;
    findMany: (args: Record<string, unknown>) => Promise<SafetyFormSubmission[]>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
}

function getSafetyFormDb(companyId: string): SafetyFormDbDelegate {
  return scopedDb(companyId) as unknown as SafetyFormDbDelegate;
}

function normalizeOptionalString(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function assertPayloadJson(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
  const payload = value as unknown;
  if (!payload || typeof payload !== "object") {
    throw new RepositoryError("payload must be a JSON object or array", "VALIDATION");
  }
  return value;
}

async function findMatchingTemplate(
  companyId: string,
  input: {
    template_id: string;
    site_id: string;
  },
): Promise<SafetyFormTemplate | null> {
  const db = getSafetyFormDb(companyId);
  return db.safetyFormTemplate.findFirst({
    where: {
      company_id: companyId,
      id: input.template_id,
      is_active: true,
      OR: [{ site_id: input.site_id }, { site_id: null }],
    },
  });
}

export async function listSafetyFormTemplates(
  companyId: string,
  filter?: ListSafetyFormTemplateFilter,
): Promise<SafetyFormTemplate[]> {
  requireCompanyId(companyId);
  const db = getSafetyFormDb(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 250, 1000));
  const siteId = normalizeOptionalString(filter?.site_id, 255);

  try {
    return await db.safetyFormTemplate.findMany({
      where: {
        company_id: companyId,
        ...(filter?.form_type ? { form_type: filter.form_type } : {}),
        ...(filter?.include_inactive ? {} : { is_active: true }),
        ...(siteId
          ? {
              OR: [{ site_id: siteId }, { site_id: null }],
            }
          : {}),
      },
      orderBy: [{ form_type: "asc" }, { name: "asc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "SafetyFormTemplate");
  }
}

export async function createSafetyFormTemplate(
  companyId: string,
  input: CreateSafetyFormTemplateInput,
): Promise<SafetyFormTemplate> {
  requireCompanyId(companyId);

  const name = normalizeOptionalString(input.name, 160);
  if (!name) {
    throw new RepositoryError("Template name is required", "VALIDATION");
  }

  const siteId = normalizeOptionalString(input.site_id ?? null, 255);
  const description = normalizeOptionalString(input.description ?? null, 4000);
  const createdBy = normalizeOptionalString(input.created_by ?? null, 255);
  const db = getSafetyFormDb(companyId);

  try {
    const existing = await db.safetyFormTemplate.findFirst({
      where: {
        company_id: companyId,
        site_id: siteId,
        form_type: input.form_type,
        name,
      },
    });

    if (existing) {
      return existing;
    }

    return await db.safetyFormTemplate.create({
      data: {
        site_id: siteId,
        form_type: input.form_type,
        name,
        description,
        field_schema: assertPayloadJson(input.field_schema),
        created_by: createdBy,
        is_active: input.is_active !== false,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "SafetyFormTemplate");
  }
}

export async function deactivateSafetyFormTemplate(
  companyId: string,
  templateId: string,
): Promise<SafetyFormTemplate> {
  requireCompanyId(companyId);
  const id = normalizeOptionalString(templateId, 255);
  if (!id) {
    throw new RepositoryError("Template ID is required", "VALIDATION");
  }

  const db = getSafetyFormDb(companyId);

  try {
    const result = await db.safetyFormTemplate.updateMany({
      where: {
        company_id: companyId,
        id,
      },
      data: {
        is_active: false,
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Safety form template not found", "NOT_FOUND");
    }

    const updated = await db.safetyFormTemplate.findFirst({
      where: { company_id: companyId, id },
    });
    if (!updated) {
      throw new RepositoryError("Safety form template not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "SafetyFormTemplate");
  }
}

export async function createSafetyFormSubmission(
  companyId: string,
  input: CreateSafetyFormSubmissionInput,
): Promise<SafetyFormSubmission> {
  requireCompanyId(companyId);
  const siteId = normalizeOptionalString(input.site_id, 255);
  if (!siteId) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  const templateId = normalizeOptionalString(input.template_id, 255);
  if (!templateId) {
    throw new RepositoryError("template_id is required", "VALIDATION");
  }
  const submittedByName = normalizeOptionalString(input.submitted_by_name, 160);
  if (!submittedByName) {
    throw new RepositoryError("submitted_by_name is required", "VALIDATION");
  }

  const template = await findMatchingTemplate(companyId, {
    template_id: templateId,
    site_id: siteId,
  });
  if (!template) {
    throw new RepositoryError(
      "Safety form template is not available for this site",
      "NOT_FOUND",
    );
  }

  const db = getSafetyFormDb(companyId);

  try {
    return await db.safetyFormSubmission.create({
      data: {
        site_id: siteId,
        template_id: templateId,
        sign_in_record_id: normalizeOptionalString(input.sign_in_record_id ?? null, 255),
        submitted_by_name: submittedByName,
        submitted_by_email: normalizeOptionalString(input.submitted_by_email ?? null, 320),
        submitted_by_phone: normalizeOptionalString(input.submitted_by_phone ?? null, 64),
        payload: assertPayloadJson(input.payload),
        summary: normalizeOptionalString(input.summary ?? null, 2000),
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "SafetyFormSubmission");
  }
}

export async function listSafetyFormSubmissions(
  companyId: string,
  filter?: ListSafetyFormSubmissionFilter,
): Promise<SafetyFormSubmission[]> {
  requireCompanyId(companyId);
  const db = getSafetyFormDb(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 500, 1000));

  try {
    return await db.safetyFormSubmission.findMany({
      where: {
        company_id: companyId,
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.template_id ? { template_id: filter.template_id } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: [{ submitted_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "SafetyFormSubmission");
  }
}

export async function reviewSafetyFormSubmission(
  companyId: string,
  input: {
    submission_id: string;
    status: Extract<SafetyFormSubmissionStatus, "REVIEWED" | "REJECTED">;
    reviewed_by?: string | null;
    review_notes?: string | null;
  },
): Promise<SafetyFormSubmission> {
  requireCompanyId(companyId);

  const submissionId = normalizeOptionalString(input.submission_id, 255);
  if (!submissionId) {
    throw new RepositoryError("submission_id is required", "VALIDATION");
  }

  const db = getSafetyFormDb(companyId);

  try {
    const result = await db.safetyFormSubmission.updateMany({
      where: {
        company_id: companyId,
        id: submissionId,
      },
      data: {
        status: input.status,
        reviewed_at: new Date(),
        reviewed_by: normalizeOptionalString(input.reviewed_by ?? null, 255),
        review_notes: normalizeOptionalString(input.review_notes ?? null, 2000),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Safety form submission not found", "NOT_FOUND");
    }

    const updated = await db.safetyFormSubmission.findFirst({
      where: { company_id: companyId, id: submissionId },
    });
    if (!updated) {
      throw new RepositoryError("Safety form submission not found", "NOT_FOUND");
    }

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "SafetyFormSubmission");
  }
}

export async function installDefaultSafetyFormTemplates(
  companyId: string,
  input?: {
    site_id?: string | null;
    created_by?: string | null;
    defaults?: DefaultSafetyFormTemplate[];
  },
): Promise<{ created: number; skipped: number }> {
  requireCompanyId(companyId);

  const defaults = input?.defaults ?? DEFAULT_SAFETY_FORM_TEMPLATES;
  const siteId = normalizeOptionalString(input?.site_id ?? null, 255);
  const createdBy = normalizeOptionalString(input?.created_by ?? null, 255);

  let created = 0;
  let skipped = 0;

  for (const template of defaults) {
    const existing = await listSafetyFormTemplates(companyId, {
      site_id: siteId ?? undefined,
      form_type: template.formType,
      include_inactive: true,
      limit: 100,
    });

    const alreadyExists = existing.some(
      (record) =>
        record.name.trim().toLowerCase() === template.name.trim().toLowerCase() &&
        (record.site_id ?? null) === siteId,
    );

    if (alreadyExists) {
      skipped += 1;
      continue;
    }

    await createSafetyFormTemplate(companyId, {
      site_id: siteId,
      form_type: template.formType,
      name: template.name,
      description: template.description,
      field_schema: template.fieldSchema,
      created_by: createdBy,
      is_active: true,
    });

    created += 1;
  }

  return { created, skipped };
}
