import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { parseCompanySsoConfig, discoverOidcConfiguration, buildOidcAuthorizationUrl } from "@/lib/identity";
import { createRequestLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findCompanySsoSettingsBySlug } from "@/lib/repository/company.repository";
import { buildPublicUrl } from "@/lib/url/public-url";

export const runtime = "nodejs";

function normalizeCompanySlug(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeReturnTo(value: string | null): string {
  const fallback = "/admin/dashboard";
  const candidate = (value ?? "").trim();
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  return candidate;
}

function buildLoginRedirect(
  requestUrl: string,
  companySlug: string,
  reason: string,
): URL {
  const redirectUrl = buildPublicUrl("/login", requestUrl);
  if (companySlug) {
    redirectUrl.searchParams.set("company", companySlug);
  }
  redirectUrl.searchParams.set("sso", reason);
  return redirectUrl;
}

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/api/auth/sso/start",
    method: "GET",
  });
  const requestUrl = new URL(request.url);
  const companySlug = normalizeCompanySlug(
    requestUrl.searchParams.get("company"),
  );
  const returnTo = normalizeReturnTo(requestUrl.searchParams.get("returnTo"));

  if (!companySlug) {
    return NextResponse.redirect(
      buildLoginRedirect(request.url, "", "missing_workspace"),
      { status: 303 },
    );
  }

  const company = await findCompanySsoSettingsBySlug(companySlug);
  if (!company) {
    return NextResponse.redirect(
      buildLoginRedirect(request.url, companySlug, "workspace_not_found"),
      { status: 303 },
    );
  }

  const config = parseCompanySsoConfig(company.sso_config);
  if (
    !config.enabled ||
    !config.issuerUrl ||
    !config.clientId ||
    !config.clientSecretEncrypted
  ) {
    return NextResponse.redirect(
      buildLoginRedirect(request.url, company.slug, "not_configured"),
      { status: 303 },
    );
  }

  try {
    const discovery = await discoverOidcConfiguration(config.issuerUrl);
    const state = randomBytes(20).toString("hex");
    const nonce = randomBytes(20).toString("hex");
    const redirectUri = buildPublicUrl("/api/auth/sso/callback", request.url)
      .toString();

    const session = await getSession();
    session.pendingSso = {
      companyId: company.id,
      companySlug: company.slug,
      state,
      nonce,
      returnTo,
      createdAt: Date.now(),
    };
    await session.save();

    await createAuditLog(company.id, {
      action: "auth.sso_start",
      entity_type: "Company",
      entity_id: company.id,
      details: {
        provider: config.provider,
        company_slug: company.slug,
      },
      request_id: requestId,
    });

    const authorizationUrl = buildOidcAuthorizationUrl({
      authorizationEndpoint: discovery.authorization_endpoint,
      clientId: config.clientId,
      redirectUri,
      scopes: config.scopes,
      state,
      nonce,
    });

    return NextResponse.redirect(authorizationUrl, { status: 303 });
  } catch (error) {
    log.error(
      {
        companyId: company.id,
        companySlug: company.slug,
        error: String(error),
      },
      "Failed to start SSO flow",
    );

    try {
      await createAuditLog(company.id, {
        action: "auth.sso_failed",
        entity_type: "Company",
        entity_id: company.id,
        details: {
          stage: "start",
          reason: error instanceof Error ? error.message : String(error),
        },
        request_id: requestId,
      });
    } catch {
      // Best effort only.
    }

    return NextResponse.redirect(
      buildLoginRedirect(request.url, company.slug, "start_failed"),
      { status: 303 },
    );
  }
}
