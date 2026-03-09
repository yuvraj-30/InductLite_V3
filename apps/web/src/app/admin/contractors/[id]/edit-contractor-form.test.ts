import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/contractors/[id]/edit-contractor-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./edit-contractor-form");
    expect(mod).toBeDefined();
  });
});
