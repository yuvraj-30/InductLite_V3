import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ensureTestRouteAccess } from "../_guard";

describe("ensureTestRouteAccess", () => {
  const originalEnv = process.env;
  const setNodeEnv = (value: string) => {
    Object.defineProperty(process.env, "NODE_ENV", {
      value,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ALLOW_TEST_RUNNER;
    delete process.env.TEST_RUNNER_SECRET_KEY;
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("allows when NODE_ENV is test", () => {
    setNodeEnv("test");
    const req = new Request("http://localhost/api/test/create-user");
    const result = ensureTestRouteAccess(req);
    expect(result).toBeNull();
  });

  it("blocks in production by default", () => {
    setNodeEnv("production");
    process.env.TEST_RUNNER_SECRET_KEY = "top-secret";
    const req = new Request("http://localhost/api/test/create-user", {
      headers: { "x-test-secret": "top-secret" },
    });
    const result = ensureTestRouteAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(404);
  });

  it("blocks in production with ALLOW_TEST_RUNNER=1 and missing CI", () => {
    setNodeEnv("production");
    process.env.ALLOW_TEST_RUNNER = "1";
    process.env.TEST_RUNNER_SECRET_KEY = "top-secret";
    const req = new Request("http://localhost/api/test/create-user", {
      headers: { "x-test-secret": "top-secret" },
    });
    const result = ensureTestRouteAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(404);
  });

  it("blocks in production with CI + ALLOW_TEST_RUNNER and invalid secret", () => {
    setNodeEnv("production");
    process.env.CI = "true";
    process.env.ALLOW_TEST_RUNNER = "1";
    process.env.TEST_RUNNER_SECRET_KEY = "top-secret";
    const req = new Request("http://localhost/api/test/create-user", {
      headers: { "x-test-secret": "wrong" },
    });
    const result = ensureTestRouteAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(404);
  });

  it("allows in production only for CI with ALLOW_TEST_RUNNER + matching secret", () => {
    setNodeEnv("production");
    process.env.CI = "true";
    process.env.ALLOW_TEST_RUNNER = "1";
    process.env.TEST_RUNNER_SECRET_KEY = "top-secret";
    const req = new Request("http://localhost/api/test/create-user", {
      headers: { "x-test-secret": "top-secret" },
    });
    const result = ensureTestRouteAccess(req);
    expect(result).toBeNull();
  });

  it("allows in non-test env when ALLOW_TEST_RUNNER=1", () => {
    setNodeEnv("development");
    process.env.ALLOW_TEST_RUNNER = "1";
    const req = new Request("http://localhost/api/test/create-user");
    const result = ensureTestRouteAccess(req);
    expect(result).toBeNull();
  });

  it("blocks in non-test non-production environments by default", () => {
    setNodeEnv("development");
    const req = new Request("http://localhost/api/test/create-user");
    const result = ensureTestRouteAccess(req);
    expect(result).not.toBeNull();
    expect(result?.status).toBe(404);
  });
});
