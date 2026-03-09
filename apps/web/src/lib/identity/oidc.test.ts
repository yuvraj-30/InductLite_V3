import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/identity/oidc.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./oidc");
    expect(mod).toBeDefined();
  });
});
