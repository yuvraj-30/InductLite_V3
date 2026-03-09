import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/integrations/procore/sync.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./sync");
    expect(mod).toBeDefined();
  });
});
