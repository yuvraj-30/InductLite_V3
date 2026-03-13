import { afterEach, describe, expect, it } from "vitest";
import { getSessionOptions, shouldUseSecureCookies } from "./session-config";

const ORIGINAL_ENV = { ...process.env };
const TEST_ENV = process.env as Record<string, string | undefined>;

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
}

afterEach(() => {
  restoreEnv();
});

function secureCookieFlag(): boolean | undefined {
  return getSessionOptions().cookieOptions?.secure;
}

describe("session-config", () => {
  it("imports module without throwing", () => {
    expect(getSessionOptions()).toBeDefined();
  });

  it("disables secure cookies for local HTTP origins even in production", () => {
    TEST_ENV.NODE_ENV = "production";
    process.env.BASE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    delete process.env.SESSION_COOKIE_SECURE;

    expect(shouldUseSecureCookies()).toBe(false);
    expect(secureCookieFlag()).toBe(false);
  });

  it("enables secure cookies for non-local production origins by default", () => {
    TEST_ENV.NODE_ENV = "production";
    process.env.BASE_URL = "https://app.example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
    delete process.env.SESSION_COOKIE_SECURE;

    expect(shouldUseSecureCookies()).toBe(true);
    expect(secureCookieFlag()).toBe(true);
  });

  it("honors explicit secure-cookie overrides", () => {
    TEST_ENV.NODE_ENV = "production";
    process.env.BASE_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    process.env.SESSION_COOKIE_SECURE = "1";
    expect(shouldUseSecureCookies()).toBe(true);
    expect(secureCookieFlag()).toBe(true);

    process.env.SESSION_COOKIE_SECURE = "0";
    expect(shouldUseSecureCookies()).toBe(false);
    expect(secureCookieFlag()).toBe(false);
  });
});
