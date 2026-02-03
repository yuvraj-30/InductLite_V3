"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAdmin, assertOrigin } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findTemplateById,
  findTemplateWithQuestions,
  listTemplates,
  createTemplate,
  updateTemplate,
  publishTemplate,
  createNewVersion,
  archiveTemplate,
  deleteTemplate,
  unarchiveTemplate,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  type CreateTemplateInput,
  type UpdateTemplateInput,
  type CreateQuestionInput,
  type UpdateQuestionInput,
  type ReorderQuestionsInput,
  type TemplateFilter,
  type PaginationParams,
} from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  type ApiResponse,
  successResponse,
  errorResponse,
  permissionDeniedResponse,
  validationErrorResponse,
} from "@/lib/api";

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const templateIdSchema = z.string().cuid("Invalid template ID");

/**
 * Unarchive a template
 */
export async function unarchiveTemplateAction(
  templateId: string,
): Promise<ApiResponse<{ templateId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const template = await unarchiveTemplate(context.companyId, templateId);

    await createAuditLog(context.companyId, {
      action: "template.unarchive",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        name: template.name,
        version: template.version,
      },
      request_id: requestId,
    });

    log.info({ templateId }, "Template unarchived");
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse({ templateId }, `Template unarchived`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to unarchive template");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to unarchive template");
  }
}

// Export required server actions for forms

const createTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description too long").optional(),
  site_id: z.string().cuid("Invalid site ID").optional(),
  is_default: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less")
    .optional(),
  description: z.string().max(500, "Description too long").optional(),
  is_default: z.boolean().optional(),
});

const createQuestionSchema = z.object({
  question_text: z
    .string()
    .min(1, "Question text is required")
    .max(500, "Question too long"),
  question_type: z.enum([
    "TEXT",
    "MULTIPLE_CHOICE",
    "CHECKBOX",
    "YES_NO",
    "ACKNOWLEDGMENT",
  ]),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  display_order: z.number().int().positive().optional(),
  correct_answer: z.unknown().optional(),
});

const updateQuestionSchema = z.object({
  question_text: z
    .string()
    .min(1, "Question text is required")
    .max(500, "Question too long")
    .optional(),
  question_type: z
    .enum(["TEXT", "MULTIPLE_CHOICE", "CHECKBOX", "YES_NO", "ACKNOWLEDGMENT"])
    .optional(),
  options: z.array(z.string()).nullable().optional(),
  is_required: z.boolean().optional(),
  correct_answer: z.unknown().nullable().optional(),
});

const reorderSchema = z.array(
  z.object({
    questionId: z.string().cuid(),
    newOrder: z.number().int().positive(),
  }),
);

// ============================================================================
// TEMPLATE ACTIONS
// ============================================================================

/**
 * Create a new template
 */
export async function createTemplateAction(
  input: CreateTemplateInput,
): Promise<ApiResponse<{ templateId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  // Validate input
  const parsed = createTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid template data");
  }

  // Check admin permission
  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const template = await createTemplate(context.companyId, parsed.data);

    await createAuditLog(context.companyId, {
      action: "template.create",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        name: template.name,
        site_id: template.site_id,
        is_default: template.is_default,
      },
      request_id: requestId,
    });

    log.info({ templateId: template.id }, "Template created");
    revalidatePath("/admin/templates");

    return successResponse(
      { templateId: template.id },
      `Template "${template.name}" created`,
    );
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create template");
    if (error instanceof Error) {
      return errorResponse("INVALID_INPUT", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to create template");
  }
}

/**
 * Update template metadata
 */
export async function updateTemplateAction(
  templateId: string,
  input: UpdateTemplateInput,
): Promise<ApiResponse<{ templateId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  // Validate input
  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const parsed = updateTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid template data");
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const template = await updateTemplate(
      context.companyId,
      templateId,
      parsed.data,
    );

    await createAuditLog(context.companyId, {
      action: "template.update",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: { changes: parsed.data },
      request_id: requestId,
    });

    log.info({ templateId }, "Template updated");
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse({ templateId }, `Template updated`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update template");
    if (error instanceof Error) {
      return errorResponse("INVALID_INPUT", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to update template");
  }
}

/**
 * Publish a template
 */
export async function publishTemplateAction(
  templateId: string,
): Promise<ApiResponse<{ templateId: string; version: number }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  // Get template before publish for audit
  const templateBefore = await findTemplateById(context.companyId, templateId);
  if (!templateBefore) {
    return errorResponse("NOT_FOUND", "Template not found");
  }

  try {
    const template = await publishTemplate(context.companyId, templateId);

    await createAuditLog(context.companyId, {
      action: "template.publish",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        name: template.name,
        version: template.version,
        site_id: template.site_id,
        is_default: template.is_default,
        published_at: template.published_at?.toISOString(),
      },
      request_id: requestId,
    });

    log.info({ templateId, version: template.version }, "Template published");
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse(
      { templateId, version: template.version },
      `Template "${template.name}" v${template.version} published`,
    );
  } catch (error) {
    log.error({ error: String(error) }, "Failed to publish template");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to publish template");
  }
}

/**
 * Create a new version of a template
 */
export async function createNewVersionAction(
  sourceTemplateId: string,
): Promise<ApiResponse<{ templateId: string; version: number }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(sourceTemplateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const template = await createNewVersion(
      context.companyId,
      sourceTemplateId,
    );

    await createAuditLog(context.companyId, {
      action: "template.new_version",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        name: template.name,
        version: template.version,
        source_template_id: sourceTemplateId,
        questions_copied: template.questions.length,
      },
      request_id: requestId,
    });

    log.info(
      { templateId: template.id, version: template.version },
      "New template version created",
    );
    revalidatePath("/admin/templates");

    return successResponse(
      { templateId: template.id, version: template.version },
      `New version v${template.version} created`,
    );
  } catch (error) {
    log.error({ error: String(error) }, "Failed to create new version");
    if (error instanceof Error) {
      return errorResponse("INVALID_INPUT", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to create new version");
  }
}

/**
 * Archive a template
 */
export async function archiveTemplateAction(
  templateId: string,
): Promise<ApiResponse<{ templateId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const template = await archiveTemplate(context.companyId, templateId);

    await createAuditLog(context.companyId, {
      action: "template.archive",
      entity_type: "InductionTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        name: template.name,
        version: template.version,
      },
      request_id: requestId,
    });

    log.info({ templateId }, "Template archived");
    revalidatePath("/admin/templates");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse({ templateId }, `Template archived`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to archive template");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to archive template");
  }
}

/**
 * Delete a draft template
 */
export async function deleteTemplateAction(
  templateId: string,
): Promise<ApiResponse<void>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  // Get template before delete for audit
  const template = await findTemplateById(context.companyId, templateId);
  if (!template) {
    return errorResponse("NOT_FOUND", "Template not found");
  }

  try {
    await deleteTemplate(context.companyId, templateId);

    await createAuditLog(context.companyId, {
      action: "template.delete",
      entity_type: "InductionTemplate",
      entity_id: templateId,
      user_id: context.userId,
      details: {
        name: template.name,
        version: template.version,
      },
      request_id: requestId,
    });

    log.info({ templateId }, "Template deleted");
    revalidatePath("/admin/templates");

    return successResponse(undefined, `Template deleted`);
  } catch (error) {
    log.error({ error: String(error) }, "Failed to delete template");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to delete template");
  }
}

// ============================================================================
// QUESTION ACTIONS
// ============================================================================

/**
 * Add a question to a template
 */
export async function addQuestionAction(
  templateId: string,
  input: CreateQuestionInput,
): Promise<ApiResponse<{ questionId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid question data");
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const question = await createQuestion(
      context.companyId,
      templateId,
      parsed.data,
    );

    await createAuditLog(context.companyId, {
      action: "question.create",
      entity_type: "InductionQuestion",
      entity_id: question.id,
      user_id: context.userId,
      details: {
        template_id: templateId,
        question_type: question.question_type,
        display_order: question.display_order,
      },
      request_id: requestId,
    });

    log.info({ questionId: question.id, templateId }, "Question added");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse({ questionId: question.id }, "Question added");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to add question");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to add question");
  }
}

/**
 * Update a question
 */
export async function updateQuestionAction(
  questionId: string,
  input: UpdateQuestionInput,
): Promise<ApiResponse<{ questionId: string }>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = z.string().cuid().safeParse(questionId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { questionId: ["Invalid question ID"] },
      "Invalid question ID",
    );
  }

  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    parsed.error.errors.forEach((e) => {
      const field = e.path.join(".");
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(e.message);
    });
    return validationErrorResponse(fieldErrors, "Invalid question data");
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    const question = await updateQuestion(
      context.companyId,
      questionId,
      parsed.data,
    );

    await createAuditLog(context.companyId, {
      action: "question.update",
      entity_type: "InductionQuestion",
      entity_id: question.id,
      user_id: context.userId,
      details: {
        question_text: parsed.data.question_text,
        question_type: parsed.data.question_type,
        is_required: parsed.data.is_required,
      },
      request_id: requestId,
    });

    log.info({ questionId }, "Question updated");
    revalidatePath(`/admin/templates/${question.template_id}`);

    return successResponse({ questionId }, "Question updated");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to update question");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to update question");
  }
}

/**
 * Delete a question
 */
export async function deleteQuestionAction(
  questionId: string,
): Promise<ApiResponse<void>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = z.string().cuid().safeParse(questionId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { questionId: ["Invalid question ID"] },
      "Invalid question ID",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    await deleteQuestion(context.companyId, questionId);

    await createAuditLog(context.companyId, {
      action: "question.delete",
      entity_type: "InductionQuestion",
      entity_id: questionId,
      user_id: context.userId,
      details: {},
      request_id: requestId,
    });

    log.info({ questionId }, "Question deleted");
    revalidatePath("/admin/templates");

    return successResponse(undefined, "Question deleted");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to delete question");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to delete question");
  }
}

/**
 * Reorder questions within a template
 */
export async function reorderQuestionsAction(
  templateId: string,
  orders: ReorderQuestionsInput[],
): Promise<ApiResponse<void>> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // SECURITY: Verify request origin to prevent CSRF
  try {
    await assertOrigin();
  } catch {
    return errorResponse("FORBIDDEN", "Invalid request origin");
  }

  const idParsed = templateIdSchema.safeParse(templateId);
  if (!idParsed.success) {
    return validationErrorResponse(
      { templateId: idParsed.error.errors.map((e) => e.message) },
      "Invalid template ID",
    );
  }

  const parsed = reorderSchema.safeParse(orders);
  if (!parsed.success) {
    return validationErrorResponse(
      { orders: ["Invalid reorder data"] },
      "Invalid reorder data",
    );
  }

  const guard = await checkAdmin();
  if (!guard.success) {
    return permissionDeniedResponse(guard.error);
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    await reorderQuestions(context.companyId, templateId, parsed.data);

    await createAuditLog(context.companyId, {
      action: "question.reorder",
      entity_type: "InductionTemplate",
      entity_id: templateId,
      user_id: context.userId,
      details: { question_count: orders.length },
      request_id: requestId,
    });

    log.info({ templateId }, "Questions reordered");
    revalidatePath(`/admin/templates/${templateId}`);

    return successResponse(undefined, "Questions reordered");
  } catch (error) {
    log.error({ error: String(error) }, "Failed to reorder questions");
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message);
    }
    return errorResponse("INTERNAL_ERROR", "Failed to reorder questions");
  }
}

// ============================================================================
// READ ACTIONS (for client components)
// ============================================================================

/**
 * Get templates list
 */
export async function getTemplatesAction(
  filter: TemplateFilter = {},
  pagination: PaginationParams = {},
) {
  const context = await requireAuthenticatedContextReadOnly();
  return await listTemplates(context.companyId, filter, pagination);
}

/**
 * Get template with questions
 */
export async function getTemplateAction(templateId: string) {
  const context = await requireAuthenticatedContextReadOnly();
  return await findTemplateWithQuestions(context.companyId, templateId);
}

/**
 * Get questions for a template
 */
export async function getQuestionsAction(templateId: string) {
  const context = await requireAuthenticatedContextReadOnly();
  return await listQuestions(context.companyId, templateId);
}
