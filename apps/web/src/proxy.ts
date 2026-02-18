import { NextRequest, NextResponse } from "next/server";

/**
 * Nonce-based Content Security Policy (CSP) proxy.
 *
 * Goals:
 * - Keep enforced CSP stable and production-safe.
 * - Allow a stricter Report-Only CSP to be rolled out safely using allowlists.
 * - Provide a per-request nonce via `x-nonce` so server components can attach it
 *   to any explicit <Script/> usage when needed.
 */

function toBase64(bytes: Uint8Array): string {
  // Edge runtime safe base64.
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]!);

  return btoa(binary);
}

function createNonce(): string {
  // 128-bit nonce is sufficient; CSP spec treats nonce as opaque.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toBase64(bytes);
}

function parseOriginsList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function safeOriginFromUrl(urlStr: string | undefined): string | null {
  if (!urlStr) return null;
  try {
    return new URL(urlStr).origin;
  } catch {
    return null;
  }
}

function buildEnforcedCsp(opts: {
  nonce: string;
  isProd: boolean;
  requestProtocol: string;
}): string {
  const { nonce, isProd, requestProtocol } = opts;

  // Note: Avoid `strict-dynamic` unless you have strong coverage; it can break
  // third-party scripts and some tooling. This policy is deliberately conservative.
  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    // Be permissive enough for signed URLs and image blobs.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Keep connect-src permissive for initial deployments; tighten via Report-Only.
    "connect-src 'self' https: wss:",
    // Production: no unsafe-eval. Dev: allow it for tooling.
    `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`,
    // Style nonces work best when inline styles are nonce-tagged; keep fallback in dev only.
    `style-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-inline'"}`,
  ];

  if (isProd && requestProtocol === "https:") {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

function buildReportOnlyCsp(opts: {
  nonce: string;
  isProd: boolean;
  reportEndpointAbs: string;
}): string {
  const { nonce, isProd, reportEndpointAbs } = opts;

  // Strict allowlists by default; tune with env vars.
  const s3Origin = safeOriginFromUrl(process.env.S3_ENDPOINT);

  const connectSrcDefault = [
    "'self'",
    // Upstash
    "https://api.upstash.com",
    "https://*.upstash.io",
    "wss://*.upstash.io",
    // Common object storage endpoints (keep as origins/wildcards)
    "https://*.amazonaws.com",
    "https://*.r2.cloudflarestorage.com",
  ];
  if (s3Origin) connectSrcDefault.push(s3Origin);

  const imgSrcDefault = ["'self'", "data:", "blob:"]; // add explicit origins via env
  if (s3Origin) imgSrcDefault.push(s3Origin);

  const connectSrc = parseOriginsList(process.env.CSP_RO_CONNECT_SRC);
  const imgSrc = parseOriginsList(process.env.CSP_RO_IMG_SRC);
  const fontSrc = parseOriginsList(process.env.CSP_RO_FONT_SRC);
  const frameSrc = parseOriginsList(process.env.CSP_RO_FRAME_SRC);

  const directives: string[] = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    `connect-src ${connectSrc.length ? connectSrc.join(" ") : connectSrcDefault.join(" ")}`,
    `img-src ${imgSrc.length ? imgSrc.join(" ") : imgSrcDefault.join(" ")}`,
    `font-src ${fontSrc.length ? fontSrc.join(" ") : "'self' data:"}`,
    `frame-src ${frameSrc.length ? frameSrc.join(" ") : "'self'"}`,
    `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`,
    `style-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-inline'"}`,
    `report-uri ${reportEndpointAbs}`,
  ];

  return directives.join("; ");
}

export function proxy(req: NextRequest) {
  const url = req.nextUrl;

  // Skip prefetches and obvious static assets.
  if (
    req.headers.get("x-middleware-prefetch") === "1" ||
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const isProd = process.env.NODE_ENV === "production";
  const nonce = createNonce();

  // Build absolute report endpoint (required by Report-To/Reporting-Endpoints and report-uri).
  const reportPath = process.env.CSP_REPORT_ENDPOINT || "/api/csp-report";
  const reportEndpointAbs = new URL(reportPath, url.origin).toString();

  const csp = buildEnforcedCsp({
    nonce,
    isProd,
    requestProtocol: url.protocol,
  });
  const reportOnlyEnabled = process.env.CSP_REPORT_ONLY === "1";
  const cspReportOnly = reportOnlyEnabled
    ? buildReportOnlyCsp({ nonce, isProd, reportEndpointAbs })
    : null;

  // Attach nonce to request so server components can read it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });

  res.headers.set("Content-Security-Policy", csp);

  if (cspReportOnly) {
    res.headers.set("Content-Security-Policy-Report-Only", cspReportOnly);

    // Reporting API (modern) + legacy Report-To.
    // Browsers vary; setting both is pragmatic.
    res.headers.set("Reporting-Endpoints", `csp=\"${reportEndpointAbs}\"`);
    res.headers.set(
      "Report-To",
      JSON.stringify({
        group: "csp",
        max_age: 10886400,
        endpoints: [{ url: reportEndpointAbs }],
      }),
    );
  }

  return res;
}

export const config = {
  matcher: ["/:path*"],
};
