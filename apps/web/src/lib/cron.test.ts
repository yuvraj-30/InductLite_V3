import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireCronSecret } from "./cron";

describe("Cron Security Integration", () => {
  const CRON_SECRET = "test-cron-secret";

  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("TRUST_PROXY", "0");
    vi.stubEnv("CRON_ALLOW_PRIVATE_IPS", "1");
    vi.stubEnv("CRON_ALLOW_GITHUB_ACTIONS", "0"); // Disable fetch for tests
    vi.stubEnv("CRON_ALLOWED_IPS", "192.168.1.1");
  });

  it("should fail when secret is invalid", async () => {
    const req = new Request("http://localhost/api/cron/test", {
      headers: { "x-cron-secret": "wrong-secret" },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("should fail when secret is valid but IP is not allow-listed", async () => {
    const req = new Request("http://localhost/api/cron/test", {
      headers: {
        "x-cron-secret": CRON_SECRET,
        "x-real-ip": "1.1.1.1",
      },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("should pass when secret is valid and IP is localhost", async () => {
    // Note: requireCronSecret allows 127.0.0.1 if CRON_ALLOW_RENDER_INTERNAL=1
    vi.stubEnv("CRON_ALLOW_RENDER_INTERNAL", "1");

    const req = new Request("http://localhost/api/cron/test", {
      headers: {
        "x-cron-secret": CRON_SECRET,
        "x-real-ip": "127.0.0.1",
      },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(true);
  });

  it("should pass when secret is valid and IP is in allowlist", async () => {
    const req = new Request("http://localhost/api/cron/test", {
      headers: {
        "x-cron-secret": CRON_SECRET,
        "x-real-ip": "192.168.1.1",
      },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(true);
  });

  it("should parse trusted x-forwarded-for and allow CIDR ranges", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    vi.stubEnv("CRON_ALLOWED_IPS", "203.0.113.0/24");
    vi.stubEnv("CRON_ALLOW_PRIVATE_IPS", "0");

    const req = new Request("http://localhost/api/cron/test", {
      headers: {
        "x-cron-secret": CRON_SECRET,
        "x-forwarded-for": "203.0.113.45, 10.0.0.2",
      },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(true);
  });

  it("should allow GitHub IPv6 ranges when enabled", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    vi.stubEnv("CRON_ALLOW_PRIVATE_IPS", "0");
    vi.stubEnv("CRON_ALLOW_GITHUB_ACTIONS", "1");
    vi.stubEnv("CRON_ALLOWED_IPS", "");

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ actions: ["2603:1020::/47"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const req = new Request("http://localhost/api/cron/test", {
      headers: {
        "x-cron-secret": CRON_SECRET,
        "x-forwarded-for": "2603:1020::1234",
      },
    });

    const result = await requireCronSecret(req, "/api/cron/test");
    expect(result.ok).toBe(true);

    fetchSpy.mockRestore();
  });
});
