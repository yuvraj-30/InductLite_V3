import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/legal/consent-versioning.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./consent-versioning");
    expect(mod).toBeDefined();
  });
});
