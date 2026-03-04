import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

const DEFAULT_TIMEOUT_MS = 12_000;

export interface OidcDiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

export interface OidcTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
}

export interface VerifiedIdToken {
  payload: JWTPayload;
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

function ensureHttpsOrHttp(url: string, field: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`${field} must use http/https`);
    }
    return parsed.toString();
  } catch {
    throw new Error(`Invalid ${field}`);
  }
}

export async function discoverOidcConfiguration(
  issuerUrl: string,
): Promise<OidcDiscoveryDocument> {
  const issuer = ensureHttpsOrHttp(issuerUrl, "issuer URL").replace(/\/$/, "");
  const url = `${issuer}/.well-known/openid-configuration`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: withTimeout(DEFAULT_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`OIDC discovery failed (${response.status})`);
  }

  const data = (await response.json()) as Partial<OidcDiscoveryDocument>;
  if (
    !data.issuer ||
    !data.authorization_endpoint ||
    !data.token_endpoint ||
    !data.jwks_uri
  ) {
    throw new Error("OIDC discovery document is incomplete");
  }

  return {
    issuer: ensureHttpsOrHttp(data.issuer, "issuer"),
    authorization_endpoint: ensureHttpsOrHttp(
      data.authorization_endpoint,
      "authorization endpoint",
    ),
    token_endpoint: ensureHttpsOrHttp(data.token_endpoint, "token endpoint"),
    jwks_uri: ensureHttpsOrHttp(data.jwks_uri, "jwks uri"),
  };
}

export function buildOidcAuthorizationUrl(input: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
  nonce: string;
}): string {
  const endpoint = ensureHttpsOrHttp(
    input.authorizationEndpoint,
    "authorization endpoint",
  );
  const url = new URL(endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("nonce", input.nonce);
  return url.toString();
}

export async function exchangeAuthorizationCode(input: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<OidcTokenResponse> {
  const tokenEndpoint = ensureHttpsOrHttp(input.tokenEndpoint, "token endpoint");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    client_secret: input.clientSecret,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    signal: withTimeout(DEFAULT_TIMEOUT_MS),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as
    | OidcTokenResponse
    | { error?: string; error_description?: string };

  if (!response.ok) {
    const errorDescription =
      (payload as { error_description?: string }).error_description ??
      (payload as { error?: string }).error ??
      `HTTP ${response.status}`;
    throw new Error(`OIDC token exchange failed: ${errorDescription}`);
  }

  const tokenPayload = payload as OidcTokenResponse;
  if (!tokenPayload.id_token) {
    throw new Error("OIDC token response missing id_token");
  }
  return tokenPayload;
}

export async function verifyIdToken(input: {
  idToken: string;
  issuer: string;
  audience: string;
  jwksUri: string;
  nonce: string;
}): Promise<VerifiedIdToken> {
  const issuer = ensureHttpsOrHttp(input.issuer, "issuer");
  const jwksUri = ensureHttpsOrHttp(input.jwksUri, "jwks uri");
  const jwks = createRemoteJWKSet(new URL(jwksUri));

  const { payload } = await jwtVerify(input.idToken, jwks, {
    issuer,
    audience: input.audience,
  });

  if (!payload.nonce || payload.nonce !== input.nonce) {
    throw new Error("Invalid OIDC nonce");
  }

  return { payload };
}
