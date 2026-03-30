import { afterEach, describe, expect, it, vi } from "vitest";

const ensureTestRouteAccessMock = vi.fn();
const withRuntimePrismaMock = vi.fn();

vi.mock("../_guard", () => ({
  ensureTestRouteAccess: ensureTestRouteAccessMock,
}));

vi.mock("../_runtime-prisma", () => ({
  withRuntimePrisma: withRuntimePrismaMock,
}));

describe("apps/web/src/app/api/test/runtime/route.ts", () => {
  afterEach(() => {
    ensureTestRouteAccessMock.mockReset();
    withRuntimePrismaMock.mockReset();
    delete process.env.DATABASE_URL;
    delete process.env.ALLOW_TEST_RUNNER;
    vi.resetModules();
  });

  it("imports module without throwing", { timeout: 20_000 }, async () => {
    ensureTestRouteAccessMock.mockReturnValue(null);
    withRuntimePrismaMock.mockResolvedValue(undefined);
    process.env.DATABASE_URL = "postgresql://example.test/app";

    const mod = await import("./route");
    expect(mod).toBeDefined();
  });

  it("returns sanitized db error diagnostics without message details", async () => {
    ensureTestRouteAccessMock.mockReturnValue(null);
    process.env.DATABASE_URL = "postgresql://example.test/app";
    process.env.ALLOW_TEST_RUNNER = "1";

    const runtimeError = Object.assign(new Error("do not expose"), {
      code: "P1001",
      cause: new Error("nested-secret"),
      meta: { host: "secret-host" },
    });
    withRuntimePrismaMock.mockRejectedValue(runtimeError);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/test/runtime"));
    const payload = (await response.json()) as {
      dbPresent: boolean;
      dbReady: boolean;
      dbError: Record<string, unknown> | null;
    };

    expect(payload.dbPresent).toBe(true);
    expect(payload.dbReady).toBe(false);
    expect(payload.dbError).toEqual({
      name: "Error",
      code: "P1001",
    });
    expect(payload.dbError).not.toHaveProperty("message");
    expect(payload.dbError).not.toHaveProperty("cause");
    expect(payload.dbError).not.toHaveProperty("meta");
    expect(JSON.stringify(payload)).not.toContain("do not expose");
    expect(JSON.stringify(payload)).not.toContain("nested-secret");
    expect(JSON.stringify(payload)).not.toContain("secret-host");
  });
});
