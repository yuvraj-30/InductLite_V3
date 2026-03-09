import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/url/public-url.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./public-url");
    expect(mod).toBeDefined();
  });
});
