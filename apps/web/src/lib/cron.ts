import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";

const GITHUB_META_URL = "https://api.github.com/meta";
const GITHUB_ACTIONS_CACHE_TTL_MS = 60 * 60 * 1000;

let githubActionsCache: { ranges: string[]; fetchedAt: number } | null = null;

function parseIpList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeIp(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    if (end > 0) return trimmed.slice(1, end);
  }
  const first = trimmed.split(":")[0];
  return first || null;
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  const [a, b, c, d] = nums;
  if ([a, b, c, d].some((n) => n === undefined)) return null;
  return (
    (((a as number) << 24) +
      ((b as number) << 16) +
      ((c as number) << 8) +
      (d as number)) >>>
    0
  );
}

function isIpv4InCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;
  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!range || Number.isNaN(bits)) return false;
  const ipInt = ipToInt(ip);
  const rangeInt = ipToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isPrivateIpv4(ip: string): boolean {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;
  const ranges: Array<[string, number]> = [
    ["10.0.0.0", 8],
    ["172.16.0.0", 12],
    ["192.168.0.0", 16],
  ];
  return ranges.some(([range, bits]) => isIpv4InCidr(ip, `${range}/${bits}`));
}

function getClientIp(req: Request): string | null {
  const trustProxy = process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const first = forwardedFor?.split(",")[0];
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }
  return normalizeIp(
    req.headers.get("x-real-ip") ?? req.headers.get("x-client-ip"),
  );
}

async function getGithubActionsRanges(): Promise<string[]> {
  const now = Date.now();
  if (
    githubActionsCache &&
    now - githubActionsCache.fetchedAt < GITHUB_ACTIONS_CACHE_TTL_MS
  ) {
    return githubActionsCache.ranges;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(GITHUB_META_URL, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`GitHub meta fetch failed: ${res.status}`);
    }
    const data = (await res.json()) as { actions?: string[] };
    const ranges = Array.isArray(data.actions) ? data.actions : [];
    githubActionsCache = { ranges, fetchedAt: now };
    return ranges;
  } finally {
    clearTimeout(timeout);
  }
}

function isIpAllowed(ip: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return false;
  return allowlist.some((entry) => isIpv4InCidr(ip, entry));
}

export async function requireCronSecret(
  req: Request,
  path: string,
): Promise<
  | { ok: true; log: ReturnType<typeof createRequestLogger> }
  | {
      ok: false;
      log: ReturnType<typeof createRequestLogger>;
      response: NextResponse;
    }
> {
  const log = createRequestLogger(generateRequestId(), {
    path,
    method: req.method,
  });

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    log.error({ path }, "Cron secret not configured");
    return {
      ok: false,
      log,
      response: NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 },
      ),
    };
  }

  const provided = req.headers.get("x-cron-secret") || "";
  if (provided !== expected) {
    log.warn({ path }, "Cron secret mismatch");
    return {
      ok: false,
      log,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const clientIp = getClientIp(req);
  if (!clientIp) {
    log.warn({ path }, "Cron request missing client IP");
    return {
      ok: false,
      log,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const allowlist = parseIpList(process.env.CRON_ALLOWED_IPS);
  const allowPrivate = process.env.CRON_ALLOW_PRIVATE_IPS === "1";
  const allowGithub = process.env.CRON_ALLOW_GITHUB_ACTIONS !== "0";
  const allowRender = process.env.CRON_ALLOW_RENDER_INTERNAL === "1";

  let allowed = false;
  if (isIpAllowed(clientIp, allowlist)) {
    allowed = true;
  }

  if (!allowed && allowPrivate && isPrivateIpv4(clientIp)) {
    allowed = true;
  }

  if (
    !allowed &&
    allowRender &&
    (clientIp === "127.0.0.1" || clientIp === "::1" || isPrivateIpv4(clientIp))
  ) {
    allowed = true;
  }

  if (!allowed && allowGithub) {
    try {
      const ranges = await getGithubActionsRanges();
      if (isIpAllowed(clientIp, ranges)) {
        allowed = true;
      }
    } catch (err) {
      log.warn({ path, err: String(err) }, "GitHub meta lookup failed");
    }
  }

  if (!allowed) {
    log.warn({ path, client_ip: clientIp }, "Cron IP not allowed");
    return {
      ok: false,
      log,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, log };
}
