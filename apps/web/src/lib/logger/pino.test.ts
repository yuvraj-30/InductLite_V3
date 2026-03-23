import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/logger/pino.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./pino");
    expect(mod).toBeDefined();
  });

  it("disables pretty transport for automated test-runner envs", async () => {
    const { shouldUsePrettyTransport } = await import("./pino");

    expect(
      shouldUsePrettyTransport({
        NODE_ENV: "test",
        ALLOW_TEST_RUNNER: "1",
        E2E_QUIET: "1",
      }),
    ).toBe(false);
  });

  it("keeps pretty transport for interactive local development", async () => {
    const { shouldUsePrettyTransport } = await import("./pino");

    expect(
      shouldUsePrettyTransport({
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });
});
