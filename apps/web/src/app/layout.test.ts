import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Manrope: vi.fn(() => ({
    className: "font-manrope",
    variable: "--font-body",
    style: {},
  })),
  Space_Grotesk: vi.fn(() => ({
    className: "font-space-grotesk",
    variable: "--font-heading",
    style: {},
  })),
}));

describe("smoke: apps/web/src/app/layout.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./layout");
    expect(mod).toBeDefined();
  });
});
