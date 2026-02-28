import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { BlockList, isIP } from "node:net";

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

  let candidate = trimmed;

  if (candidate.startsWith("for=")) {
    candidate = candidate.slice(4);
  }

  // Remove surrounding quotes in forwarded header values.
  candidate = candidate.replace(/^"|"$/g, "");

  // IPv6 with brackets, e.g. [2603:1020::1]:443
  if (candidate.startsWith("[")) {
    const end = candidate.indexOf("]");
    if (end > 0) {
      candidate = candidate.slice(1, end);
    }
  }

  // Direct IP value (IPv4 or IPv6).
  if (isIP(candidate)) {
    return candidate;
  }

  // IPv4 with port, e.g. 203.0.113.10:443
  const lastColon = candidate.lastIndexOf(":");
  if (lastColon > 0 && candidate.indexOf(":") === lastColon) {
    const noPort = candidate.slice(0, lastColon);
    if (isIP(noPort) === 4) {
      return noPort;
    }
  }

  return null;
}

function extractForwardedIps(input: string | null | undefined): string[] {
  if (!input) return [];
  const values = input
    .split(",")
    .map((entry) => normalizeIp(entry))
    .filter((entry): entry is string => Boolean(entry));
  return [...new Set(values)];
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

function isIpInCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes("/")) return ip === cidr;

  const [range, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!range || Number.isNaN(bits)) return false;

  const ipVersion = isIP(ip);
  const rangeVersion = isIP(range);
  if (!ipVersion || !rangeVersion || ipVersion !== rangeVersion) {
    return false;
  }

  const maxBits = ipVersion === 4 ? 32 : 128;
  if (bits < 0 || bits > maxBits) return false;

  const blockList = new BlockList();
  blockList.addSubnet(range, bits, ipVersion === 4 ? "ipv4" : "ipv6");
  return blockList.check(ip, ipVersion === 4 ? "ipv4" : "ipv6");
}

function isPrivateIpv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;

  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;
  return (
    // 10.0.0.0/8
    (ipInt & 0xff000000) === 0x0a000000 ||
    // 172.16.0.0/12
    (ipInt & 0xfff00000) === 0xac100000 ||
    // 192.168.0.0/16
    (ipInt & 0xffff0000) === 0xc0a80000
  );
}

function getClientIps(req: Request): string[] {
  const trustProxy = process.env.TRUST_PROXY === "1";
  const candidates: string[] = [];

  const pushCandidate = (ip: string | null) => {
    if (!ip) return;
    if (!candidates.includes(ip)) {
      candidates.push(ip);
    }
  };

  if (trustProxy) {
    // Prefer CDN/proxy-provided direct client IP first when present.
    pushCandidate(normalizeIp(req.headers.get("cf-connecting-ip")));

    // Then evaluate the forwarded chain. Some proxies prepend internal hops.
    for (const forwarded of extractForwardedIps(req.headers.get("x-forwarded-for"))) {
      pushCandidate(forwarded);
    }
  }

  pushCandidate(normalizeIp(req.headers.get("x-real-ip")));
  pushCandidate(normalizeIp(req.headers.get("x-client-ip")));

  return candidates;
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
  return allowlist.some((entry) => isIpInCidr(ip, entry));
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
      response: NextResponse.json(
        { error: "Unauthorized", code: "cron_secret_mismatch" },
        { status: 401 },
      ),
    };
  }

  const clientIps = getClientIps(req);
  if (clientIps.length === 0) {
    log.warn({ path }, "Cron request missing client IP");
    return {
      ok: false,
      log,
      response: NextResponse.json(
        { error: "Forbidden", code: "cron_ip_missing" },
        { status: 403 },
      ),
    };
  }

  const allowlist = parseIpList(process.env.CRON_ALLOWED_IPS);
  const allowPrivate = process.env.CRON_ALLOW_PRIVATE_IPS === "1";
  const allowGithub = process.env.CRON_ALLOW_GITHUB_ACTIONS !== "0";
  const allowRender = process.env.CRON_ALLOW_RENDER_INTERNAL === "1";
  let matchedIp: string | null = null;
  const matchIp = (predicate: (ip: string) => boolean): boolean => {
    for (const candidateIp of clientIps) {
      if (predicate(candidateIp)) {
        matchedIp = candidateIp;
        return true;
      }
    }
    return false;
  };

  let allowed = false;
  if (matchIp((ip) => isIpAllowed(ip, allowlist))) {
    allowed = true;
  }

  if (!allowed && allowPrivate && matchIp((ip) => isPrivateIpv4(ip))) {
    allowed = true;
  }

  if (
    !allowed &&
    allowRender &&
    matchIp((ip) => ip === "127.0.0.1" || ip === "::1" || isPrivateIpv4(ip))
  ) {
    allowed = true;
  }

  if (!allowed && allowGithub) {
    try {
      const ranges = await getGithubActionsRanges();
      if (matchIp((ip) => isIpAllowed(ip, ranges))) {
        allowed = true;
      }
    } catch (err) {
      log.warn({ path, err: String(err) }, "GitHub meta lookup failed");
    }
  }

  if (!allowed) {
    log.warn({ path, client_ips: clientIps }, "Cron IP not allowed");
    return {
      ok: false,
      log,
      response: NextResponse.json(
        { error: "Forbidden", code: "cron_ip_not_allowed" },
        { status: 403 },
      ),
    };
  }

  log.info({ path, client_ips: clientIps, matched_ip: matchedIp }, "Cron auth allowed");
  return { ok: true, log };
}
