import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AuthLayout from "./layout";

describe("smoke: apps/web/src/app/(auth)/layout.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./layout");
    expect(mod).toBeDefined();
  });

  it("renders header, main, and footer landmarks", () => {
    const html = renderToStaticMarkup(
      createElement(AuthLayout, undefined, createElement("div", undefined, "Child content")),
    );

    expect(html).toContain("<header");
    expect(html).toContain("<main");
    expect(html).toContain("<footer");
  });
});
