import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/pre-registrations/bulk-invite-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./bulk-invite-form");
    expect(mod).toBeDefined();
  });
});
