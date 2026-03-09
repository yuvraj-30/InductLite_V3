import { describe, expect, it } from "vitest";

describe("smoke: apps/web/src/lib/storage/s3.ts", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./s3");
    expect(mod).toBeDefined();
  });
});
