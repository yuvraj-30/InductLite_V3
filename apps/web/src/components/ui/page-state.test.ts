import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageEmptyState } from "./page-state";

describe("smoke: apps/web/src/components/ui/page-state.tsx", () => {
  it("imports module without throwing", { timeout: 20_000 }, async () => {
    const mod = await import("./page-state");
    expect(mod).toBeDefined();
  });

  it("uses an h2 title by default", () => {
    const html = renderToStaticMarkup(
      createElement(PageEmptyState, {
        title: "No records",
        description: "Nothing to show.",
      }),
    );
    expect(html).toContain("<h2");
    expect(html).not.toContain("<h3");
  });

  it("supports overriding the title heading level", () => {
    const html = renderToStaticMarkup(
      createElement(PageEmptyState, {
        title: "Page title",
        description: "Nothing to show.",
        titleAs: "h1",
      }),
    );
    expect(html).toContain("<h1");
  });
});
