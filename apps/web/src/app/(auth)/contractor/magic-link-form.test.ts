import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/(auth)/contractor/magic-link-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./magic-link-form");
    expect(mod).toBeDefined();
  });
});
