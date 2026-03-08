import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SafetyFormSubmission, SafetyFormTemplate } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  scopedDb: vi.fn(),
  templateCreate: vi.fn(),
  templateFindFirst: vi.fn(),
  templateFindMany: vi.fn(),
  templateUpdateMany: vi.fn(),
  submissionCreate: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  submissionUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: mocks.scopedDb,
}));

import {
  createSafetyFormSubmission,
  createSafetyFormTemplate,
  deactivateSafetyFormTemplate,
  installDefaultSafetyFormTemplates,
  listSafetyFormTemplates,
  reviewSafetyFormSubmission,
} from "../safety-form.repository";
import { DEFAULT_SAFETY_FORM_TEMPLATES } from "@/lib/safety-forms/defaults";

function mockTemplate(overrides: Partial<SafetyFormTemplate> = {}): SafetyFormTemplate {
  return {
    id: "tmpl-1",
    company_id: "company-1",
    site_id: "site-1",
    name: "SWMS Template",
    form_type: "SWMS",
    description: null,
    field_schema: { version: 1 },
    is_active: true,
    created_by: "user-1",
    created_at: new Date("2026-03-08T00:00:00.000Z"),
    updated_at: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

function mockSubmission(overrides: Partial<SafetyFormSubmission> = {}): SafetyFormSubmission {
  return {
    id: "sub-1",
    company_id: "company-1",
    site_id: "site-1",
    template_id: "tmpl-1",
    sign_in_record_id: null,
    submitted_by_name: "Worker One",
    submitted_by_email: null,
    submitted_by_phone: null,
    payload: { answers: [] },
    summary: null,
    status: "SUBMITTED",
    submitted_at: new Date("2026-03-08T00:00:00.000Z"),
    reviewed_at: null,
    reviewed_by: null,
    review_notes: null,
    created_at: new Date("2026-03-08T00:00:00.000Z"),
    updated_at: new Date("2026-03-08T00:00:00.000Z"),
    ...overrides,
  };
}

describe("safety-form.repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.scopedDb.mockReturnValue({
      safetyFormTemplate: {
        create: mocks.templateCreate,
        findFirst: mocks.templateFindFirst,
        findMany: mocks.templateFindMany,
        updateMany: mocks.templateUpdateMany,
      },
      safetyFormSubmission: {
        create: mocks.submissionCreate,
        findFirst: mocks.submissionFindFirst,
        findMany: mocks.submissionFindMany,
        updateMany: mocks.submissionUpdateMany,
      },
    });
  });

  it("returns existing template when duplicate exists", async () => {
    mocks.templateFindFirst.mockResolvedValue(mockTemplate({ id: "tmpl-existing" }));

    const result = await createSafetyFormTemplate("company-1", {
      site_id: "site-1",
      form_type: "SWMS",
      name: "SWMS Template",
      field_schema: { version: 1 },
    });

    expect(result.id).toBe("tmpl-existing");
    expect(mocks.templateCreate).not.toHaveBeenCalled();
  });

  it("creates a new template and normalizes optional values", async () => {
    mocks.templateFindFirst.mockResolvedValueOnce(null);
    mocks.templateCreate.mockResolvedValue(
      mockTemplate({
        id: "tmpl-new",
        site_id: null,
        name: "New SWMS",
        description: "Desc",
      }),
    );

    const result = await createSafetyFormTemplate("company-1", {
      site_id: "   ",
      form_type: "SWMS",
      name: "  New SWMS  ",
      description: "  Desc  ",
      field_schema: { sections: [] },
      created_by: " user-1 ",
    });

    expect(result.id).toBe("tmpl-new");
    expect(mocks.templateCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        site_id: null,
        form_type: "SWMS",
        name: "New SWMS",
        description: "Desc",
        created_by: "user-1",
      }),
    });
  });

  it("rejects submission when template is unavailable for site", async () => {
    mocks.templateFindFirst.mockResolvedValue(null);

    await expect(
      createSafetyFormSubmission("company-1", {
        site_id: "site-1",
        template_id: "tmpl-missing",
        submitted_by_name: "Worker One",
        payload: { answers: [] },
      }),
    ).rejects.toThrow(/not available/i);

    expect(mocks.submissionCreate).not.toHaveBeenCalled();
  });

  it("creates submission when template is active", async () => {
    mocks.templateFindFirst.mockResolvedValue(mockTemplate());
    mocks.submissionCreate.mockResolvedValue(mockSubmission());

    const result = await createSafetyFormSubmission("company-1", {
      site_id: "site-1",
      template_id: "tmpl-1",
      submitted_by_name: "Worker One",
      payload: { checklist: [{ key: "ppe", value: true }] },
    });

    expect(result.id).toBe("sub-1");
    expect(mocks.submissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "site-1",
          template_id: "tmpl-1",
          submitted_by_name: "Worker One",
        }),
      }),
    );
  });

  it("updates review status for submission", async () => {
    mocks.submissionUpdateMany.mockResolvedValue({ count: 1 });
    mocks.submissionFindFirst.mockResolvedValue(
      mockSubmission({ status: "REVIEWED", reviewed_by: "user-1" }),
    );

    const result = await reviewSafetyFormSubmission("company-1", {
      submission_id: "sub-1",
      status: "REVIEWED",
      reviewed_by: "user-1",
      review_notes: "Looks good",
    });

    expect(result.status).toBe("REVIEWED");
    expect(mocks.submissionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEWED", reviewed_by: "user-1" }),
      }),
    );
  });

  it("throws not found when review target does not exist", async () => {
    mocks.submissionUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      reviewSafetyFormSubmission("company-1", {
        submission_id: "sub-missing",
        status: "REVIEWED",
      }),
    ).rejects.toThrow(/not found/i);

    expect(mocks.submissionFindFirst).not.toHaveBeenCalled();
  });

  it("installs full default pack when none exist", async () => {
    mocks.templateFindMany.mockResolvedValue([]);
    mocks.templateFindFirst.mockResolvedValue(null);
    mocks.templateCreate.mockResolvedValue(mockTemplate());

    const result = await installDefaultSafetyFormTemplates("company-1", {
      site_id: "site-1",
      created_by: "user-1",
    });

    expect(result).toEqual({
      created: DEFAULT_SAFETY_FORM_TEMPLATES.length,
      skipped: 0,
    });
    expect(mocks.templateCreate).toHaveBeenCalledTimes(
      DEFAULT_SAFETY_FORM_TEMPLATES.length,
    );
  });

  it("skips default templates already installed", async () => {
    mocks.templateFindMany.mockImplementation(async (args: Record<string, unknown>) => {
      const where = (args.where ?? {}) as { form_type?: string };
      const template = DEFAULT_SAFETY_FORM_TEMPLATES.find(
        (candidate) => candidate.formType === where.form_type,
      );
      if (!template) return [];
      return [
        mockTemplate({
          id: `tmpl-${template.formType.toLowerCase()}`,
          name: template.name,
          form_type: template.formType,
          site_id: "site-1",
        }),
      ];
    });

    const result = await installDefaultSafetyFormTemplates("company-1", {
      site_id: "site-1",
      created_by: "user-1",
    });

    expect(result).toEqual({
      created: 0,
      skipped: DEFAULT_SAFETY_FORM_TEMPLATES.length,
    });
    expect(mocks.templateCreate).not.toHaveBeenCalled();
  });

  it("lists templates with active filter by default", async () => {
    mocks.templateFindMany.mockResolvedValue([mockTemplate()]);

    await listSafetyFormTemplates("company-1", { site_id: "site-1" });

    expect(mocks.templateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          company_id: "company-1",
          is_active: true,
        }),
      }),
    );
  });

  it("throws not found when deactivating unknown template", async () => {
    mocks.templateUpdateMany.mockResolvedValue({ count: 0 });

    await expect(
      deactivateSafetyFormTemplate("company-1", "tmpl-missing"),
    ).rejects.toThrow(/not found/i);
  });
});
