import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/access-connectors/providers/hid-origo.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./hid-origo");
    expect(mod).toBeDefined();
  });
});
