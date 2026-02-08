/**
 * Induction Template Repository
 *
 * Handles template CRUD with versioning and constraint enforcement.
 *
 * BUSINESS RULES:
 * - site_id null = company-wide default template
 * - At most one is_published=true AND is_default=true per company (when site_id is null)
 * - At most one is_published=true template per site (when site_id is not null)
 * - Archived templates are immutable (old versions)
 * - Publishing increments version and archives the previous version
 *
 * INDEX USAGE:
 * - @@index([company_id]) - base tenant filtering
 * - @@index([company_id, site_id]) - site-specific template queries
 * - @@index([company_id, is_default, is_published]) - finding company default
 * - @@index([site_id, is_published]) - finding site active template
 */

import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
import {
  requireCompanyId,
  handlePrismaError,
  normalizePagination,
  paginatedResult,
  RepositoryError,
  type PaginationParams,
  type PaginatedResult,
} from "./base";

type JsonValue = Prisma.JsonValue;

/**
 * Unarchive a template (sets is_archived to false)
 * SECURITY: Uses updateMany with compound WHERE to prevent TOCTOU attacks.
 * The update is atomic - if the template doesn't belong to the company or
 * is not archived, no rows are updated (fail-closed).
 */
export async function unarchiveTemplate(
  companyId: string,
  templateId: string,
): Promise<TemplateWithCounts> {
  requireCompanyId(companyId);

  try {
    // Atomic update with tenant scoping AND state check in WHERE clause
    const db = scopedDb(companyId);

    const result = await db.inductionTemplate.updateMany({
      where: { id: templateId, company_id: companyId, is_archived: true },
      data: { is_archived: false },
    });

    // Fail-closed: if no rows updated, determine specific error
    if (result.count === 0) {
      const template = await db.inductionTemplate.findFirst({
        where: { id: templateId, company_id: companyId },
        select: { is_archived: true },
      });

      if (!template) {
        throw new RepositoryError("Template not found", "NOT_FOUND");
      }

      if (!template.is_archived) {
        throw new RepositoryError("Template is not archived", "VALIDATION");
      }

      // Shouldn't reach here, but fail-closed
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    // Fetch and return the updated template
    const updated = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });

    if (!updated) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    return updated as TemplateWithCounts;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionTemplate");
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Template with question count
 */
export interface TemplateWithCounts {
  id: string;
  company_id: string;
  site_id: string | null;
  name: string;
  description: string | null;
  version: number;
  is_published: boolean;
  is_default: boolean;
  is_archived: boolean;
  published_at: Date | null;
  force_reinduction: boolean;
  created_at: Date;
  updated_at: Date;
  site: { id: string; name: string } | null;
  _count: {
    questions: number;
    responses: number;
  };
}

/**
 * Template with questions
 */
export interface TemplateWithQuestions {
  id: string;
  company_id: string;
  site_id: string | null;
  name: string;
  description: string | null;
  version: number;
  is_published: boolean;
  is_default: boolean;
  is_archived: boolean;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  site: { id: string; name: string } | null;
  questions: QuestionData[];
  force_reinduction: boolean;
}

/**
 * Question data structure
 */
export interface QuestionData {
  id: string;
  template_id: string;
  question_text: string;
  question_type: QuestionType;
  options: JsonValue;
  is_required: boolean;
  display_order: number;
  correct_answer: JsonValue;
  logic?: JsonValue;
  created_at: Date;
  updated_at: Date;
}

type QuestionType =
  | "TEXT"
  | "MULTIPLE_CHOICE"
  | "CHECKBOX"
  | "YES_NO"
  | "ACKNOWLEDGMENT";

/**
 * Filter options for templates
 */
export interface TemplateFilter {
  siteId?: string | null; // null = company defaults only, undefined = all
  isPublished?: boolean;
  isArchived?: boolean;
  isDefault?: boolean;
  search?: string;
}

/**
 * Input for creating a template
 */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  site_id?: string; // null = company default
  is_default?: boolean;
}

/**
 * Input for updating a template (only when not archived)
 */
export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  is_default?: boolean;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Find template by ID
 */
export async function findTemplateById(
  companyId: string,
  templateId: string,
): Promise<TemplateWithCounts | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });
    return result as TemplateWithCounts | null;
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Find template with questions
 */
export async function findTemplateWithQuestions(
  companyId: string,
  templateId: string,
): Promise<TemplateWithQuestions | null> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);
    const result = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        questions: {
          orderBy: { display_order: "asc" },
        },
      },
    });
    return result as TemplateWithQuestions | null;
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * List templates with pagination and filters
 */
export async function listTemplates(
  companyId: string,
  filter: TemplateFilter = {},
  pagination: PaginationParams = {},
): Promise<PaginatedResult<TemplateWithCounts>> {
  requireCompanyId(companyId);

  const { skip, take, page, pageSize } = normalizePagination(pagination);

  const where: Prisma.InductionTemplateWhereInput = {
    company_id: companyId,
  };

  // Site filter - null means company defaults only
  if (filter.siteId === null) {
    where.site_id = null;
  } else if (filter.siteId !== undefined) {
    where.site_id = filter.siteId;
  }

  if (filter.isPublished !== undefined) {
    where.is_published = filter.isPublished;
  }

  if (filter.isArchived !== undefined) {
    where.is_archived = filter.isArchived;
  }

  if (filter.isDefault !== undefined) {
    where.is_default = filter.isDefault;
  }

  if (filter.search) {
    where.OR = [
      { name: { contains: filter.search, mode: "insensitive" } },
      { description: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  try {
    const db = scopedDb(companyId);

    const [items, total] = await Promise.all([
      db.inductionTemplate.findMany({
        where,
        include: {
          site: { select: { id: true, name: true } },
          _count: { select: { questions: true, responses: true } },
        },
        orderBy: [
          { is_published: "desc" },
          { version: "desc" },
          { name: "asc" },
        ],
        skip,
        take,
      }),
      db.inductionTemplate.count({ where }),
    ]);

    return paginatedResult(items, total, page, pageSize);
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Get active template for a site (site-specific or company default)
 * Used by public QR sign-in flow
 */
export async function getActiveTemplateForSite(
  companyId: string,
  siteId: string,
): Promise<TemplateWithQuestions | null> {
  requireCompanyId(companyId);

  try {
    // First try site-specific published template
    const db = scopedDb(companyId);

    const template = await db.inductionTemplate.findFirst({
      where: {
        company_id: companyId,
        site_id: siteId,
        is_published: true,
        is_archived: false,
      },
      include: {
        site: { select: { id: true, name: true } },
        questions: { orderBy: { display_order: "asc" } },
      },
    });

    // Fall back to company default
    if (!template) {
      const defaultTemplate = await db.inductionTemplate.findFirst({
        where: {
          company_id: companyId,
          site_id: null,
          is_published: true,
          is_default: true,
          is_archived: false,
        },
        include: {
          site: { select: { id: true, name: true } },
          questions: { orderBy: { display_order: "asc" } },
        },
      });
      return defaultTemplate as TemplateWithQuestions | null;
    }

    return template as TemplateWithQuestions | null;
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Get all versions of a template by name
 */
export async function getTemplateVersions(
  companyId: string,
  templateName: string,
  siteId?: string | null,
): Promise<TemplateWithCounts[]> {
  requireCompanyId(companyId);

  try {
    const db = scopedDb(companyId);

    return await db.inductionTemplate.findMany({
      where: {
        company_id: companyId,
        name: templateName,
        site_id: siteId ?? null,
      },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
      orderBy: { version: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new template (draft, not published)
 */
export async function createTemplate(
  companyId: string,
  input: CreateTemplateInput,
): Promise<TemplateWithCounts> {
  requireCompanyId(companyId);

  // Input validation
  const name = input.name?.trim();
  if (!name) {
    throw new RepositoryError("Template name is required", "VALIDATION");
  }
  if (name.length > 100) {
    throw new RepositoryError(
      "Template name must be 100 characters or less",
      "VALIDATION",
    );
  }

  // Validate site belongs to company if provided
  if (input.site_id) {
    const db = scopedDb(companyId);
    const site = await db.site.findFirst({
      where: { id: input.site_id, company_id: companyId },
    });
    if (!site) {
      throw new RepositoryError("Site not found", "NOT_FOUND");
    }
  }

  // Check if a template with same name exists (for version 1)
  const db = scopedDb(companyId);
  const existing = await db.inductionTemplate.findFirst({
    where: {
      company_id: companyId,
      name: name,
      site_id: input.site_id ?? null,
      version: 1,
    },
  });

  if (existing) {
    throw new RepositoryError(`Template "${name}" already exists`, "DUPLICATE");
  }

  try {
    const created = await db.inductionTemplate.create({
      data: {
        site_id: input.site_id ?? null,
        name: name,
        description: input.description ?? null,
        is_default: input.is_default ?? false,
        version: 1,
        is_published: false,
        is_archived: false,
      },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });
    return created as TemplateWithCounts;
  } catch (error) {
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Update template metadata (only if not archived and not published)
 *
 * SECURITY: Uses updateMany with compound WHERE to prevent TOCTOU attacks.
 * The update is atomic - if the template doesn't belong to the company,
 * is archived, or is published, no rows are updated (fail-closed).
 */
export async function updateTemplate(
  companyId: string,
  templateId: string,
  input: UpdateTemplateInput,
): Promise<TemplateWithCounts> {
  requireCompanyId(companyId);

  try {
    // Atomic update with tenant scoping AND state checks in WHERE clause
    // This prevents TOCTOU: ownership check, state validation, and update happen atomically
    const db = scopedDb(companyId);

    const result = await db.inductionTemplate.updateMany({
      where: {
        id: templateId,
        company_id: companyId,
        is_archived: false,
        is_published: false,
      },
      data: {
        name: input.name,
        description: input.description,
        is_default: input.is_default,
      },
    });

    // Fail-closed: if no rows updated, determine specific error
    if (result.count === 0) {
      const template = await db.inductionTemplate.findFirst({
        where: { id: templateId, company_id: companyId },
        select: { is_archived: true, is_published: true },
      });

      if (!template) {
        throw new RepositoryError("Template not found", "NOT_FOUND");
      }

      if (template.is_archived) {
        throw new RepositoryError(
          "Cannot update archived template. Create a new version instead.",
          "VALIDATION",
        );
      }

      if (template.is_published) {
        throw new RepositoryError(
          "Cannot update published template. Create a new version instead.",
          "VALIDATION",
        );
      }

      // Shouldn't reach here, but fail-closed
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    // Fetch and return the updated template
    const updated = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });

    if (!updated) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    return updated as TemplateWithCounts;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Publish a template version
 *
 * BUSINESS RULES:
 * - Archives any previously published version of the same template
 * - For site-specific: ensures only one published template per site
 * - For company default: ensures only one published default per company
 */
export async function publishTemplate(
  companyId: string,
  templateId: string,
  forceReinduction: boolean = false,
): Promise<TemplateWithCounts> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const template = await db.inductionTemplate.findFirst({
    where: { id: templateId, company_id: companyId },
    include: { questions: true },
  });

  if (!template) {
    throw new RepositoryError("Template not found", "NOT_FOUND");
  }

  if (template.is_archived) {
    throw new RepositoryError("Cannot publish archived template", "VALIDATION");
  }

  if (template.is_published) {
    throw new RepositoryError("Template is already published", "VALIDATION");
  }

  if (template.questions.length === 0) {
    throw new RepositoryError(
      "Cannot publish template without questions",
      "VALIDATION",
    );
  }

  return await publicDb.$transaction(async (tx) => {
    const db = scopedDb(companyId, tx);

    // Archive any existing published template with same name
    await db.inductionTemplate.updateMany({
      where: {
        company_id: companyId,
        name: template.name,
        site_id: template.site_id,
        is_published: true,
        is_archived: false,
        id: { not: templateId },
      },
      data: {
        is_published: false,
        is_archived: true,
      },
    });

    // For site-specific templates, unpublish any other active template for this site
    if (template.site_id) {
      await db.inductionTemplate.updateMany({
        where: {
          company_id: companyId,
          site_id: template.site_id,
          is_published: true,
          id: { not: templateId },
        },
        data: {
          is_published: false,
          is_archived: true,
        },
      });
    }

    // For company defaults, ensure only one default is published
    if (template.site_id === null && template.is_default) {
      await db.inductionTemplate.updateMany({
        where: {
          company_id: companyId,
          site_id: null,
          is_default: true,
          is_published: true,
          id: { not: templateId },
        },
        data: {
          is_published: false,
          is_archived: true,
        },
      });
    }

    // Publish this template (tenant-scoped) and return the updated template using a unique update
    const updateResult = await db.inductionTemplate.updateMany({
      where: { id: templateId, company_id: companyId },
      data: {
        is_published: true,
        published_at: new Date(),
        force_reinduction: forceReinduction,
      },
    });

    if (updateResult.count === 0) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    const updated = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });

    if (!updated) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    return updated as TemplateWithCounts;
  });
}

/**
 * Create a new version of an existing template
 * Copies questions from the source template
 */
export async function createNewVersion(
  companyId: string,
  sourceTemplateId: string,
): Promise<TemplateWithQuestions> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const source = await db.inductionTemplate.findFirst({
    where: { id: sourceTemplateId, company_id: companyId },
    include: { questions: { orderBy: { display_order: "asc" } } },
  });

  if (!source) {
    throw new RepositoryError("Template not found", "NOT_FOUND");
  }

  // Get highest version number for this template
  const latestVersion = await db.inductionTemplate.findFirst({
    where: {
      company_id: companyId,
      name: source.name,
      site_id: source.site_id,
    },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const newVersion = (latestVersion?.version ?? 0) + 1;

  return await publicDb.$transaction(async (tx) => {
    const db = scopedDb(companyId, tx);

    // Create new template version
    const newTemplate = await db.inductionTemplate.create({
      data: {
        company_id: companyId,
        site_id: source.site_id,
        name: source.name,
        description: source.description,
        version: newVersion,
        is_default: source.is_default,
        is_published: false,
        is_archived: false,
      },
    });

    // Copy questions to new template
    if (source.questions.length > 0) {
      const questions = source.questions as QuestionData[];
      await tx.inductionQuestion.createMany({
        data: questions.map((q) => ({
          template_id: newTemplate.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options === null ? Prisma.JsonNull : q.options,
          is_required: q.is_required,
          display_order: q.display_order,
          correct_answer:
            q.correct_answer === null ? Prisma.JsonNull : q.correct_answer,
        })),
      });
    }

    // Return with questions
    const created = await db.inductionTemplate.findFirst({
      where: { id: newTemplate.id, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        questions: { orderBy: { display_order: "asc" } },
      },
    });

    if (!created) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    return created as TemplateWithQuestions;
  });
}

/**
 * Archive a template (makes it immutable)
 *
 * SECURITY: Uses updateMany with compound WHERE to prevent TOCTOU attacks.
 * The update is atomic - if the template doesn't belong to the company or
 * is already archived, no rows are updated (fail-closed).
 */
export async function archiveTemplate(
  companyId: string,
  templateId: string,
): Promise<TemplateWithCounts> {
  requireCompanyId(companyId);

  try {
    // Atomic update with tenant scoping AND state check in WHERE clause
    const db = scopedDb(companyId);

    const result = await db.inductionTemplate.updateMany({
      where: { id: templateId, company_id: companyId, is_archived: false },
      data: { is_archived: true, is_published: false },
    });

    // Fail-closed: if no rows updated, determine specific error
    if (result.count === 0) {
      const template = await db.inductionTemplate.findFirst({
        where: { id: templateId, company_id: companyId },
        select: { is_archived: true },
      });

      if (!template) {
        throw new RepositoryError("Template not found", "NOT_FOUND");
      }

      if (template.is_archived) {
        throw new RepositoryError("Template is already archived", "VALIDATION");
      }

      // Shouldn't reach here, but fail-closed
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    // Fetch and return the updated template
    const updated = await db.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { questions: true, responses: true } },
      },
    });

    if (!updated) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    return updated as TemplateWithCounts;
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionTemplate");
  }
}

/**
 * Delete a template (only if draft and no responses)
 *
 * SECURITY: Uses transaction with compound WHERE to prevent TOCTOU attacks.
 * The check and delete happen within a transaction with consistent reads.
 */
export async function deleteTemplate(
  companyId: string,
  templateId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    await publicDb.$transaction(async (tx) => {
      const db = scopedDb(companyId, tx);

      // Atomic check within transaction - find template with response count
      const template = await db.inductionTemplate.findFirst({
        where: { id: templateId, company_id: companyId },
        include: { _count: { select: { responses: true } } },
      });

      if (!template) {
        throw new RepositoryError("Template not found", "NOT_FOUND");
      }

      if (template.is_published || template.is_archived) {
        throw new RepositoryError(
          "Cannot delete published or archived templates. Archive instead.",
          "VALIDATION",
        );
      }

      if (template._count.responses > 0) {
        throw new RepositoryError(
          "Cannot delete template with existing responses",
          "VALIDATION",
        );
      }

      // Delete within same transaction - template verified to belong to company
      await db.inductionTemplate.deleteMany({
        where: { id: templateId, company_id: companyId },
      });
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionTemplate");
  }
}

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * Count templates by status
 */
export async function countTemplates(
  companyId: string,
  filter?: TemplateFilter,
): Promise<number> {
  requireCompanyId(companyId);

  const db = scopedDb(companyId);
  const where: Prisma.InductionTemplateWhereInput = { company_id: companyId };

  if (filter?.isPublished !== undefined) {
    where.is_published = filter.isPublished;
  }

  if (filter?.isArchived !== undefined) {
    where.is_archived = filter.isArchived;
  }

  return await db.inductionTemplate.count({ where });
}
