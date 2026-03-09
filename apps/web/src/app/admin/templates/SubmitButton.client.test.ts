import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/app/admin/templates/SubmitButton.client.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./SubmitButton.client");
    expect(mod).toBeDefined();
  });
});
