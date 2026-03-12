import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/components/inline-copilot-panel.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./inline-copilot-panel");
    expect(mod).toBeDefined();
  });
});
