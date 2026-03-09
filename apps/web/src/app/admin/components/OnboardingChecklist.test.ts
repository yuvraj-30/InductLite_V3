import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/components/OnboardingChecklist.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./OnboardingChecklist");
    expect(mod).toBeDefined();
  });
});
