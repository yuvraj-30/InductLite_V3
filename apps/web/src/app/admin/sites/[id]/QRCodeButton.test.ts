import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/sites/[id]/QRCodeButton.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./QRCodeButton");
    expect(mod).toBeDefined();
  });
});
