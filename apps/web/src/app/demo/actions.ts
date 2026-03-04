"use server";

import { z } from "zod";
import {
  assertOrigin,
  generateRequestId,
  getClientIp,
  getUserAgent,
} from "@/lib/auth/csrf";
import { sendEmail } from "@/lib/email/resend";
import { createRequestLogger } from "@/lib/logger";
import { checkDemoBookingRateLimit } from "@/lib/rate-limit";
import {
  createDemoBookingRequest,
  updateDemoBookingNotificationStatus,
} from "@/lib/repository/demo-booking.repository";
import { hashLookupValue } from "@/lib/security/data-protection";

const demoBookingSchema = z.object({
  fullName: z
    .string()
    .min(2, "Please enter your full name")
    .max(120, "Name is too long"),
  workEmail: z.string().email("Please enter a valid work email"),
  companyName: z
    .string()
    .min(2, "Please enter your company name")
    .max(160, "Company name is too long"),
  phone: z
    .string()
    .max(40, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  siteCount: z
    .preprocess(
      (value) => {
        if (value === null || value === undefined || value === "") return undefined;
        const numeric = Number(value);
        if (Number.isNaN(numeric)) return value;
        return numeric;
      },
      z
        .number({ invalid_type_error: "Site count must be a number" })
        .int("Site count must be a whole number")
        .min(1, "Site count must be at least 1")
        .max(500, "Site count is too high")
        .optional(),
    )
    .optional(),
  targetGoLiveDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => {
      if (!value) return true;
      return !Number.isNaN(Date.parse(value));
    }, "Please provide a valid go-live date"),
  requirements: z
    .string()
    .min(20, "Please add at least a short summary of your needs")
    .max(3000, "Requirements text is too long"),
  sourcePath: z.string().max(64).optional().or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
});

export type DemoBookingActionResult =
  | {
      success: true;
      message: string;
      requestReference: string;
    }
  | {
      success: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
    };

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getNotificationRecipients(): string[] {
  const fallback = ["sales@inductlite.nz", "support@inductlite.nz"];
  const configured = (process.env.DEMO_BOOKING_NOTIFY_TO ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const emailSchema = z.string().email();
  const validated = configured.filter((email) => emailSchema.safeParse(email).success);
  if (validated.length > 0) {
    return Array.from(new Set(validated));
  }
  return fallback;
}

function toReference(id: string): string {
  return id.slice(-8).toUpperCase();
}

function buildNotificationEmailHtml(input: {
  requestReference: string;
  fullName: string;
  workEmail: string;
  companyName: string;
  phone?: string;
  siteCount?: number;
  targetGoLiveDate?: Date;
  requirements: string;
  sourcePath: string;
  submittedAt: Date;
}): string {
  const targetGoLive = input.targetGoLiveDate
    ? input.targetGoLiveDate.toISOString().slice(0, 10)
    : "Not provided";

  return `
    <h1>New Demo Booking Request</h1>
    <p><strong>Reference:</strong> ${escapeHtml(input.requestReference)}</p>
    <p><strong>Submitted at (UTC):</strong> ${escapeHtml(input.submittedAt.toISOString())}</p>
    <p><strong>Name:</strong> ${escapeHtml(input.fullName)}</p>
    <p><strong>Work email:</strong> ${escapeHtml(input.workEmail)}</p>
    <p><strong>Company:</strong> ${escapeHtml(input.companyName)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.phone || "Not provided")}</p>
    <p><strong>Site count:</strong> ${input.siteCount ? String(input.siteCount) : "Not provided"}</p>
    <p><strong>Target go-live:</strong> ${escapeHtml(targetGoLive)}</p>
    <p><strong>Source path:</strong> ${escapeHtml(input.sourcePath)}</p>
    <h2>Requirements</h2>
    <p>${escapeHtml(input.requirements).replaceAll("\n", "<br/>")}</p>
  `;
}

export async function submitDemoBookingAction(
  _prevState: DemoBookingActionResult | null,
  formData: FormData,
): Promise<DemoBookingActionResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/demo",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const rateLimit = await checkDemoBookingRateLimit({ requestId });
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many demo requests from this device. Please try again later.",
    };
  }

  const getRequiredString = (field: string): string => {
    const value = formData.get(field);
    return typeof value === "string" ? value : "";
  };

  const getOptionalString = (field: string): string | undefined => {
    const value = formData.get(field);
    return typeof value === "string" ? value : undefined;
  };

  const rawData = {
    fullName: getRequiredString("fullName"),
    workEmail: getRequiredString("workEmail"),
    companyName: getRequiredString("companyName"),
    phone: getOptionalString("phone"),
    siteCount: getOptionalString("siteCount"),
    targetGoLiveDate: getOptionalString("targetGoLiveDate"),
    requirements: getRequiredString("requirements"),
    sourcePath: getOptionalString("sourcePath"),
    website: getOptionalString("website"),
  };

  const parsed = demoBookingSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]?.toString() || "form";
      fieldErrors[field] = fieldErrors[field] || [];
      fieldErrors[field].push(issue.message);
    }
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid form input",
      fieldErrors,
    };
  }

  if (parsed.data.website?.trim()) {
    return {
      success: true,
      message: "Thanks. Your request has been received.",
      requestReference: "PENDING",
    };
  }

  const [ipAddress, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);
  const targetGoLiveDate = parsed.data.targetGoLiveDate
    ? new Date(parsed.data.targetGoLiveDate)
    : null;

  try {
    const created = await createDemoBookingRequest({
      fullName: parsed.data.fullName,
      workEmail: parsed.data.workEmail,
      companyName: parsed.data.companyName,
      phone: parsed.data.phone || null,
      siteCount: parsed.data.siteCount ?? null,
      targetGoLiveDate,
      requirements: parsed.data.requirements,
      sourcePath: parsed.data.sourcePath || "/demo",
      ipHash: ipAddress ? hashLookupValue(ipAddress) : null,
      userAgent: userAgent?.slice(0, 512) ?? null,
    });

    const requestReference = toReference(created.id);
    const recipients = getNotificationRecipients();
    const emailHtml = buildNotificationEmailHtml({
      requestReference,
      fullName: parsed.data.fullName,
      workEmail: parsed.data.workEmail,
      companyName: parsed.data.companyName,
      phone: parsed.data.phone || undefined,
      siteCount: parsed.data.siteCount ?? undefined,
      targetGoLiveDate: targetGoLiveDate ?? undefined,
      requirements: parsed.data.requirements,
      sourcePath: parsed.data.sourcePath || "/demo",
      submittedAt: created.created_at,
    });

    const notifyResults = await Promise.allSettled(
      recipients.map((recipient) =>
        sendEmail({
          to: recipient,
          subject: `Demo request ${requestReference} from ${parsed.data.companyName}`,
          html: emailHtml,
        }),
      ),
    );

    const deliveredCount = notifyResults.filter(
      (result) => result.status === "fulfilled",
    ).length;
    const failedMessages = notifyResults
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => String(result.reason));

    await updateDemoBookingNotificationStatus(created.id, {
      status: deliveredCount > 0 ? "SENT" : "FAILED",
      recipients,
      attemptedAt: new Date(),
      sentAt: deliveredCount > 0 ? new Date() : null,
      errorMessage: failedMessages.length > 0 ? failedMessages.join(" | ").slice(0, 500) : null,
    });

    if (deliveredCount === 0) {
      log.error(
        {
          requestId,
          requestReference,
          recipientCount: recipients.length,
        },
        "Demo booking saved but notification delivery failed",
      );
    }

    return {
      success: true,
      message: "Thanks. Our team will contact you shortly to confirm your demo.",
      requestReference,
    };
  } catch (error) {
    log.error(
      {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to submit demo booking request",
    );
    return {
      success: false,
      error: "Failed to submit your request. Please try again.",
    };
  }
}
