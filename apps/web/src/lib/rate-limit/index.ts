/**
 * Rate Limiting Module
 *
 * Provides rate limiting for public endpoints to prevent abuse.
 * Uses in-memory storage for development, Upstash Redis for production.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";
import { createRequestLogger } from "@/lib/logger";
import { generateRequestId } from "@/lib/auth/csrf";
import { getRedisClient } from "./client";
import { getStableClientKey } from "./clientKey";
import { recordRateLimitBlocked } from "./telemetry";

const E2E_QUIET = (() => {
  const v = process.env.E2E_QUIET;
  return v === "1" || v?.toLowerCase() === "true";
})();

function getTestRunId(): string | null {
  const allowTestRunner =
    process.env.NODE_ENV === "test" || process.env.ALLOW_TEST_RUNNER === "1";
  if (!allowTestRunner) return null;

  const isCi = process.env.CI === "true" || process.env.CI === "1";
  if (!isCi) return null;

  return (
    process.env.TEST_RUN_ID ||
    process.env.GITHUB_RUN_ID ||
    process.env.GITHUB_RUN_NUMBER ||
    null
  );
}

const TEST_RUN_ID = getTestRunId();
const TEST_RUN_PREFIX = TEST_RUN_ID ? `run:${TEST_RUN_ID}:` : "";

/**
 * In-memory fallback for development (when Redis is not configured)
 */
class InMemoryStore {
  private cache = new Map<string, { count: number; resetAt: number }>();

  async get(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return 0;
    if (Date.now() > entry.resetAt) {
      this.cache.delete(key);
      return 0;
    }
    return entry.count;
  }

  async incr(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (!entry || now > entry.resetAt) {
      this.cache.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }

    entry.count++;
    return entry.count;
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetAt) {
        this.cache.delete(key);
      }
    }
  }

  // Test helper to clear the in-memory store
  clear(): void {
    this.cache.clear();
  }

  // Test helper to clear keys by prefix (e.g. per-client or per-worker)
  clearPrefix(prefix: string): void {
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

// Exported for tests only
export function __test_clearInMemoryStore() {
  inMemoryStore.clear();
}

// Clear rate limit keys related to a specific clientKey (used by tests to avoid global clears)
export async function __test_clearInMemoryStoreForClient(clientKey: string) {
  // login:<clientKey>:..., signin:<clientKey>:..., public-slug:<clientKey>
  const runPrefix = TEST_RUN_PREFIX;
  inMemoryStore.clearPrefix(`${runPrefix}login:${clientKey}:`);
  inMemoryStore.clearPrefix(`${runPrefix}signin:${clientKey}:`);
  inMemoryStore.clearPrefix(`${runPrefix}public-slug:${clientKey}`);
  inMemoryStore.clearPrefix(`${runPrefix}signin-site:`);
  inMemoryStore.clearPrefix(`${runPrefix}signout:${clientKey}:`);

  // If Redis is available, try to remove keys with these prefixes as well.
  try {
    const redis = getRedisClient();
    if (redis) {
      const prefixes = [
        `inductlite:login-ratelimit`,
        `inductlite:signin-ratelimit`,
        `inductlite:signin-site-ratelimit`,
        `inductlite:ratelimit`,
      ];
      for (const prefix of prefixes) {
        // Attempt a pattern-based scan and delete; this is best-effort and will be noisy on large DBs,
        // but in test environments the dataset is small and acceptable.
        const pattern = `${prefix}*${runPrefix}*${clientKey}*`;
        try {
          // Narrow the Redis client to only the methods we need for cleanup
          const r = redis as unknown as {
            scan?: (
              cursor: number | string,
              ...args: any[]
            ) => Promise<[number | string, string[]]>;
            scanIterator?: (opts?: any) => AsyncIterableIterator<string>;
            del?: (key: string) => Promise<void>;
          };

          // Many Redis clients expose scanIterator - try to use it if present
          if (typeof r.scanIterator === "function") {
            for await (const key of r.scanIterator!({ MATCH: pattern })) {
              await r.del!(key);
            }
          } else if (typeof r.scan === "function") {
            // Fallback: perform a simple SCAN loop
            let cursor: number | string = 0;
            do {
              const [nextCursor, keys] = await r.scan!(
                cursor,
                "MATCH",
                pattern,
                "COUNT",
                100,
              );
              cursor = Number(nextCursor);
              for (const key of keys) {
                await r.del!(key);
              }
            } while (Number(cursor) !== 0);
          }
        } catch (cleanupErr) {
          if (!E2E_QUIET) {
            console.warn(
              "Redis cleanup by pattern failed:",
              String(cleanupErr),
            );
          }
        }
      }
    }
  } catch {
    // Non-fatal; best-effort cleanup
  }
}

const inMemoryStore = new InMemoryStore();

const RL_PUBLIC_SLUG_PER_IP_PER_MIN = Number(
  process.env.RL_PUBLIC_SLUG_PER_IP_PER_MIN ?? 10,
);
const RL_SIGNIN_PER_IP_PER_MIN = Number(
  process.env.RL_SIGNIN_PER_IP_PER_MIN ?? 30,
);
const RL_SIGNIN_PER_SITE_PER_MIN = Number(
  process.env.RL_SIGNIN_PER_SITE_PER_MIN ?? 200,
);
const RL_SIGNOUT_PER_IP_PER_MIN = Number(
  process.env.RL_SIGNOUT_PER_IP_PER_MIN ?? 30,
);

// Clean up every minute
if (typeof setInterval !== "undefined") {
  setInterval(() => inMemoryStore.cleanup(), 60000);
}

/**
 * Create rate limiter instance using memoized Redis client.
 * Uses Upstash Redis in production, in-memory for dev.
 */
function createRateLimiter(): Ratelimit | null {
  const redis = getRedisClient();
  if (redis) {
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RL_PUBLIC_SLUG_PER_IP_PER_MIN, "60 s"),
      analytics: true,
      prefix: "inductlite:ratelimit",
    });
  }
  return null; // Use in-memory fallback
}

const rateLimiter = createRateLimiter();

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for public slug access
 *
 * @param slug - The public slug being accessed
 * @returns Rate limit result
 */
export async function checkPublicSlugRateLimit(
  slug: string,
  options?: { requestId?: string; clientKey?: string },
): Promise<RateLimitResult> {
  const requestId = options?.requestId ?? generateRequestId();
  const log = createRequestLogger(requestId);

  // In test or when test runner is enabled, avoid strict rate limiting to prevent
  // test flakes where repeated metadata + render requests or retries hit the limit.
  // When running the test runner in a real environment, allow a high limit to avoid flakes.
  // Do NOT bypass rate limiting by default during unit tests - tests expect the in-memory limiter behavior.
  if (process.env.ALLOW_TEST_RUNNER === "1") {
    return {
      success: true,
      limit: 1000,
      remaining: 1000,
      reset: Date.now() + 60_000,
    };
  }

  let clientKey: string;
  if (options?.clientKey) {
    clientKey = options.clientKey;
  } else {
    const headersList = await headers();
    const headersObj: Record<string, string | undefined> = {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? undefined,
      "x-real-ip": headersList.get("x-real-ip") ?? undefined,
      "user-agent": headersList.get("user-agent") ?? undefined,
      accept: headersList.get("accept") ?? undefined,
    };

    clientKey = getStableClientKey(headersObj, {
      trustProxy: process.env.TRUST_PROXY === "1",
    });
  }

  const key = `${TEST_RUN_PREFIX}public-slug:${clientKey}`;

  // Use Upstash rate limiter if available
  if (rateLimiter) {
    const result = await rateLimiter.limit(key);

    if (!result.success) {
      log.warn(
        { clientKey, slug, remaining: result.remaining },
        "Rate limit exceeded for public slug access",
      );
      recordRateLimitBlocked({
        kind: "public-slug",
        clientKey,
        meta: { slug },
      });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // In-memory fallback for development
  const windowMs = 60000; // 1 minute
  const limit = RL_PUBLIC_SLUG_PER_IP_PER_MIN;
  const count = await inMemoryStore.incr(key, windowMs);
  const remaining = Math.max(0, limit - count);
  const success = count <= limit;

  if (!success) {
    log.warn(
      { clientKey, slug, count, limit },
      "Rate limit exceeded (in-memory)",
    );
    recordRateLimitBlocked({ kind: "public-slug", clientKey, meta: { slug } });
  }

  return {
    success,
    limit,
    remaining,
    reset: Date.now() + windowMs,
  };
}

/**
 * Check rate limit for login attempts
 * More restrictive: 5 attempts per 15 minutes
 */
export async function checkLoginRateLimit(
  email: string,
  options?: { requestId?: string; clientKey?: string },
): Promise<RateLimitResult> {
  const requestId = options?.requestId ?? generateRequestId();
  const log = createRequestLogger(requestId);

  // In test mode, avoid strict rate limiting unless the test explicitly
  // opts in by setting the header 'x-enforce-login-ratelimit'. This prevents
  // accidental flakes when tests run in parallel and hit the in-memory limit.
  if (
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_TEST_RUNNER === "1"
  ) {
    try {
      const headersList = await headers();
      if (!headersList.get("x-enforce-login-ratelimit")) {
        return {
          success: true,
          limit: 1000,
          remaining: 1000,
          reset: Date.now() + 15 * 60 * 1000,
        };
      }
    } catch {
      // If headers() is unavailable for some reason, fall back to normal behavior
    }
  }

  let clientKey: string;
  if (options?.clientKey) {
    clientKey = options.clientKey;
  } else {
    const headersList = await headers();
    const headersObj: Record<string, string | undefined> = {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? undefined,
      "x-real-ip": headersList.get("x-real-ip") ?? undefined,
      "user-agent": headersList.get("user-agent") ?? undefined,
      accept: headersList.get("accept") ?? undefined,
    };

    clientKey = getStableClientKey(headersObj, {
      trustProxy: process.env.TRUST_PROXY === "1",
    });
  }

  // Rate limit by both clientKey and email to prevent distributed attacks
  const key = `${TEST_RUN_PREFIX}login:${clientKey}:${email.toLowerCase()}`;

  const redis = getRedisClient();
  if (redis) {
    // Create a stricter limiter for login using memoized client
    const loginLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
      analytics: true,
      prefix: "inductlite:login-ratelimit",
    });

    const result = await loginLimiter.limit(key);

    if (!result.success) {
      log.warn(
        { clientKey, email: email.substring(0, 3) + "***" },
        "Login rate limit exceeded",
      );
      recordRateLimitBlocked({ kind: "login", clientKey, meta: { email } });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // In-memory fallback
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const limit = 5;
  const count = await inMemoryStore.incr(key, windowMs);
  const remaining = Math.max(0, limit - count);
  const success = count <= limit;

  if (!success) {
    log.warn(
      { clientKey, email: email.substring(0, 3) + "***" },
      "Login rate limit exceeded (in-memory)",
    );
    recordRateLimitBlocked({ kind: "login", clientKey, meta: { email } });
  }

  return {
    success,
    limit,
    remaining,
    reset: Date.now() + windowMs,
  };
}

/**
 * Check rate limit for public sign-in submissions
 * Guardrails: 30 per minute per IP + 200 per minute per site
 */
export async function checkSignInRateLimit(
  siteSlug: string,
  options?: { requestId?: string; clientKey?: string },
): Promise<RateLimitResult> {
  const requestId = options?.requestId ?? generateRequestId();
  const log = createRequestLogger(requestId);

  let clientKey: string;
  if (options?.clientKey) {
    clientKey = options.clientKey;
  } else {
    const headersList = await headers();
    const headersObj: Record<string, string | undefined> = {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? undefined,
      "x-real-ip": headersList.get("x-real-ip") ?? undefined,
      "user-agent": headersList.get("user-agent") ?? undefined,
      accept: headersList.get("accept") ?? undefined,
    };

    clientKey = getStableClientKey(headersObj, {
      trustProxy: process.env.TRUST_PROXY === "1",
    });
  }

  const key = `${TEST_RUN_PREFIX}signin:${clientKey}:${siteSlug}`;
  const siteKey = `${TEST_RUN_PREFIX}signin-site:${siteSlug}`;

  const redis = getRedisClient();
  if (redis) {
    try {
      const signInLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(RL_SIGNIN_PER_IP_PER_MIN, "1 m"),
        analytics: true,
        prefix: "inductlite:signin-ratelimit",
      });

      const siteLimiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(RL_SIGNIN_PER_SITE_PER_MIN, "1 m"),
        analytics: true,
        prefix: "inductlite:signin-site-ratelimit",
      });

      const [ipResult, siteResult] = await Promise.all([
        signInLimiter.limit(key),
        siteLimiter.limit(siteKey),
      ]);

      const success = ipResult.success && siteResult.success;
      if (!success) {
        log.warn({ clientKey, siteSlug }, "Sign-in rate limit exceeded");
        recordRateLimitBlocked({
          kind: "signin",
          clientKey,
          meta: { siteSlug },
        });
      }

      return {
        success,
        limit: Math.min(ipResult.limit, siteResult.limit),
        remaining: Math.min(ipResult.remaining, siteResult.remaining),
        reset: Math.max(ipResult.reset, siteResult.reset),
      };
    } catch (error) {
      log.warn(
        {
          clientKey,
          siteSlug,
          error: error instanceof Error ? error.message : String(error),
        },
        "Redis sign-in rate limiter unavailable, falling back to in-memory",
      );
    }
  }

  // In-memory fallback
  const windowMs = 60 * 1000; // 1 minute
  const ipCount = await inMemoryStore.incr(key, windowMs);
  const siteCount = await inMemoryStore.incr(siteKey, windowMs);
  const ipRemaining = Math.max(0, RL_SIGNIN_PER_IP_PER_MIN - ipCount);
  const siteRemaining = Math.max(0, RL_SIGNIN_PER_SITE_PER_MIN - siteCount);
  const success =
    ipCount <= RL_SIGNIN_PER_IP_PER_MIN &&
    siteCount <= RL_SIGNIN_PER_SITE_PER_MIN;

  if (!success) {
    log.warn(
      { clientKey, siteSlug },
      "Sign-in rate limit exceeded (in-memory)",
    );
    recordRateLimitBlocked({ kind: "signin", clientKey, meta: { siteSlug } });
  }

  return {
    success,
    limit: Math.min(RL_SIGNIN_PER_IP_PER_MIN, RL_SIGNIN_PER_SITE_PER_MIN),
    remaining: Math.min(ipRemaining, siteRemaining),
    reset: Date.now() + windowMs,
  };
}

/**
 * Check rate limit for sign-out attempts
 * Guardrails: 30 per minute per token/IP
 */
export async function checkSignOutRateLimit(
  tokenPrefix: string,
  options?: { requestId?: string; clientKey?: string },
): Promise<RateLimitResult> {
  const requestId = options?.requestId ?? generateRequestId();
  const log = createRequestLogger(requestId);

  let clientKey: string;
  if (options?.clientKey) {
    clientKey = options.clientKey;
  } else {
    const headersList = await headers();
    const headersObj: Record<string, string | undefined> = {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? undefined,
      "x-real-ip": headersList.get("x-real-ip") ?? undefined,
      "user-agent": headersList.get("user-agent") ?? undefined,
      accept: headersList.get("accept") ?? undefined,
    };

    clientKey = getStableClientKey(headersObj, {
      trustProxy: process.env.TRUST_PROXY === "1",
    });
  }

  const key = `${TEST_RUN_PREFIX}signout:${clientKey}:${tokenPrefix}`;

  const redis = getRedisClient();
  if (redis) {
    const signOutLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(RL_SIGNOUT_PER_IP_PER_MIN, "1 m"),
      analytics: true,
      prefix: "inductlite:signout-ratelimit",
    });

    const result = await signOutLimiter.limit(key);

    if (!result.success) {
      log.warn({ clientKey }, "Sign-out rate limit exceeded");
      recordRateLimitBlocked({
        kind: "signout",
        clientKey,
        meta: { tokenPrefix },
      });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // In-memory fallback
  const windowMs = 60 * 1000;
  const limit = RL_SIGNOUT_PER_IP_PER_MIN;
  const count = await inMemoryStore.incr(key, windowMs);
  const remaining = Math.max(0, limit - count);
  const success = count <= limit;

  if (!success) {
    log.warn({ clientKey }, "Sign-out rate limit exceeded (in-memory)");
    recordRateLimitBlocked({
      kind: "signout",
      clientKey,
      meta: { tokenPrefix },
    });
  }

  return {
    success,
    limit,
    remaining,
    reset: Date.now() + windowMs,
  };
}

/**
 * Check rate limit for CSP violation reports.
 *
 * These endpoints can be abused to cause log/CPU amplification. Keep it cheap.
 * Default: 60 requests per minute per client key (configurable).
 */
export async function checkCspReportRateLimit(options?: {
  requestId?: string;
  clientKey?: string;
}): Promise<RateLimitResult> {
  const requestId = options?.requestId ?? generateRequestId();
  const log = createRequestLogger(requestId);

  let clientKey: string;
  if (options?.clientKey) {
    clientKey = options.clientKey;
  } else {
    const headersList = await headers();
    const headersObj: Record<string, string | undefined> = {
      "x-forwarded-for": headersList.get("x-forwarded-for") ?? undefined,
      "x-real-ip": headersList.get("x-real-ip") ?? undefined,
      "user-agent": headersList.get("user-agent") ?? undefined,
      accept: headersList.get("accept") ?? undefined,
    };
    clientKey = getStableClientKey(headersObj, {
      trustProxy: process.env.TRUST_PROXY === "1",
    });
  }

  const limit = Number(process.env.CSP_REPORT_RL_PER_MIN ?? "60");
  const windowMs = 60_000;
  const key = `csp-report:${clientKey}`;

  // Use Redis if available.
  const redis = getRedisClient();
  if (redis) {
    const limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, "60 s"),
      analytics: true,
      prefix: "inductlite:csp-report-ratelimit",
    });

    const result = await limiter.limit(key);
    if (!result.success) {
      log.warn({ clientKey }, "CSP report rate limit exceeded");
      recordRateLimitBlocked({ kind: "csp-report", clientKey });
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  // In-memory fallback
  const count = await inMemoryStore.incr(key, windowMs);
  const remaining = Math.max(0, limit - count);
  const success = count <= limit;

  if (!success) {
    log.warn({ clientKey }, "CSP report rate limit exceeded (in-memory)");
    recordRateLimitBlocked({ kind: "csp-report", clientKey });
  }

  return {
    success,
    limit,
    remaining,
    reset: Date.now() + windowMs,
  };
}
