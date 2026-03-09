import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/email/resend.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./resend");
    expect(mod).toBeDefined();
  });
});
