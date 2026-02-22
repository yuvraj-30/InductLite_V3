"use server";

import { z } from "zod";
import { createRequestLogger } from "@/lib/logger";
import { assertOrigin, generateRequestId } from "@/lib/auth/csrf";
import { findSiteByPublicSlug, findContractorByEmail } from "@/lib/repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { createMagicLinkForContractor } from "@/lib/auth/magic-link";
import { sendEmail } from "@/lib/email/resend";
import { checkContractorMagicLinkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { getPublicBaseUrl } from "@/lib/url/public-url";

const magicLinkSchema = z.object({
  siteSlug: z.string().min(1, "Site link is required"),
  email: z.string().email("Invalid email address"),
});

export type MagicLinkResult =
  | { success: true; message: string }
  | {
      success: false;
      message: string;
      error: "INVALID_ORIGIN" | "INVALID_INPUT" | "PROVIDER_ERROR";
    };

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
  try {
    await assertOrigin();
  } catch {
    return {
      success: false,
      message: "Invalid request origin",
      error: "INVALID_ORIGIN",
    };
  }

  let baseUrl: string;
  try {
    const requestHeaders = await headers();
    const host =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
    const requestOrigin = host
      ? `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`
      : undefined;

    baseUrl = getPublicBaseUrl(requestOrigin);
  } catch {
    return {
      success: false,
      message: "Service configuration error. Please contact support.",
      error: "PROVIDER_ERROR",
    };
  }

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
      error: "INVALID_INPUT",
    };
  }

  const siteSlug = extractSlug(parsed.data.siteSlug);
  const email = parsed.data.email.toLowerCase();

  const rateLimit = await checkContractorMagicLinkRateLimit({ requestId });
  if (!rateLimit.success) {
    log.warn({}, "Contractor magic-link rate limit exceeded");
    return {
      success: true,
      message: "If the details match, you will receive a login link shortly.",
    };
  }

  let matchedCompanyId: string | null = null;
  let matchedSiteId: string | null = null;
  let matchedContractorId: string | null = null;

  try {
    const site = await findSiteByPublicSlug(siteSlug);
    if (!site) {
      return {
        success: true,
        message: "If the details match, you will receive a login link shortly.",
      };
    }
    matchedCompanyId = site.company.id;
    matchedSiteId = site.id;

    const contractor = await findContractorByEmail(site.company.id, email);
    if (!contractor || !contractor.contact_email) {
      await createAuditLog(site.company.id, {
        action: "contractor.magic_link_failed",
        entity_type: "Contractor",
        user_id: undefined,
        details: {
          reason: "contractor_not_found",
          email_prefix: email.slice(0, 3) + "***",
          site_id: site.id,
        },
        request_id: requestId,
      });
      return {
        success: true,
        message: "If the details match, you will receive a login link shortly.",
      };
    }
    matchedContractorId = contractor.id;

    const token = await createMagicLinkForContractor(
      site.company.id,
      contractor.id,
    );
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

    await createAuditLog(site.company.id, {
      action: "contractor.magic_link_issue",
      entity_type: "Contractor",
      entity_id: contractor.id,
      user_id: undefined,
      details: {
        site_id: site.id,
        email_prefix: email.slice(0, 3) + "***",
      },
      request_id: requestId,
    });

    log.info({ contractorId: contractor.id }, "Magic link email sent");
  } catch (error) {
    log.error({ error: String(error) }, "Magic link request failed");
    if (matchedCompanyId) {
      try {
        await createAuditLog(matchedCompanyId, {
          action: "contractor.magic_link_failed",
          entity_type: "Contractor",
          entity_id: matchedContractorId ?? undefined,
          user_id: undefined,
          details: {
            reason: "provider_or_runtime_error",
            site_id: matchedSiteId,
          },
          request_id: requestId,
        });
      } catch (auditErr) {
        log.warn({ error: String(auditErr) }, "Magic link failure audit failed");
      }
    }
    return {
      success: false,
      message: "We couldn't send the email right now. Please try again.",
      error: "PROVIDER_ERROR",
    };
  }

  return {
    success: true,
    message: "If the details match, you will receive a login link shortly.",
  };
}
