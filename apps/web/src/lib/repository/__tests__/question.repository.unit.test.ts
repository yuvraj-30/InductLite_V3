/**
 * Question Repository Unit Tests
 *
 * Unit tests that mock Prisma for fast, isolated testing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositoryError } from "../base";
import type { InductionTemplate, InductionQuestion } from "@prisma/client";

// Helper to create mock template with all required fields
function createMockTemplate(
  overrides: Partial<InductionTemplate> = {},
): InductionTemplate {
  return {
    id: "template-id",
    company_id: "company-id",
    name: "Test",
    description: null,
    version: 1,
    is_published: false,
    is_archived: false,
    is_default: false,
    site_id: null,
    published_at: null,
    force_reinduction: false,
    created_at: new Date(),
    updated_at: new Date(),
    force_reinduction: false, // Added to resolve TS2322
    ...overrides,
  } as unknown as InductionTemplate;
}

// Helper to create mock question with all required fields
function createMockQuestion(
  overrides: Partial<InductionQuestion> = {},
): InductionQuestion {
  return {
    id: "question-1",
    template_id: "template-id",
    question_text: "Test question?",
    question_type: "TEXT",
    is_required: true,
    display_order: 1,
    options: null,
    correct_answer: null,
    logic: null,
    red_flag: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as unknown as InductionQuestion;
}

const templateDelegate = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

const questionDelegate = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("@/lib/db/public-db", () => ({
  publicDb: {
    inductionQuestion: questionDelegate,
    $transaction: vi.fn((callback: (tx: unknown) => unknown) =>
      callback({
        inductionQuestion: questionDelegate,
        inductionTemplate: templateDelegate,
      }),
    ),
  },
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => ({
    inductionTemplate: templateDelegate,
  })),
}));

// Import after mocking
import { publicDb } from "@/lib/db/public-db";
import { scopedDb } from "@/lib/db/scoped-db";
import { createQuestion, findQuestionById } from "../question.repository";

describe("Question Repository Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createQuestion", () => {
    it("should validate question_text is required", async () => {
      await expect(
        createQuestion("company-id", "template-id", {
          question_text: "",
          question_type: "TEXT",
          is_required: true,
        }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should validate question_text max length", async () => {
      const longText = "a".repeat(1001);
      await expect(
        createQuestion("company-id", "template-id", {
          question_text: longText,
          question_type: "TEXT",
          is_required: true,
        }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should reject MULTIPLE_CHOICE without options", async () => {
      // Mock template as editable
      vi.mocked(scopedDb).mockReturnValue({
        inductionTemplate: templateDelegate,
      } as unknown as ReturnType<typeof scopedDb>);
      vi.mocked(templateDelegate.findFirst).mockResolvedValue(
        createMockTemplate(),
      );

      await expect(
        createQuestion("company-id", "template-id", {
          question_text: "Select one:",
          question_type: "MULTIPLE_CHOICE",
          is_required: true,
          options: [],
        }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should reject CHECKBOX without options", async () => {
      vi.mocked(scopedDb).mockReturnValue({
        inductionTemplate: templateDelegate,
      } as unknown as ReturnType<typeof scopedDb>);
      vi.mocked(templateDelegate.findFirst).mockResolvedValue(
        createMockTemplate(),
      );

      await expect(
        createQuestion("company-id", "template-id", {
          question_text: "Select all:",
          question_type: "CHECKBOX",
          is_required: true,
          options: [],
        }),
      ).rejects.toThrow(RepositoryError);
    });
  });

  describe("findQuestionById", () => {
    it("should return null when question not found", async () => {
      vi.mocked(publicDb.inductionQuestion.findFirst).mockResolvedValue(null);

      const result = await findQuestionById("company-id", "non-existent");

      expect(result).toBeNull();
    });

    it("should return question when found", async () => {
      const mockQuestion = {
        ...createMockQuestion({ question_text: "Test question?" }),
        template: {
          company_id: "company-id",
        },
      };

      vi.mocked(publicDb.inductionQuestion.findFirst).mockResolvedValue(
        mockQuestion as InductionQuestion,
      );

      const result = await findQuestionById("company-id", "question-1");

      expect(result).not.toBeNull();
      expect(result!.question_text).toBe("Test question?");
    });
  });

  describe("Question Types", () => {
    const mockEditableTemplate = createMockTemplate();

    beforeEach(() => {
      vi.mocked(scopedDb).mockReturnValue({
        inductionTemplate: templateDelegate,
      } as unknown as ReturnType<typeof scopedDb>);
      vi.mocked(templateDelegate.findFirst).mockResolvedValue(
        mockEditableTemplate,
      );
      vi.mocked(publicDb.inductionQuestion.findFirst).mockResolvedValue({
        display_order: 0,
      } as InductionQuestion);
    });

    it("should accept TEXT question type", async () => {
      const mockQuestion = createMockQuestion({
        id: "q1",
        question_text: "What is your name?",
        question_type: "TEXT",
      });

      vi.mocked(publicDb.inductionQuestion.create).mockResolvedValue(
        mockQuestion,
      );

      const result = await createQuestion("company-id", "template-id", {
        question_text: "What is your name?",
        question_type: "TEXT",
        is_required: true,
      });

      expect(result.question_type).toBe("TEXT");
    });

    it("should accept YES_NO question type", async () => {
      const mockQuestion = createMockQuestion({
        id: "q1",
        question_text: "Have you read the manual?",
        question_type: "YES_NO",
        correct_answer: "yes",
      });

      vi.mocked(publicDb.inductionQuestion.create).mockResolvedValue(
        mockQuestion,
      );

      const result = await createQuestion("company-id", "template-id", {
        question_text: "Have you read the manual?",
        question_type: "YES_NO",
        is_required: true,
        correct_answer: "yes",
      });

      expect(result.question_type).toBe("YES_NO");
    });

    it("should accept ACKNOWLEDGMENT question type", async () => {
      const mockQuestion = createMockQuestion({
        id: "q1",
        question_text: "I understand the safety requirements",
        question_type: "ACKNOWLEDGMENT",
      });

      vi.mocked(publicDb.inductionQuestion.create).mockResolvedValue(
        mockQuestion,
      );

      const result = await createQuestion("company-id", "template-id", {
        question_text: "I understand the safety requirements",
        question_type: "ACKNOWLEDGMENT",
        is_required: true,
      });

      expect(result.question_type).toBe("ACKNOWLEDGMENT");
    });

    it("should accept MULTIPLE_CHOICE with valid options", async () => {
      const mockQuestion = createMockQuestion({
        id: "q1",
        question_text: "Select your role:",
        question_type: "MULTIPLE_CHOICE",
        options: ["Contractor", "Visitor", "Employee"],
      });

      vi.mocked(publicDb.inductionQuestion.create).mockResolvedValue(
        mockQuestion,
      );

      const result = await createQuestion("company-id", "template-id", {
        question_text: "Select your role:",
        question_type: "MULTIPLE_CHOICE",
        is_required: true,
        options: ["Contractor", "Visitor", "Employee"],
      });

      expect(result.question_type).toBe("MULTIPLE_CHOICE");
      expect(result.options).toEqual(["Contractor", "Visitor", "Employee"]);
    });
  });

  describe("Immutability Enforcement", () => {
    it("should reject question creation on published template", async () => {
      vi.mocked(scopedDb).mockReturnValue({
        inductionTemplate: templateDelegate,
      } as unknown as ReturnType<typeof scopedDb>);
      vi.mocked(templateDelegate.findFirst).mockResolvedValue(
        createMockTemplate({
          name: "Published Template",
          is_published: true,
        }),
      );

      await expect(
        createQuestion("company-id", "template-id", {
          question_text: "New Question",
          question_type: "TEXT",
          is_required: true,
        }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should reject question creation on archived template", async () => {
      vi.mocked(scopedDb).mockReturnValue({
        inductionTemplate: templateDelegate,
      } as unknown as ReturnType<typeof scopedDb>);
      vi.mocked(templateDelegate.findFirst).mockResolvedValue(
        createMockTemplate({
          name: "Archived Template",
          is_archived: true,
        }),
      );

      await expect(
        createQuestion("company-id", "template-id", {
          question_text: "New Question",
          question_type: "TEXT",
          is_required: true,
        }),
      ).rejects.toThrow(RepositoryError);
    });
  });
});
