import { NextResponse } from "next/server";
import {
  fingerprintApiKey,
  parseCompanySsoConfig,
  verifyPartnerApiKey,
} from "@/lib/identity";
import { parseBearerToken } from "@/lib/http/auth-header";
import { findCompanySsoSettingsBySlug } from "@/lib/repository/company.repository";

export type PartnerApiScope = "sites.read" | "signins.read";

export interface PartnerApiAuthContext {
  companyId: string;
  companySlug: string;
  scope: PartnerApiScope;
  monthlyQuota: number;
  tokenFingerprint: string;
}

function tokenFingerprint(token: string): string {
  return fingerprintApiKey(token);
}

export async function authenticatePartnerApiRequest(
  request: Request,
  requiredScope: PartnerApiScope,
): Promise<
  | { ok: true; context: PartnerApiAuthContext }
  | { ok: false; response: NextResponse }
> {
  const url = new URL(request.url);
  const companySlug = (url.searchParams.get("company") ?? "")
    .trim()
    .toLowerCase();
  const apiKey = parseBearerToken(request.headers.get("authorization"));

  if (!companySlug) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Missing company slug query parameter" },
        { status: 400 },
      ),
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Missing bearer token" },
        { status: 401 },
      ),
    };
  }

  const company = await findCompanySsoSettingsBySlug(companySlug);
  if (!company) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Company not found" },
        { status: 404 },
      ),
    };
  }

  const ssoConfig = parseCompanySsoConfig(company.sso_config);
  if (!ssoConfig.partnerApi.enabled) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Partner API is disabled for this company" },
        { status: 403 },
      ),
    };
  }

  if (!verifyPartnerApiKey(apiKey, ssoConfig.partnerApi.tokenHash)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Invalid partner API key" },
        { status: 401 },
      ),
    };
  }

  if (!ssoConfig.partnerApi.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          error: `Missing required scope: ${requiredScope}`,
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    context: {
      companyId: company.id,
      companySlug: company.slug,
      scope: requiredScope,
      monthlyQuota: ssoConfig.partnerApi.monthlyQuota,
      tokenFingerprint: tokenFingerprint(apiKey),
    },
  };
}
