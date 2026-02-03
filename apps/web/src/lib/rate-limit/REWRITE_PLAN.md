# Rate Limit Rewrite Plan (Scaffold)

Goal: Replace fragile IP-trusting behavior with a safer, auditable, and consistent rate-limiting approach.

Key objectives:

- Use a stableClientKey instead of raw IP headers for identity. Options include:
  - Verified client IP when TRUST_PROXY is configured and trusted
  - Device fingerprinting fallback (user-agent + accept headers hash) with rate limits scoped by email/token where applicable
- Unify requestId propagation: accept optional requestId in all public limiters and use it for correlated logs/metrics
- Prefer Upstash Redis in production but keep in-memory fallback for local/dev with consistent semantics
- Add analytics hooks (events) for blocked attempts with minimal PII (first 3 chars of email, site slug, token prefix)
- Defensive header handling and a feature flag to disable IP-based keys when proxies are untrusted

Implementation milestones:

1. Add helper getStableClientKey(headers, options?) and tests
2. Update all check\*RateLimit functions to accept options { requestId?: string, clientKey?: string }
3. Add configuration gating for TRUST_PROXY (env) and Upstash readiness checks
4. Add observability: counters and audit log entries with truncated PII
5. Add unit tests for spoofing-resistant behavior and integration tests that exercise Upstash vs in-memory fallback

Files to modify:

- src/lib/rate-limit/index.ts
- src/lib/rate-limit/client.ts
- Add tests under src/lib/rate-limit/**tests**

Notes:

- Keep the existing public API stable where possible (backwards compatible overloads)
- Add backward-compatible deprecation notes for any behavior changes
- Coordinate with infra for any Upstash configuration changes

Progress update (Jan 28, 2026):

- **Completed:** Added `getStableClientKey` helper and tests, updated `check*RateLimit` functions to accept `{ requestId?, clientKey? }` and avoid calling `headers()` when `clientKey` is provided, and added unit tests covering the new behavior. Also added a `loginAction` unit test ensuring the limiter is used and login succeeds when allowed.
- **Next steps:** Implement analytics backend integration (optional endpoint via RATE_LIMIT_TELEMETRY_URL), gate IP usage on TRUST_PROXY, add end-to-end tests for Upstash vs in-memory behaviors, and add monitoring alerts for blocked event spikes.

Recent additions:

- Telemetry: lightweight telemetry helper with optional external endpoint support (`RATE_LIMIT_TELEMETRY_URL`) and unit tests.
- Upstash E2E scaffold: `src/lib/rate-limit/__tests__/upstash.e2e.test.ts` that runs only when Upstash env vars are configured.
