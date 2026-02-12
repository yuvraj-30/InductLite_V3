import { test, expect } from "./test-fixtures";

type LinkTarget = {
  href: string;
  text: string;
};

function normalizePath(input: string): string | null {
  if (!input) return null;
  const normalizedScheme = input.trim().toLowerCase();
  if (
    normalizedScheme.startsWith("mailto:") ||
    normalizedScheme.startsWith("tel:") ||
    normalizedScheme.startsWith("javascript:") ||
    normalizedScheme.startsWith("data:") ||
    normalizedScheme.startsWith("vbscript:")
  ) {
    return null;
  }
  if (input.startsWith("#")) return null;
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      const u = new URL(input);
      return `${u.pathname}${u.search}`;
    }
  } catch {
    return null;
  }
  return input.startsWith("/") ? input : null;
}

function shouldSkipPath(path: string): boolean {
  if (path.startsWith("/api/")) return true;
  // Side-effect route; we validate it elsewhere in auth tests.
  if (path === "/logout") return true;
  return false;
}

async function collectInternalLinks(): Promise<LinkTarget[]> {
  const out = new Map<string, string>();
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  for (const a of anchors) {
    const href = a.getAttribute("href") ?? "";
    const text = (a.textContent ?? "").trim();
    out.set(href, text);
  }
  return Array.from(out.entries()).map(([href, text]) => ({ href, text }));
}

test.describe("Link/Navigation Integrity", () => {
  test.describe.configure({ timeout: 180_000 });

  let publicSlug = "";

  test.beforeAll(async ({ seedPublicSite }) => {
    const seeded = await seedPublicSite({ slugPrefix: "test-site-e2e-links" });
    publicSlug = seeded.slug;
  });

  test("public pages: all discovered internal links resolve", async ({
    page,
    workerServer,
  }) => {
    const routes = [
      "/",
      "/login",
      "/contractor",
      "/unauthorized",
      "/~offline",
      `/s/${publicSlug}`,
      `/s/${publicSlug}/kiosk`,
      "/sign-out",
    ];

    const discovered = new Set<string>();

    for (const route of routes) {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res, `No response for ${route}`).not.toBeNull();
      expect(
        res!.status(),
        `Page failed to load: ${route} (${res!.status()})`,
      ).toBeLessThan(400);

      const links = await page.evaluate(collectInternalLinks);
      for (const link of links) {
        const normalized = normalizePath(link.href);
        if (!normalized) continue;
        if (shouldSkipPath(normalized)) continue;
        discovered.add(normalized);
      }
    }

    for (const path of Array.from(discovered).sort()) {
      const res = await page.request.get(`${workerServer.baseUrl}${path}`, {
        maxRedirects: 5,
      });
      expect(
        res.status(),
        `Broken internal link target: ${path} (status ${res.status()})`,
      ).toBeLessThan(400);
    }
  });

  test("admin pages: all discovered internal links resolve", async ({
    page,
    loginAs,
    workerUser,
    workerServer,
  }) => {
    await loginAs(workerUser.email);

    const routes = [
      "/admin",
      "/admin/dashboard",
      "/admin/live-register",
      "/admin/history",
      "/admin/exports",
      "/admin/sites",
      "/admin/templates",
      "/admin/audit-log",
    ];

    const discovered = new Set<string>();

    for (const route of routes) {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res, `No response for ${route}`).not.toBeNull();
      expect(
        res!.status(),
        `Admin page failed to load: ${route} (${res!.status()})`,
      ).toBeLessThan(400);

      const links = await page.evaluate(collectInternalLinks);
      for (const link of links) {
        const normalized = normalizePath(link.href);
        if (!normalized) continue;
        if (shouldSkipPath(normalized)) continue;
        discovered.add(normalized);
      }
    }

    for (const path of Array.from(discovered).sort()) {
      const res = await page.request.get(`${workerServer.baseUrl}${path}`, {
        maxRedirects: 5,
      });
      expect(
        res.status(),
        `Broken admin internal link target: ${path} (status ${res.status()})`,
      ).toBeLessThan(400);
    }
  });
});
