import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/contractors/new/create-contractor-form.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./create-contractor-form");
    expect(mod).toBeDefined();
  });
});
