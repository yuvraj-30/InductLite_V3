import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { establishAuthenticatedSession, getSession } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import {
  decryptClientSecret,
  discoverOidcConfiguration,
  exchangeAuthorizationCode,
  isEmailDomainAllowed,
  parseCompanySsoConfig,
  resolveRoleFromClaims,
  upsertIdentityUser,
  verifyIdToken,
} from "@/lib/identity";
import { createRequestLogger } from "@/lib/logger";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { findCompanySsoSettings } from "@/lib/repository/company.repository";
import { buildPublicUrl } from "@/lib/url/public-url";

export const runtime = "nodejs";

const MAX_PENDING_SSO_AGE_MS = 10 * 60 * 1000;

function getStringClaim(
  payload: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function normalizeReturnTo(value: string, role: UserRole): string {
  const fallback = role === "ADMIN" ? "/admin/dashboard" : "/admin/sites";
  const candidate = value.trim();
  if (!candidate) return fallback;
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  return candidate;
}

function buildLoginRedirect(requestUrl: string, companySlug: string, reason: string) {
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
    path: "/api/auth/sso/callback",
    method: "GET",
  });
  const requestUrl = new URL(request.url);
  const authError = requestUrl.searchParams.get("error");
  const authErrorDescription = requestUrl.searchParams.get("error_description");
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const session = await getSession();
  const pendingSso = session.pendingSso;

  const redirectSessionMissing = NextResponse.redirect(
    buildLoginRedirect(request.url, "", "session_missing"),
    { status: 303 },
  );

  if (!pendingSso) {
    return redirectSessionMissing;
  }

  const clearPendingState = async () => {
    delete session.pendingSso;
    await session.save();
  };

  const isExpired = Date.now() - pendingSso.createdAt > MAX_PENDING_SSO_AGE_MS;
  if (isExpired || !state || state !== pendingSso.state) {
    await clearPendingState();
    return NextResponse.redirect(
      buildLoginRedirect(request.url, pendingSso.companySlug, "state_invalid"),
      { status: 303 },
    );
  }

  if (authError || !code) {
    await clearPendingState();
    return NextResponse.redirect(
      buildLoginRedirect(request.url, pendingSso.companySlug, "provider_error"),
      { status: 303 },
    );
  }

  const company = await findCompanySsoSettings(pendingSso.companyId);
  if (!company) {
    await clearPendingState();
    return redirectSessionMissing;
  }

  const config = parseCompanySsoConfig(company.sso_config);
  const clientSecret = decryptClientSecret(config);
  if (
    !config.enabled ||
    !config.issuerUrl ||
    !config.clientId ||
    !clientSecret
  ) {
    await clearPendingState();
    return NextResponse.redirect(
      buildLoginRedirect(request.url, company.slug, "not_configured"),
      { status: 303 },
    );
  }

  try {
    const discovery = await discoverOidcConfiguration(config.issuerUrl);
    const redirectUri = buildPublicUrl("/api/auth/sso/callback", request.url)
      .toString();
    const tokenPayload = await exchangeAuthorizationCode({
      tokenEndpoint: discovery.token_endpoint,
      clientId: config.clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const verified = await verifyIdToken({
      idToken: tokenPayload.id_token!,
      issuer: discovery.issuer,
      audience: config.clientId,
      jwksUri: discovery.jwks_uri,
      nonce: pendingSso.nonce,
    });

    const claims = verified.payload as Record<string, unknown>;
    const subject = getStringClaim(claims, ["sub"]);
    const email = getStringClaim(claims, ["email", "preferred_username", "upn"]);
    const name = getStringClaim(claims, ["name", "given_name", "preferred_username"]);
    if (!subject || !email) {
      throw new Error("SSO identity is missing required claims");
    }

    if (!isEmailDomainAllowed(email, config)) {
      throw new Error("Email domain is not allowed for this workspace");
    }

    const role = resolveRoleFromClaims(claims, config);
    const identityUser = await upsertIdentityUser({
      companyId: company.id,
      provider: config.provider,
      subject,
      email,
      name: name ?? email,
      role,
      autoProvisionUsers: config.autoProvisionUsers,
      markDirectorySync: false,
    });

    await establishAuthenticatedSession({
      id: identityUser.id,
      email: identityUser.email,
      name: identityUser.name,
      role: identityUser.role,
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
    });

    await createAuditLog(company.id, {
      action: "auth.sso_login",
      entity_type: "User",
      entity_id: identityUser.id,
      user_id: identityUser.id,
      details: {
        provider: config.provider,
        email: identityUser.email,
        auto_provisioned: identityUser.created,
      },
      request_id: requestId,
    });

    const targetPath = normalizeReturnTo(pendingSso.returnTo, identityUser.role);
    return NextResponse.redirect(buildPublicUrl(targetPath, request.url), {
      status: 303,
    });
  } catch (error) {
    log.error(
      {
        companyId: company.id,
        companySlug: company.slug,
        providerError: authError ?? undefined,
        providerErrorDescription: authErrorDescription ?? undefined,
        error: String(error),
      },
      "Failed to finish SSO callback",
    );

    try {
      await createAuditLog(company.id, {
        action: "auth.sso_failed",
        entity_type: "Company",
        entity_id: company.id,
        details: {
          stage: "callback",
          reason: error instanceof Error ? error.message : String(error),
        },
        request_id: requestId,
      });
    } catch {
      // Best effort only.
    }

    await clearPendingState();
    return NextResponse.redirect(
      buildLoginRedirect(request.url, company.slug, "callback_failed"),
      { status: 303 },
    );
  }
}
