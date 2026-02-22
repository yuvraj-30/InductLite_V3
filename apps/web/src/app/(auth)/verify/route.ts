import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { setContractorSession } from "@/lib/auth/contractor-session";
import { buildPublicUrl } from "@/lib/url/public-url";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { generateRequestId } from "@/lib/auth/csrf";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const requestId = generateRequestId();
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.redirect(
      buildPublicUrl("/contractor?status=invalid", req.url),
    );
  }

  const result = await consumeMagicLink(token);
  if (!result) {
    return NextResponse.redirect(
      buildPublicUrl("/contractor?status=invalid", req.url),
    );
  }

  await setContractorSession({
    contractorId: result.contractor.id,
    companyId: result.company.id,
  });

  try {
    await createAuditLog(result.company.id, {
      action: "contractor.magic_link_consume",
      entity_type: "Contractor",
      entity_id: result.contractor.id,
      user_id: undefined,
      details: {
        company_slug: result.company.slug,
      },
      request_id: requestId,
    });
  } catch {
    // Do not block contractor access if audit logging fails.
  }

  return NextResponse.redirect(buildPublicUrl("/contractor/portal", req.url));
}
