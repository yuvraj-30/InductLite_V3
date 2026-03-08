import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRequestId } from "@/lib/auth/csrf";
import { scopedDb } from "@/lib/db/scoped-db";
import { authenticatePartnerApiRequest } from "@/lib/partner-api/auth";
import { createSystemAuditLog } from "@/lib/repository/audit.repository";
import { listSignInHistory } from "@/lib/repository/signin.repository";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const querySchema = z.object({
  siteId: z.string().cuid().optional(),
  status: z.enum(["on_site", "signed_out", "all"]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

function monthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const auth = await authenticatePartnerApiRequest(request, "signins.read");
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

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    siteId: url.searchParams.get("siteId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid query parameters",
      },
      { status: 400 },
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

  const history = await listSignInHistory(
    auth.context.companyId,
    {
      siteId: parsed.data.siteId,
      status: parsed.data.status,
      dateRange:
        parsed.data.dateFrom || parsed.data.dateTo
          ? {
              from: parsed.data.dateFrom ? new Date(parsed.data.dateFrom) : undefined,
              to: parsed.data.dateTo ? new Date(parsed.data.dateTo) : undefined,
            }
          : undefined,
    },
    { page: parsed.data.page, pageSize: parsed.data.pageSize },
  );

  await createSystemAuditLog({
    company_id: auth.context.companyId,
    action: "partner.api.request",
    entity_type: "PartnerApi",
    entity_id: "signins.read",
    request_id: requestId,
    details: {
      route: "/api/v1/partner/sign-ins",
      scope: auth.context.scope,
      token_fingerprint: auth.context.tokenFingerprint,
      used_monthly: usedThisMonth + 1,
      monthly_quota: auth.context.monthlyQuota,
      page: parsed.data.page,
      page_size: parsed.data.pageSize,
      result_count: history.items.length,
    },
  });

  return NextResponse.json({
    success: true,
    data: history.items.map((entry) => ({
      id: entry.id,
      siteId: entry.site_id,
      siteName: entry.site.name,
      visitorName: entry.visitor_name,
      visitorPhone: entry.visitor_phone,
      visitorEmail: entry.visitor_email,
      employerName: entry.employer_name,
      visitorType: entry.visitor_type,
      signInTs: entry.sign_in_ts,
      signOutTs: entry.sign_out_ts,
      notes: entry.notes,
    })),
    pagination: {
      total: history.total,
      page: history.page,
      pageSize: history.pageSize,
      totalPages: history.totalPages,
    },
    quota: {
      used: usedThisMonth + 1,
      monthly: auth.context.monthlyQuota,
      remaining: Math.max(auth.context.monthlyQuota - (usedThisMonth + 1), 0),
    },
  });
}
