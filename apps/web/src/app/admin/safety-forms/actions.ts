"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkSitePermission } from "@/lib/auth";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  createSafetyFormSubmission,
  createSafetyFormTemplate,
  deactivateSafetyFormTemplate,
  installDefaultSafetyFormTemplates,
  reviewSafetyFormSubmission,
} from "@/lib/repository/safety-form.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import type { Prisma, SafetyFormType } from "@prisma/client";

function buildRedirect(status: "success" | "error", message: string): never {
  const params = new URLSearchParams({ status, message });
  redirect(`/admin/safety-forms?${params.toString()}`);
}

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function assertSiteManage(siteId: string): Promise<void> {
  const guard = await checkSitePermission("site:manage", siteId);
  if (!guard.success) {
    buildRedirect("error", guard.error);
  }
}

const createTemplateSchema = z.object({
  siteId: z.string().optional().or(z.literal("")),
  formType: z.enum([
    "SWMS",
    "JSA",
    "RAMS",
    "TOOLBOX_TALK",
    "FATIGUE_DECLARATION",
  ]),
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  fieldSchemaJson: z.string().trim().min(2).max(20000),
});

const submitFormSchema = z.object({
  siteId: z.string().cuid(),
  templateId: z.string().cuid(),
  submittedByName: z.string().trim().min(2).max(160),
  submittedByEmail: z.string().trim().email().optional().or(z.literal("")),
  submittedByPhone: z.string().trim().max(64).optional().or(z.literal("")),
  summary: z.string().trim().max(2000).optional().or(z.literal("")),
  payloadJson: z.string().trim().min(2).max(50000),
});

const reviewSchema = z.object({
  submissionId: z.string().cuid(),
  siteId: z.string().cuid(),
  status: z.enum(["REVIEWED", "REJECTED"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const installDefaultsSchema = z.object({
  siteId: z.string().optional().or(z.literal("")),
});

const deactivateTemplateSchema = z.object({
  templateId: z.string().cuid(),
  siteId: z.string().optional().or(z.literal("")),
});

function parseJsonObject(value: string): Prisma.InputJsonValue {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("JSON payload must be an object or array");
  }
  return parsed as Prisma.InputJsonValue;
}

export async function installSafetyFormDefaultsAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();

    const parsed = installDefaultsSchema.safeParse({
      siteId: formData.get("siteId")?.toString() ?? "",
    });
    if (!parsed.success) {
      buildRedirect("error", "Invalid install defaults input");
    }

    const context = await requireAuthenticatedContextReadOnly();
    const siteId = parsed.data.siteId?.trim() || null;
    if (siteId) {
      await assertSiteManage(siteId);
    } else if (context.role !== "ADMIN") {
      buildRedirect("error", "Only admins can create global safety templates");
    }

    const result = await installDefaultSafetyFormTemplates(context.companyId, {
      site_id: siteId,
      created_by: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "safety_form.template.install_defaults",
      entity_type: "SafetyFormTemplate",
      entity_id: siteId ?? "GLOBAL",
      user_id: context.userId,
      details: {
        created: result.created,
        skipped: result.skipped,
        site_id: siteId,
      },
    });

    revalidatePath("/admin/safety-forms");
    buildRedirect(
      "success",
      `Installed defaults: ${result.created} created, ${result.skipped} already present.`,
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    buildRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to install defaults",
    );
  }
}

export async function createSafetyFormTemplateAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();

    const parsed = createTemplateSchema.safeParse({
      siteId: formData.get("siteId")?.toString() ?? "",
      formType: formData.get("formType")?.toString() ?? "",
      name: formData.get("name")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? "",
      fieldSchemaJson: formData.get("fieldSchemaJson")?.toString() ?? "",
    });

    if (!parsed.success) {
      buildRedirect(
        "error",
        parsed.error.issues[0]?.message ?? "Invalid template input",
      );
    }

    const context = await requireAuthenticatedContextReadOnly();
    const siteId = parsed.data.siteId?.trim() || null;
    if (siteId) {
      await assertSiteManage(siteId);
    } else if (context.role !== "ADMIN") {
      buildRedirect("error", "Only admins can create global safety templates");
    }

    const fieldSchema = parseJsonObject(parsed.data.fieldSchemaJson);

    const template = await createSafetyFormTemplate(context.companyId, {
      site_id: siteId,
      form_type: parsed.data.formType as SafetyFormType,
      name: parsed.data.name,
      description: parsed.data.description || null,
      field_schema: fieldSchema,
      created_by: context.userId,
      is_active: true,
    });

    await createAuditLog(context.companyId, {
      action: "safety_form.template.create",
      entity_type: "SafetyFormTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        site_id: template.site_id,
        form_type: template.form_type,
        name: template.name,
      },
    });

    revalidatePath("/admin/safety-forms");
    buildRedirect("success", "Safety form template saved");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    buildRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to create template",
    );
  }
}

export async function deactivateSafetyFormTemplateAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();

    const parsed = deactivateTemplateSchema.safeParse({
      templateId: formData.get("templateId")?.toString() ?? "",
      siteId: formData.get("siteId")?.toString() ?? "",
    });
    if (!parsed.success) {
      buildRedirect("error", "Invalid template deactivate input");
    }

    const context = await requireAuthenticatedContextReadOnly();
    const siteId = parsed.data.siteId?.trim();
    if (siteId) {
      await assertSiteManage(siteId);
    } else if (context.role !== "ADMIN") {
      buildRedirect("error", "Only admins can deactivate global templates");
    }

    const template = await deactivateSafetyFormTemplate(
      context.companyId,
      parsed.data.templateId,
    );

    await createAuditLog(context.companyId, {
      action: "safety_form.template.deactivate",
      entity_type: "SafetyFormTemplate",
      entity_id: template.id,
      user_id: context.userId,
      details: {
        site_id: template.site_id,
        form_type: template.form_type,
        name: template.name,
      },
    });

    revalidatePath("/admin/safety-forms");
    buildRedirect("success", "Template deactivated");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    buildRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to deactivate template",
    );
  }
}

export async function submitSafetyFormAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();

    const parsed = submitFormSchema.safeParse({
      siteId: formData.get("siteId")?.toString() ?? "",
      templateId: formData.get("templateId")?.toString() ?? "",
      submittedByName: formData.get("submittedByName")?.toString() ?? "",
      submittedByEmail: formData.get("submittedByEmail")?.toString() ?? "",
      submittedByPhone: formData.get("submittedByPhone")?.toString() ?? "",
      summary: formData.get("summary")?.toString() ?? "",
      payloadJson: formData.get("payloadJson")?.toString() ?? "",
    });

    if (!parsed.success) {
      buildRedirect(
        "error",
        parsed.error.issues[0]?.message ?? "Invalid submission input",
      );
    }

    await assertSiteManage(parsed.data.siteId);

    const context = await requireAuthenticatedContextReadOnly();
    const payload = parseJsonObject(parsed.data.payloadJson);

    const submission = await createSafetyFormSubmission(context.companyId, {
      site_id: parsed.data.siteId,
      template_id: parsed.data.templateId,
      submitted_by_name: parsed.data.submittedByName,
      submitted_by_email: parsed.data.submittedByEmail || null,
      submitted_by_phone: parsed.data.submittedByPhone || null,
      summary: parsed.data.summary || null,
      payload,
    });

    await createAuditLog(context.companyId, {
      action: "safety_form.submission.create",
      entity_type: "SafetyFormSubmission",
      entity_id: submission.id,
      user_id: context.userId,
      details: {
        site_id: submission.site_id,
        template_id: submission.template_id,
        status: submission.status,
      },
    });

    revalidatePath("/admin/safety-forms");
    buildRedirect("success", "Safety form submission recorded");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    buildRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to submit safety form",
    );
  }
}

export async function reviewSafetyFormSubmissionAction(
  formData: FormData,
): Promise<void> {
  try {
    await assertOrigin();

    const parsed = reviewSchema.safeParse({
      submissionId: formData.get("submissionId")?.toString() ?? "",
      siteId: formData.get("siteId")?.toString() ?? "",
      status: formData.get("status")?.toString() ?? "",
      notes: formData.get("notes")?.toString() ?? "",
    });

    if (!parsed.success) {
      buildRedirect(
        "error",
        parsed.error.issues[0]?.message ?? "Invalid review input",
      );
    }

    await assertSiteManage(parsed.data.siteId);

    const context = await requireAuthenticatedContextReadOnly();

    const submission = await reviewSafetyFormSubmission(context.companyId, {
      submission_id: parsed.data.submissionId,
      status: parsed.data.status,
      reviewed_by: context.userId,
      review_notes: parsed.data.notes || null,
    });

    await createAuditLog(context.companyId, {
      action: "safety_form.submission.review",
      entity_type: "SafetyFormSubmission",
      entity_id: submission.id,
      user_id: context.userId,
      details: {
        site_id: submission.site_id,
        status: submission.status,
      },
    });

    revalidatePath("/admin/safety-forms");
    buildRedirect("success", "Submission review saved");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    buildRedirect(
      "error",
      error instanceof Error ? error.message : "Failed to review submission",
    );
  }
}
