import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/observability/otel.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./otel");
    expect(mod).toBeDefined();
  });
});
