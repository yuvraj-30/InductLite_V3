"use server";

import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { findSiteByPublicSlug, findContractorByEmail } from "@/lib/repository";
import { createMagicLinkForContractor } from "@/lib/auth/magic-link";
import { sendEmail } from "@/lib/email/resend";

const magicLinkSchema = z.object({
  siteSlug: z.string().min(1, "Site link is required"),
  email: z.string().email("Invalid email address"),
});

export type MagicLinkResult =
  | { success: true; message: string }
  | { success: false; message: string };

function extractSlug(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/s\/([^/?#]+)/i);
  if (match?.[1]) return match[1];
  return trimmed;
}

export async function requestContractorMagicLinkAction(
  _prevState: MagicLinkResult | null,
  formData: FormData,
): Promise<MagicLinkResult> {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  const rawData = {
    siteSlug: formData.get("siteSlug"),
    email: formData.get("email"),
  };

  const parsed = magicLinkSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.errors[0]?.message || "Invalid input",
    };
  }

  const siteSlug = extractSlug(parsed.data.siteSlug);
  const email = parsed.data.email.toLowerCase();

  try {
    const site = await findSiteByPublicSlug(siteSlug);
    if (!site) {
      return {
        success: true,
        message: "If the details match, you will receive a login link shortly.",
      };
    }

    const contractor = await findContractorByEmail(site.company.id, email);
    if (!contractor || !contractor.contact_email) {
      return {
        success: true,
        message: "If the details match, you will receive a login link shortly.",
      };
    }

    const token = await createMagicLinkForContractor(
      site.company.id,
      contractor.id,
    );
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${baseUrl}/verify?token=${token}`;

    await sendEmail({
      to: contractor.contact_email,
      subject: "Your contractor access link",
      html: `
        <p>Hello ${contractor.name},</p>
        <p>Use the link below to access your contractor portal. This link expires in 15 minutes.</p>
        <p><a href="${link}">${link}</a></p>
      `,
    });

    log.info({ contractorId: contractor.id }, "Magic link email sent");
  } catch (error) {
    log.error({ error: String(error) }, "Magic link request failed");
  }

  return {
    success: true,
    message: "If the details match, you will receive a login link shortly.",
  };
}
