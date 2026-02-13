/**
 * Induction Question Repository
 *
 * Handles question CRUD for induction templates.
 *
 * BUSINESS RULES:
 * - Questions can only be modified on non-archived, non-published templates
 * - display_order must be maintained and reordered when questions are added/removed
 * - Questions are cascaded when template is deleted
 */

import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { Prisma } from "@prisma/client";
import { requireCompanyId, handlePrismaError, RepositoryError } from "./base";

type JsonValue = Prisma.JsonValue;

// ============================================================================
// TYPES
// ============================================================================

export type QuestionType =
  | "TEXT"
  | "MULTIPLE_CHOICE"
  | "CHECKBOX"
  | "YES_NO"
  | "ACKNOWLEDGMENT";

/**
 * Question data structure
 */
export interface Question {
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

/**
 * Input for creating a question
 */
export interface CreateQuestionInput {
  question_text: string;
  question_type: QuestionType;
  options?: string[]; // For MULTIPLE_CHOICE, CHECKBOX
  is_required?: boolean;
  display_order?: number; // If not provided, appended at end
  correct_answer?: unknown;
  logic?: unknown;
}

/**
 * Input for updating a question
 */
export interface UpdateQuestionInput {
  question_text?: string;
  question_type?: QuestionType;
  options?: string[] | null;
  is_required?: boolean;
  correct_answer?: unknown | null;
  logic?: unknown | null;
}

/**
 * Input for reordering questions
 */
export interface ReorderQuestionsInput {
  questionId: string;
  newOrder: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify template is editable (not archived, not published)
 */
async function verifyTemplateEditable(
  companyId: string,
  templateId: string,
): Promise<void> {
  const db = scopedDb(companyId);
  const template = await db.inductionTemplate.findFirst({
    where: { id: templateId, company_id: companyId },
    select: { is_archived: true, is_published: true },
  });

  if (!template) {
    throw new RepositoryError("Template not found", "NOT_FOUND");
  }

  if (template.is_archived) {
    throw new RepositoryError(
      "Cannot modify questions on archived template. Create a new version first.",
      "VALIDATION",
    );
  }

  if (template.is_published) {
    throw new RepositoryError(
      "Cannot modify questions on published template. Create a new version first.",
      "VALIDATION",
    );
  }
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Find question by ID
 */
export async function findQuestionById(
  companyId: string,
  questionId: string,
): Promise<Question | null> {
  requireCompanyId(companyId);

  try {
    const question = await publicDb.inductionQuestion.findFirst({
      where: {
        id: questionId,
        template: { company_id: companyId },
      },
    });

    if (!question) return null;

    return question as Question;
  } catch (error) {
    handlePrismaError(error, "InductionQuestion");
  }
}

/**
 * List questions for a template (ordered by display_order)
 */
export async function listQuestions(
  companyId: string,
  templateId: string,
): Promise<Question[]> {
  requireCompanyId(companyId);

  // Verify template belongs to company
  const db = scopedDb(companyId);
  const template = await db.inductionTemplate.findFirst({
    where: { id: templateId, company_id: companyId },
    select: { id: true },
  });

  if (!template) {
    throw new RepositoryError("Template not found", "NOT_FOUND");
  }

  try {
    const questions = await publicDb.inductionQuestion.findMany({
      where: { template_id: templateId },
      orderBy: { display_order: "asc" },
    });

    return questions as Question[];
  } catch (error) {
    handlePrismaError(error, "InductionQuestion");
  }
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new question
 */
export async function createQuestion(
  companyId: string,
  templateId: string,
  input: CreateQuestionInput,
): Promise<Question> {
  requireCompanyId(companyId);

  await verifyTemplateEditable(companyId, templateId);

  // Validate options for question types that need them
  if (
    (input.question_type === "MULTIPLE_CHOICE" ||
      input.question_type === "CHECKBOX") &&
    (!input.options || input.options.length < 2)
  ) {
    throw new RepositoryError(
      "Multiple choice and checkbox questions require at least 2 options",
      "VALIDATION",
    );
  }

  try {
    const question = await publicDb.$transaction(async (tx) => {
      let displayOrder = input.display_order;
      if (displayOrder === undefined) {
        const maxOrder = await tx.inductionQuestion.findFirst({
          where: { template_id: templateId },
          orderBy: { display_order: "desc" },
          select: { display_order: true },
        });
        displayOrder = (maxOrder?.display_order ?? 0) + 1;
      }

      return tx.inductionQuestion.create({
        data: {
          template_id: templateId,
          question_text: input.question_text,
          question_type: input.question_type,
          options: input.options ?? Prisma.JsonNull,
          is_required: input.is_required ?? true,
          display_order: displayOrder,
          correct_answer:
            (input.correct_answer as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          logic: (input.logic as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        } as unknown as Prisma.InductionQuestionCreateInput,
      });
    });

    return question as Question;
  } catch (error) {
    handlePrismaError(error, "InductionQuestion");
  }
}

/**
 * Update a question
 *
 * SECURITY: Uses transaction to prevent TOCTOU attacks.
 * The template verification and question update happen atomically.
 */
export async function updateQuestion(
  companyId: string,
  questionId: string,
  input: UpdateQuestionInput,
): Promise<Question> {
  requireCompanyId(companyId);

  // Validate options upfront before starting transaction
  const newType = input.question_type;
  if (
    (newType === "MULTIPLE_CHOICE" || newType === "CHECKBOX") &&
    input.options !== undefined &&
    (!input.options || input.options.length < 2)
  ) {
    throw new RepositoryError(
      "Multiple choice and checkbox questions require at least 2 options",
      "VALIDATION",
    );
  }

  try {
    return await publicDb.$transaction(async (tx) => {
      // Find question with template info - atomic within transaction
      const question = await tx.inductionQuestion.findFirst({
        where: {
          id: questionId,
          template: { company_id: companyId },
        },
        include: {
          template: {
            select: { is_archived: true, is_published: true },
          },
        },
      });

      if (!question) {
        throw new RepositoryError("Question not found", "NOT_FOUND");
      }

      // Verify template is editable (not archived, not published)
      if (question.template.is_archived) {
        throw new RepositoryError(
          "Cannot modify questions on archived template. Create a new version first.",
          "VALIDATION",
        );
      }

      if (question.template.is_published) {
        throw new RepositoryError(
          "Cannot modify questions on published template. Create a new version first.",
          "VALIDATION",
        );
      }

      // Update within same transaction - template verified
      const updatedResult = await tx.inductionQuestion.updateMany({
        where: { id: questionId, template_id: question.template_id },
        data: {
          question_text: input.question_text,
          question_type: input.question_type,
          options:
            input.options === null
              ? Prisma.JsonNull
              : input.options !== undefined
                ? input.options
                : undefined,
          is_required: input.is_required,
          correct_answer:
            input.correct_answer === null
              ? Prisma.JsonNull
              : input.correct_answer !== undefined
                ? (input.correct_answer as Prisma.InputJsonValue)
                : undefined,
          logic:
            input.logic === null
              ? Prisma.JsonNull
              : input.logic !== undefined
                ? (input.logic as Prisma.InputJsonValue)
                : undefined,
        } as unknown as Prisma.InductionQuestionUpdateManyMutationInput,
      });

      if (updatedResult.count === 0) {
        throw new RepositoryError("Question not found", "NOT_FOUND");
      }

      const updated = await tx.inductionQuestion.findFirst({
        where: { id: questionId, template_id: question.template_id },
      });

      if (!updated) {
        throw new RepositoryError("Question not found", "NOT_FOUND");
      }

      return updated as Question;
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionQuestion");
  }
}

/**
 * Delete a question and reorder remaining
 *
 * SECURITY: Uses transaction to prevent TOCTOU attacks.
 * The template verification and question deletion happen atomically.
 */
export async function deleteQuestion(
  companyId: string,
  questionId: string,
): Promise<void> {
  requireCompanyId(companyId);

  try {
    await publicDb.$transaction(async (tx) => {
      // Find question with template info - atomic within transaction
      const question = await tx.inductionQuestion.findFirst({
        where: {
          id: questionId,
          template: { company_id: companyId },
        },
        include: {
          template: {
            select: { is_archived: true, is_published: true },
          },
        },
      });

      if (!question) {
        throw new RepositoryError("Question not found", "NOT_FOUND");
      }

      // Verify template is editable (not archived, not published)
      if (question.template.is_archived) {
        throw new RepositoryError(
          "Cannot modify questions on archived template. Create a new version first.",
          "VALIDATION",
        );
      }

      if (question.template.is_published) {
        throw new RepositoryError(
          "Cannot modify questions on published template. Create a new version first.",
          "VALIDATION",
        );
      }

      // Delete within same transaction - template verified
      await tx.inductionQuestion.deleteMany({
        where: { id: questionId, template_id: question.template_id },
      });

      // Reorder remaining questions
      await tx.inductionQuestion.updateMany({
        where: {
          template_id: question.template_id,
          display_order: { gt: question.display_order },
        },
        data: {
          display_order: { decrement: 1 },
        },
      });
    });
  } catch (error) {
    if (error instanceof RepositoryError) {
      throw error;
    }
    handlePrismaError(error, "InductionQuestion");
  }
}

/**
 * Reorder questions within a template
 */
export async function reorderQuestions(
  companyId: string,
  templateId: string,
  questionOrders: ReorderQuestionsInput[],
): Promise<Question[]> {
  requireCompanyId(companyId);

  // Perform verification and updates inside a single transaction to prevent TOCTOU
  const result = await publicDb.$transaction(async (tx) => {
    // Verify template is editable within transaction
    const t = await tx.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      select: { is_archived: true, is_published: true },
    });

    if (!t) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    if (t.is_archived) {
      throw new RepositoryError(
        "Cannot modify questions on archived template. Create a new version first.",
        "VALIDATION",
      );
    }

    if (t.is_published) {
      throw new RepositoryError(
        "Cannot modify questions on published template. Create a new version first.",
        "VALIDATION",
      );
    }

    // Validate all questions belong to this template
    const questions = await tx.inductionQuestion.findMany({
      where: { template_id: templateId },
      select: { id: true },
    });

    const validIds = new Set(questions.map((q) => q.id));
    for (const order of questionOrders) {
      if (!validIds.has(order.questionId)) {
        throw new RepositoryError(
          `Question ${order.questionId} does not belong to this template`,
          "VALIDATION",
        );
      }
    }

    // Apply updates atomically
    await Promise.all(
      questionOrders.map((order) =>
        tx.inductionQuestion.updateMany({
          where: { id: order.questionId, template_id: templateId },
          data: { display_order: order.newOrder },
        }),
      ),
    );

    // Return updated questions from transaction for consistency
    return (await tx.inductionQuestion.findMany({
      where: { template_id: templateId },
      orderBy: { display_order: "asc" },
    })) as Question[];
  });

  return result;
}

/**
 * Bulk create questions (for copying templates)
 */
export async function bulkCreateQuestions(
  companyId: string,
  templateId: string,
  questions: CreateQuestionInput[],
): Promise<Question[]> {
  requireCompanyId(companyId);

  // Perform verification and creation inside a transaction to prevent TOCTOU
  const created = await publicDb.$transaction(async (tx) => {
    const template = await tx.inductionTemplate.findFirst({
      where: { id: templateId, company_id: companyId },
      select: { is_archived: true, is_published: true },
    });

    if (!template) {
      throw new RepositoryError("Template not found", "NOT_FOUND");
    }

    if (template.is_archived) {
      throw new RepositoryError(
        "Cannot modify questions on archived template. Create a new version first.",
        "VALIDATION",
      );
    }

    if (template.is_published) {
      throw new RepositoryError(
        "Cannot modify questions on published template. Create a new version first.",
        "VALIDATION",
      );
    }

    await tx.inductionQuestion.createMany({
      data: questions.map((q, index) => ({
        template_id: templateId,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options ?? Prisma.JsonNull,
        is_required: q.is_required ?? true,
        display_order: q.display_order ?? index + 1,
        correct_answer: q.correct_answer ?? Prisma.JsonNull,
        logic: q.logic ?? Prisma.JsonNull,
      })),
    });

    return (await tx.inductionQuestion.findMany({
      where: { template_id: templateId },
      orderBy: { display_order: "asc" },
    })) as Question[];
  });

  return created;
}
