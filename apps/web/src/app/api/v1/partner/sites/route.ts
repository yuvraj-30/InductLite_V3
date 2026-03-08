import { NextResponse } from "next/server";
import { generateRequestId } from "@/lib/auth/csrf";
import { scopedDb } from "@/lib/db/scoped-db";
import { authenticatePartnerApiRequest } from "@/lib/partner-api/auth";
import { createSystemAuditLog } from "@/lib/repository/audit.repository";
import { findAllSites } from "@/lib/repository/site.repository";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function monthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const auth = await authenticatePartnerApiRequest(request, "sites.read");
  if (!auth.ok) {
    return auth.response;
  }

  const rateLimit = await checkAdminMutationRateLimit(
    auth.context.companyId,
    `partner:${auth.context.tokenFingerprint}`,
    {
      requestId,
      clientKey: `partner:${auth.context.tokenFingerprint}`,
    },
  );
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Partner API rate limit exceeded",
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset: rateLimit.reset,
      },
      { status: 429 },
    );
  }

  const db = scopedDb(auth.context.companyId);
  const usedThisMonth = await db.auditLog.count({
    where: {
      company_id: auth.context.companyId,
      action: "partner.api.request",
      created_at: { gte: monthStartUtc() },
    },
  });

  if (usedThisMonth >= auth.context.monthlyQuota) {
    return NextResponse.json(
      {
        success: false,
        error: "Partner API monthly quota exceeded",
        quota: auth.context.monthlyQuota,
        used: usedThisMonth,
      },
      { status: 429 },
    );
  }

  const sites = await findAllSites(auth.context.companyId);

  await createSystemAuditLog({
    company_id: auth.context.companyId,
    action: "partner.api.request",
    entity_type: "PartnerApi",
    entity_id: "sites.read",
    request_id: requestId,
    details: {
      route: "/api/v1/partner/sites",
      scope: auth.context.scope,
      token_fingerprint: auth.context.tokenFingerprint,
      used_monthly: usedThisMonth + 1,
      monthly_quota: auth.context.monthlyQuota,
      result_count: sites.length,
    },
  });

  return NextResponse.json({
    success: true,
    data: sites.map((site) => ({
      id: site.id,
      name: site.name,
      address: site.address,
      description: site.description,
      isActive: site.is_active,
    })),
    quota: {
      used: usedThisMonth + 1,
      monthly: auth.context.monthlyQuota,
      remaining: Math.max(auth.context.monthlyQuota - (usedThisMonth + 1), 0),
    },
  });
}
