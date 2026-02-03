/**
 * Question Repository Unit Tests
 *
 * Unit tests that mock Prisma for fast, isolated testing.
 */

/* eslint-disable no-restricted-imports */
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
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
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
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

// Mock Prisma client
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    inductionTemplate: {
      findFirst: vi.fn(),
    },
    inductionQuestion: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        inductionQuestion: {
          create: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          aggregate: vi.fn(),
          updateMany: vi.fn(),
        },
        inductionTemplate: {
          findFirst: vi.fn(),
        },
      }),
    ),
  },
}));

// Import after mocking
import { prisma } from "@/lib/db/prisma";
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
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
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
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
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
      vi.mocked(prisma.inductionQuestion.findFirst).mockResolvedValue(null);

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

      vi.mocked(prisma.inductionQuestion.findFirst).mockResolvedValue(
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
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        mockEditableTemplate,
      );
      vi.mocked(prisma.inductionQuestion.aggregate).mockResolvedValue({
        _max: { display_order: 0 },
        _avg: { display_order: null },
        _sum: { display_order: null },
        _min: { display_order: null },
        _count: { display_order: 0 },
      });
    });

    it("should accept TEXT question type", async () => {
      const mockQuestion = createMockQuestion({
        id: "q1",
        question_text: "What is your name?",
        question_type: "TEXT",
      });

      vi.mocked(prisma.inductionQuestion.create).mockResolvedValue(
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

      vi.mocked(prisma.inductionQuestion.create).mockResolvedValue(
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

      vi.mocked(prisma.inductionQuestion.create).mockResolvedValue(
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

      vi.mocked(prisma.inductionQuestion.create).mockResolvedValue(
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
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
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
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
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
