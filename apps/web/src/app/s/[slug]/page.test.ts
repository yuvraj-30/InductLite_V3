import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  getSiteForSignIn: vi.fn(),
}));

vi.mock("./components/SignInFlow", () => ({
  SignInFlow: () => null,
}));

vi.mock("@/components/ui/public-shell", () => ({
  PublicShell: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: unknown }) => children,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkPublicSlugRateLimit: vi.fn(),
}));

vi.mock("@/lib/repository/pre-registration.repository", () => ({
  findActivePreRegistrationInviteByToken: vi.fn(),
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: class EntitlementDeniedError extends Error {},
  assertCompanyFeatureEnabled: vi.fn(),
}));

describe("smoke: apps/web/src/app/s/[slug]/page.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page");
    expect(mod).toBeDefined();
  });
});
