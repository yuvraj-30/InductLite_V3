import { describe, it, expect, vi, beforeEach } from "vitest";
import { publishTemplate } from "../template.repository";
import { scopedDb } from "../../db/scoped-db";

vi.mock("../../db/scoped-db", () => ({
  scopedDb: vi.fn(),
}));

vi.mock("../base", () => ({
  requireCompanyId: vi.fn(),
  handlePrismaError: vi.fn(),
  RepositoryError: class extends Error {
    constructor(
      message: string,
      public code: string,
    ) {
      super(message);
    }
  },
}));

vi.mock("../../db/public-db", () => ({
  publicDb: {
    $transaction: vi.fn((callback) =>
      callback({
        // Provide the minimal transaction API used by publishTemplate
        inductionResponse: { updateMany: vi.fn(), deleteMany: vi.fn() },
        inductionTemplate: { updateMany: vi.fn() },
      }),
    ),
  },
}));

describe("Template Versioning Logic", () => {
  const companyId = "c1";
  const templateId = "t1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set force_reinduction flag when publishing", async () => {
    const mockTemplate = {
      id: templateId,
      name: "Test",
      questions: [{ id: "q1" }],
    };

    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mockFindFirst = vi
      .fn()
      .mockResolvedValue({ ...mockTemplate, is_published: false });

    vi.mocked(scopedDb).mockReturnValue({
      inductionTemplate: {
        findFirst: mockFindFirst,
        updateMany: mockUpdateMany,
      },
    } as any);

    await publishTemplate(companyId, templateId, true);

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ force_reinduction: true }),
      }),
    );
  });
});
