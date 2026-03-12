import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertOrigin,
  checkAuthReadOnly,
  generateRequestId,
  getClientIp,
  getUserAgent,
} from "@/lib/auth";
import { createRequestLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findSiteByPublicSlug } from "@/lib/repository/site.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inductionStep = z.enum(["details", "induction", "signature", "success"]);

const uxEventSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("ux.admin.nav_search"),
    path: z.string().min(1).max(2048),
    queryLength: z.number().int().min(0).max(200),
    resultCount: z.number().int().min(0).max(500),
    sectionCount: z.number().int().min(0).max(100),
  }),
  z.object({
    event: z.literal("ux.induction.step_transition"),
    slug: z.string().trim().min(1).max(100),
    fromStep: inductionStep,
    toStep: inductionStep,
    flowId: z.string().trim().max(128).optional(),
    isKiosk: z.boolean().optional(),
  }),
]);

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/api/ux-events",
    method: "POST",
  });

  try {
    await assertOrigin();
  } catch {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = uxEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid UX event payload" }, { status: 400 });
  }

  const event = parsed.data;
  const [ipAddress, userAgent] = await Promise.all([getClientIp(), getUserAgent()]);

  if (event.event === "ux.induction.step_transition") {
    const site = await findSiteByPublicSlug(event.slug);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    await createAuditLog(site.company.id, {
      action: "ux.induction.step_transition",
      entity_type: "Site",
      entity_id: site.id,
      details: {
        site_slug: event.slug,
        from_step: event.fromStep,
        to_step: event.toStep,
        flow_id: event.flowId ?? null,
        is_kiosk: event.isKiosk === true,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId,
    });

    return new NextResponse(null, { status: 204 });
  }

  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    await createAuditLog(auth.user.companyId, {
      action: "ux.admin.nav_search",
      entity_type: "AdminNav",
      user_id: auth.user.id,
      details: {
        path: event.path,
        query_length: event.queryLength,
        result_count: event.resultCount,
        section_count: event.sectionCount,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: requestId,
    });
  } catch (error) {
    log.error(
      {
        action: "ux.admin.nav_search",
        userId: auth.user.id,
        companyId: auth.user.companyId,
        error: String(error),
      },
      "Failed to persist admin nav UX event",
    );
    return NextResponse.json({ error: "Failed to record UX event" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
