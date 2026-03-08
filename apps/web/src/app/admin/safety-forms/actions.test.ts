import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`REDIRECT:${url}`) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
  revalidatePath: vi.fn(),
  assertOrigin: vi.fn(),
  checkSitePermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  createAuditLog: vi.fn(),
  installDefaultSafetyFormTemplates: vi.fn(),
  createSafetyFormTemplate: vi.fn(),
  deactivateSafetyFormTemplate: vi.fn(),
  createSafetyFormSubmission: vi.fn(),
  reviewSafetyFormSubmission: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkSitePermission: mocks.checkSitePermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/repository/safety-form.repository", () => ({
  installDefaultSafetyFormTemplates: mocks.installDefaultSafetyFormTemplates,
  createSafetyFormTemplate: mocks.createSafetyFormTemplate,
  deactivateSafetyFormTemplate: mocks.deactivateSafetyFormTemplate,
  createSafetyFormSubmission: mocks.createSafetyFormSubmission,
  reviewSafetyFormSubmission: mocks.reviewSafetyFormSubmission,
}));

import {
  createSafetyFormTemplateAction,
  deactivateSafetyFormTemplateAction,
  installSafetyFormDefaultsAction,
  reviewSafetyFormSubmissionAction,
  submitSafetyFormAction,
} from "./actions";

const SITE_ID = "cm0000000000000000000001";
const TEMPLATE_ID = "cm0000000000000000000101";
const SUBMISSION_ID = "cm0000000000000000000201";

describe("admin safety form actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkSitePermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
      role: "ADMIN",
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.installDefaultSafetyFormTemplates.mockResolvedValue({
      created: 5,
      skipped: 0,
    });
    mocks.createSafetyFormTemplate.mockResolvedValue({
      id: TEMPLATE_ID,
      site_id: SITE_ID,
      form_type: "SWMS",
      name: "Site SWMS",
    });
    mocks.deactivateSafetyFormTemplate.mockResolvedValue({
      id: TEMPLATE_ID,
      site_id: SITE_ID,
      form_type: "SWMS",
      name: "Site SWMS",
    });
    mocks.createSafetyFormSubmission.mockResolvedValue({
      id: SUBMISSION_ID,
      site_id: SITE_ID,
      template_id: TEMPLATE_ID,
      status: "SUBMITTED",
    });
    mocks.reviewSafetyFormSubmission.mockResolvedValue({
      id: SUBMISSION_ID,
      site_id: SITE_ID,
      status: "REVIEWED",
    });
  });

  it("creates a template and redirects success", async () => {
    const formData = new FormData();
    formData.set("siteId", SITE_ID);
    formData.set("formType", "SWMS");
    formData.set("name", "Site SWMS");
    formData.set("description", "Daily review");
    formData.set("fieldSchemaJson", '{"sections":[{"id":"ppe"}]}');

    await expect(createSafetyFormTemplateAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/safety-forms?status=success&message=Safety+form+template+saved",
    );

    expect(mocks.createSafetyFormTemplate).toHaveBeenCalledWith("company-1", {
      site_id: SITE_ID,
      form_type: "SWMS",
      name: "Site SWMS",
      description: "Daily review",
      field_schema: { sections: [{ id: "ppe" }] },
      created_by: "user-1",
      is_active: true,
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "safety_form.template.create",
        entity_id: TEMPLATE_ID,
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/safety-forms");
  });

  it("redirects with error when template JSON is invalid", async () => {
    const formData = new FormData();
    formData.set("siteId", SITE_ID);
    formData.set("formType", "SWMS");
    formData.set("name", "Site SWMS");
    formData.set("description", "Daily review");
    formData.set("fieldSchemaJson", "{bad");

    await expect(createSafetyFormTemplateAction(formData)).rejects.toThrow(
      /REDIRECT:\/admin\/safety-forms\?status=error&message=/,
    );
    expect(mocks.createSafetyFormTemplate).not.toHaveBeenCalled();
  });

  it("rejects global default install for non-admin users", async () => {
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-2",
      role: "SITE_MANAGER",
    });

    await expect(installSafetyFormDefaultsAction(new FormData())).rejects.toThrow(
      "REDIRECT:/admin/safety-forms?status=error&message=Only+admins+can+create+global+safety+templates",
    );
    expect(mocks.installDefaultSafetyFormTemplates).not.toHaveBeenCalled();
  });

  it("deactivates a template and redirects success", async () => {
    const formData = new FormData();
    formData.set("templateId", TEMPLATE_ID);
    formData.set("siteId", SITE_ID);

    await expect(deactivateSafetyFormTemplateAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/safety-forms?status=success&message=Template+deactivated",
    );
    expect(mocks.deactivateSafetyFormTemplate).toHaveBeenCalledWith(
      "company-1",
      TEMPLATE_ID,
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "safety_form.template.deactivate",
        entity_id: TEMPLATE_ID,
      }),
    );
  });

  it("submits a safety form and writes audit log", async () => {
    const formData = new FormData();
    formData.set("siteId", SITE_ID);
    formData.set("templateId", TEMPLATE_ID);
    formData.set("submittedByName", "Worker One");
    formData.set("submittedByEmail", "worker@example.test");
    formData.set("submittedByPhone", "+64211234567");
    formData.set("summary", "All checks complete");
    formData.set("payloadJson", '{"checklist":[{"item":"PPE","value":true}]}');

    await expect(submitSafetyFormAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/safety-forms?status=success&message=Safety+form+submission+recorded",
    );
    expect(mocks.createSafetyFormSubmission).toHaveBeenCalledWith("company-1", {
      site_id: SITE_ID,
      template_id: TEMPLATE_ID,
      submitted_by_name: "Worker One",
      submitted_by_email: "worker@example.test",
      submitted_by_phone: "+64211234567",
      summary: "All checks complete",
      payload: { checklist: [{ item: "PPE", value: true }] },
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "safety_form.submission.create",
        entity_id: SUBMISSION_ID,
      }),
    );
  });

  it("reviews a submitted form and redirects success", async () => {
    const formData = new FormData();
    formData.set("submissionId", SUBMISSION_ID);
    formData.set("siteId", SITE_ID);
    formData.set("status", "REVIEWED");
    formData.set("notes", "Reviewed and approved.");

    await expect(reviewSafetyFormSubmissionAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/safety-forms?status=success&message=Submission+review+saved",
    );
    expect(mocks.reviewSafetyFormSubmission).toHaveBeenCalledWith("company-1", {
      submission_id: SUBMISSION_ID,
      status: "REVIEWED",
      reviewed_by: "user-1",
      review_notes: "Reviewed and approved.",
    });
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "safety_form.submission.review",
        entity_id: SUBMISSION_ID,
      }),
    );
  });
});
