import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/pre-registrations/deactivate-invite-button.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./deactivate-invite-button");
    expect(mod).toBeDefined();
  });
});
