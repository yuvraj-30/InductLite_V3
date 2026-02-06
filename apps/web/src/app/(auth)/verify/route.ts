import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { setContractorSession } from "@/lib/auth/contractor-session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  if (!token) {
    return NextResponse.redirect(new URL("/contractor?status=invalid", url));
  }

  const result = await consumeMagicLink(token);
  if (!result) {
    return NextResponse.redirect(new URL("/contractor?status=invalid", url));
  }

  await setContractorSession({
    contractorId: result.contractor.id,
    companyId: result.company.id,
  });

  return NextResponse.redirect(new URL("/contractor/portal", url));
}
