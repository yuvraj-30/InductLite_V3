import { describe, expect, it } from "vitest";

describe("smoke: apps/mobile/src/tasks/geofenceTask.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./geofenceTask");
    expect(mod).toBeDefined();
  });
});
