import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { checkCspReportRateLimit } from "@/lib/rate-limit";
import { getStableClientKey } from "@/lib/rate-limit/clientKey";

// Force Node runtime so env access is consistent with the rest of the app.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024; // 16KB

// Type for CSP report (legacy and Reporting API formats)
interface CspReportLegacy {
  "blocked-uri"?: string;
  "document-uri"?: string;
  "effective-directive"?: string;
  [key: string]: unknown;
}

interface CspReportNew {
  blockedURL?: string;
  documentURL?: string;
  effectiveDirective?: string;
  [key: string]: unknown;
}

interface CspReportWrapper {
  "csp-report"?: CspReportLegacy | CspReportNew;
}

type CspReportAny =
  | CspReportLegacy
  | CspReportNew
  | CspReportWrapper
  | CspReportWrapper[];

function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const u = new URL(input);
    // Strip query/fragment to avoid logging tokens.
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // Always return 204 to avoid being used as an oracle.
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId);

  // Quick length check.
  const cl = req.headers.get("content-length");
  if (cl && Number.isFinite(Number(cl)) && Number(cl) > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  // Rate limit by stable client key.
  const headersObj: Record<string, string | undefined> = {
    "x-forwarded-for": req.headers.get("x-forwarded-for") ?? undefined,
    "x-real-ip": req.headers.get("x-real-ip") ?? undefined,
    "user-agent": req.headers.get("user-agent") ?? undefined,
    accept: req.headers.get("accept") ?? undefined,
  };
  const clientKey = getStableClientKey(headersObj, {
    trustProxy: process.env.TRUST_PROXY === "1",
  });

  const rl = await checkCspReportRateLimit({ requestId, clientKey });
  if (!rl.success) {
    return new NextResponse(null, { status: 204 });
  }

  // Best-effort parsing.
  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = safeJsonParse(raw) as CspReportAny | null;
  // CSP can arrive as { "csp-report": {...} } or Reporting API array entries.
  function extractReport(
    data: CspReportAny | null,
  ): CspReportLegacy | CspReportNew | null {
    if (!data || typeof data !== "object") return null;
    if (Array.isArray(data)) {
      const first = data[0];
      if (!first || typeof first !== "object") return null;
      return first as CspReportLegacy | CspReportNew;
    }
    if ("csp-report" in data && data["csp-report"])
      return data["csp-report"] as CspReportLegacy | CspReportNew;
    return data as CspReportLegacy | CspReportNew;
  }
  const report = extractReport(parsed);

  const blocked = sanitizeUrl(
    report?.["blocked-uri"] ?? (report as CspReportNew)?.blockedURL,
  );
  const doc = sanitizeUrl(
    report?.["document-uri"] ?? (report as CspReportNew)?.documentURL,
  );
  const effectiveDirective =
    (typeof report?.["effective-directive"] === "string"
      ? report["effective-directive"]
      : typeof (report as CspReportNew)?.effectiveDirective === "string"
        ? (report as CspReportNew).effectiveDirective
        : null) ?? null;

  // Keep logs minimal and non-sensitive.
  log.warn(
    {
      event: "csp_violation",
      clientKey,
      effectiveDirective,
      blocked,
      document: doc,
    },
    "CSP violation report",
  );

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  // Not a public endpoint; return 204 to minimize noise.
  return new NextResponse(null, { status: 204 });
}
