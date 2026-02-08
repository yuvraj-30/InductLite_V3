/**
 * Template Repository Unit Tests
 *
 * Unit tests that mock Prisma for fast, isolated testing.
 * For integration tests with real database, see template.repository.integration.test.ts
 */

/* eslint-disable no-restricted-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RepositoryError } from "../base";
import type { InductionTemplate } from "@prisma/client";
import type {
  TemplateWithQuestions,
  QuestionData,
} from "../template.repository";
// Helper to create mock template with all required fields
function createMockTemplate(
  overrides: Partial<InductionTemplate> = {},
): InductionTemplate {
  return {
    id: "template-1",
    company_id: "company-id",
    name: "Test Template",
    description: null,
    version: 1,
    is_published: false,
    is_archived: false,
    is_default: false,
    site_id: null,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    force_reinduction: false, // Added to resolve TS2322
    ...overrides,
  };
}

// Helper to create a template object that includes questions for tests
function createMockTemplateWithQuestions(
  overrides: Partial<TemplateWithQuestions> & {
    questions?: any[];
  } = {},
): TemplateWithQuestions {
  const defaultQuestion: QuestionData = {
    id: "q1",
    template_id: overrides.id ?? "template-1",
    question_text: "Q",
    question_type: "TEXT",
    options: null,
    is_required: true,
    display_order: 1,
    correct_answer: null,
    created_at: new Date(),
    updated_at: new Date(),
    logic: null, // Added based on InductionQuestion schema
  };

  const questions = (overrides.questions ?? [defaultQuestion]).map((q, i) => ({
    ...defaultQuestion,
    ...q,
    template_id:
      (q as Partial<QuestionData>)?.template_id ?? overrides.id ?? "template-1",
    display_order: (q as Partial<QuestionData>)?.display_order ?? i + 1,
  }));

  return {
    id: "template-1",
    company_id: "company-id",
    name: "Test Template",
    description: null,
    version: 1,
    is_published: false,
    is_archived: false,
    is_default: false,
    site_id: null,
    published_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    force_reinduction: false, // Added to resolve TS2345
    site: { id: "site-1", name: "Site" },
    questions,
    ...overrides,
  };
}

// Mock Prisma client
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    inductionTemplate: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    inductionQuestion: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((callback) =>
      callback({
        inductionTemplate: {
          create: vi.fn(),
          findFirst: vi.fn(),
          findUnique: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
          delete: vi.fn(),
        },
        inductionQuestion: {
          findMany: vi.fn(),
          createMany: vi.fn(),
        },
      }),
    ),
  },
}));

// Import after mocking
import { prisma } from "@/lib/db/prisma";
import {
  createTemplate,
  findTemplateById,
  updateTemplate,
} from "../template.repository";

describe("Template Repository Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("should validate name is required", async () => {
      await expect(createTemplate("company-id", { name: "" })).rejects.toThrow(
        RepositoryError,
      );
    });

    it("should validate name max length", async () => {
      const longName = "a".repeat(101);
      await expect(
        createTemplate("company-id", { name: longName }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should call prisma.create with correct data", async () => {
      const mockTemplate = createMockTemplate({
        name: "Test Template",
        description: "Test description",
      });

      // Mock findFirst to return null (no existing template)
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.inductionTemplate.create).mockResolvedValue(
        mockTemplate,
      );

      const result = await createTemplate("company-id", {
        name: "Test Template",
        description: "Test description",
      });

      expect(prisma.inductionTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Test Template",
            description: "Test description",
            company_id: "company-id",
            version: 1,
            is_published: false,
            is_archived: false,
          }),
        }),
      );

      expect(result.name).toBe("Test Template");
    });
  });

  describe("findTemplateById", () => {
    it("should return null when template not found", async () => {
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(null);

      const result = await findTemplateById("company-id", "non-existent");

      expect(result).toBeNull();
    });

    it("should return template with questions when found", async () => {
      const mockTemplate = {
        ...createMockTemplate({ name: "Test Template" }),
        site: null,
        questions: [
          {
            id: "q1",
            template_id: "template-1",
            question_text: "Test question?",
            question_type: "TEXT" as const,
            is_required: true,
            display_order: 1,
            options: null,
            correct_answer: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        _count: {
          questions: 1,
          responses: 0,
        },
      };

      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        mockTemplate as unknown as InductionTemplate,
      );

      const result = await findTemplateById("company-id", "template-1");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("Test Template");
    });
  });

  describe("updateTemplate", () => {
    it("should reject update on archived template", async () => {
      const mockTemplate = createMockTemplate({
        name: "Archived Template",
        is_archived: true,
      });

      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        mockTemplate,
      );

      await expect(
        updateTemplate("company-id", "template-1", { name: "New Name" }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should reject update on published template", async () => {
      const mockTemplate = createMockTemplate({
        name: "Published Template",
        is_published: true,
      });

      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        mockTemplate,
      );

      await expect(
        updateTemplate("company-id", "template-1", { name: "New Name" }),
      ).rejects.toThrow(RepositoryError);
    });

    it("should update template when editable", async () => {
      const updatedTemplate = createMockTemplate({
        name: "Updated Name",
        description: "New description",
      });

      // updateMany returns count, then findFirst returns the updated template
      vi.mocked(prisma.inductionTemplate.updateMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        updatedTemplate,
      );

      const result = await updateTemplate("company-id", "template-1", {
        name: "Updated Name",
        description: "New description",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.description).toBe("New description");
    });

    it("should reject publish when template not found", async () => {
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(null);
      await expect(
        (await import("../template.repository")).publishTemplate(
          "company-id",
          "t1",
        ),
      ).rejects.toThrow(RepositoryError);
    });

    it("should reject publish when archived/published/no-questions", async () => {
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        createMockTemplateWithQuestions({ is_archived: true, questions: [] }),
      );
      await expect(
        (await import("../template.repository")).publishTemplate(
          "company-id",
          "t1",
        ),
      ).rejects.toThrow(RepositoryError);

      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        createMockTemplateWithQuestions({
          is_published: true,
          questions: [
            {
              id: "q1",
              template_id: "template-1",
              question_text: "Q",
              question_type: "TEXT",
              options: null,
              is_required: true,
              display_order: 1,
              correct_answer: null,
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        }),
      );
      await expect(
        (await import("../template.repository")).publishTemplate(
          "company-id",
          "t1",
        ),
      ).rejects.toThrow(RepositoryError);

      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        createMockTemplateWithQuestions({
          is_published: false,
          is_archived: false,
          questions: [],
        }),
      );
      await expect(
        (await import("../template.repository")).publishTemplate(
          "company-id",
          "t1",
        ),
      ).rejects.toThrow(RepositoryError);
    });

    it("should publish a template via transaction and return updated template", async () => {
      const mockTemplate = createMockTemplateWithQuestions({
        name: "T",
        site_id: null,
        questions: [
          {
            id: "q1",
            template_id: "template-1",
            question_text: "Q",
            question_type: "TEXT",
            options: null,
            is_required: true,
            display_order: 1,
            correct_answer: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        mockTemplate,
      );

      const updatedTemplate = {
        ...mockTemplate,
        is_published: true,
        published_at: new Date(),
      };

      vi.mocked(prisma.$transaction).mockImplementation(
        async (
          cb: (tx: import("@prisma/client").Prisma.TransactionClient) => any,
        ) => {
          const tx = {
            inductionTemplate: {
              updateMany: vi.fn().mockResolvedValue({}),
              update: vi.fn().mockResolvedValue(updatedTemplate),
              findFirst: vi.fn().mockResolvedValue(updatedTemplate),
            },
          } as unknown as import("@prisma/client").Prisma.TransactionClient;
          return cb(tx);
        },
      );

      const result = await (
        await import("../template.repository")
      ).publishTemplate("company-id", "template-1");

      expect(result.is_published).toBe(true);
      expect(result.published_at).not.toBeNull();
    });

    it("should create a new version copying questions", async () => {
      const source = createMockTemplateWithQuestions({
        name: "Source",
        site_id: null,
        questions: [
          {
            id: "q1",
            template_id: "template-1",
            question_text: "Q",
            display_order: 1,
            question_type: "TEXT",
            is_required: true,
            options: null,
            correct_answer: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      });
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValueOnce(
        source,
      );
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValueOnce(
        createMockTemplate({ version: 1 }),
      );

      const newTemplate = {
        ...source,
        id: "new",
        version: 2,
        questions: source.questions,
      };

      vi.mocked(prisma.$transaction).mockImplementation(
        async (
          cb: (tx: import("@prisma/client").Prisma.TransactionClient) => any,
        ) => {
          const tx = {
            inductionTemplate: {
              create: vi.fn().mockResolvedValue(newTemplate),
              findFirst: vi.fn().mockResolvedValue(newTemplate),
              findFirstOrThrow: vi.fn().mockResolvedValue(newTemplate),
            },
            inductionQuestion: { createMany: vi.fn().mockResolvedValue({}) },
          } as unknown as import("@prisma/client").Prisma.TransactionClient;
          return cb(tx);
        },
      );

      const result = await (
        await import("../template.repository")
      ).createNewVersion("company-id", "template-1");

      expect(result.version).toBe(2);
      expect(result.questions.length).toBeGreaterThan(0);
    });

    it("should archive and unarchive correctly", async () => {
      // Archive
      vi.mocked(prisma.inductionTemplate.updateMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        createMockTemplate(),
      );
      const archived = await (
        await import("../template.repository")
      ).archiveTemplate("company-id", "template-1");
      expect(archived).not.toBeNull();

      // Unarchive
      vi.mocked(prisma.inductionTemplate.updateMany).mockResolvedValue({
        count: 1,
      });
      vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(
        createMockTemplate({ is_archived: false }),
      );
      const unarchived = await (
        await import("../template.repository")
      ).unarchiveTemplate("company-id", "template-1");
      expect(unarchived).not.toBeNull();
    });
  });
});

describe("Validation Rules", () => {
  it("should require company_id", async () => {
    await expect(createTemplate("", { name: "Test" })).rejects.toThrow(
      RepositoryError,
    );
  });

  it("should trim whitespace from name", async () => {
    const mockTemplate = createMockTemplate({ name: "Trimmed Name" });

    // Mock findFirst to return null (no existing template)
    vi.mocked(prisma.inductionTemplate.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.inductionTemplate.create).mockResolvedValue(mockTemplate);

    await createTemplate("company-id", { name: "  Trimmed Name  " });

    expect(prisma.inductionTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Trimmed Name",
        }),
      }),
    );
  });
});
