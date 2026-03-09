import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/command-mode/roll-call.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./roll-call");
    expect(mod).toBeDefined();
  });
});
