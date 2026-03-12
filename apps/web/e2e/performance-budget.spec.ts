import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./test-fixtures";

interface RouteBudget {
  label: string;
  route: string;
  lcpMs: number;
  tbtMs: number;
  jsBytes: number;
}

interface RouteMeasurement {
  label: string;
  route: string;
  lcpMs: number;
  tbtMs: number;
  jsBytes: number;
  domContentLoadedMs: number;
}

const OUTPUT_PATH = path.join(
  process.cwd(),
  "test-results",
  "uiux-performance-budget-report.json",
);

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __uiuxPerf?: { lcp: number; tbt: number } }).__uiuxPerf = {
      lcp: 0,
      tbt: 0,
    };

    try {
      const lcpObserver = new PerformanceObserver((entries) => {
        const bag = (
          window as unknown as { __uiuxPerf?: { lcp: number; tbt: number } }
        ).__uiuxPerf;
        if (!bag) return;
        for (const entry of entries.getEntries()) {
          if (entry.startTime > bag.lcp) {
            bag.lcp = entry.startTime;
          }
        }
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Unsupported browser capabilities should not crash the suite.
    }

    try {
      const longTaskObserver = new PerformanceObserver((entries) => {
        const bag = (
          window as unknown as { __uiuxPerf?: { lcp: number; tbt: number } }
        ).__uiuxPerf;
        if (!bag) return;
        for (const entry of entries.getEntries()) {
          const blocking = entry.duration - 50;
          if (blocking > 0) {
            bag.tbt += blocking;
          }
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      // Unsupported browser capabilities should not crash the suite.
    }
  });
}

async function measureRoute(page: Page, route: string): Promise<RouteMeasurement> {
  const visit = async () => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.waitForTimeout(750);
  };

  // Warm pass to avoid one-time compilation/caching noise in local lanes.
  await visit();
  await visit();

  return page.evaluate((currentRoute) => {
    const perfBag = (
      window as unknown as { __uiuxPerf?: { lcp: number; tbt: number } }
    ).__uiuxPerf ?? { lcp: 0, tbt: 0 };
    const navEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    const domContentLoadedMs = Number.isFinite(navEntry?.domContentLoadedEventEnd)
      ? Math.round(navEntry!.domContentLoadedEventEnd)
      : 0;
    const lcpMsRaw = Math.round(perfBag.lcp);
    const tbtMs = Math.max(0, Math.round(perfBag.tbt));
    const jsBytes = Math.round(
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => {
          if (entry.initiatorType === "script") return true;
          return /\.js($|\?)/i.test(entry.name);
        })
        .reduce(
          (total, entry) =>
            total + Math.max(entry.transferSize || 0, entry.encodedBodySize || 0),
          0,
        ),
    );

    return {
      label: currentRoute,
      route: currentRoute,
      lcpMs: lcpMsRaw > 0 ? lcpMsRaw : domContentLoadedMs,
      tbtMs,
      jsBytes,
      domContentLoadedMs,
    };
  }, route);
}

test.describe("UI/UX performance budget", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  let seededSlug = "perf-budget-site";

  test.beforeAll(async ({ seedPublicSite }) => {
    const seeded = await seedPublicSite({ slugPrefix: "perf-budget-site" });
    if (seeded?.success && seeded.slug) {
      seededSlug = seeded.slug;
    }
  });

  test.afterAll(async ({ deletePublicSite }) => {
    if (seededSlug.startsWith("perf-budget-site")) {
      await deletePublicSite(seededSlug).catch(() => null);
    }
  });

  test("key routes stay within budget and produce a report", async ({ page, loginAs }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Performance budget thresholds are enforced in chromium stable lane.",
    );

    await installPerfObservers(page);

    const budgets: RouteBudget[] = [
      {
        label: "login",
        route: "/login",
        lcpMs: 2500,
        tbtMs: 1500,
        jsBytes: 400_000,
      },
      {
        label: "sites",
        route: "/admin/sites",
        lcpMs: 2500,
        tbtMs: 3300,
        jsBytes: 575_000,
      },
      {
        label: "live-register",
        route: "/admin/live-register",
        lcpMs: 2500,
        tbtMs: 3200,
        jsBytes: 625_000,
      },
      {
        label: "induction",
        route: `/s/${seededSlug}`,
        lcpMs: 2500,
        tbtMs: 2200,
        jsBytes: 700_000,
      },
    ];

    const measurements: RouteMeasurement[] = [];

    const loginBudget = budgets[0]!;
    const loginMeasurement = await measureRoute(page, loginBudget.route);
    loginMeasurement.label = loginBudget.label;
    measurements.push(loginMeasurement);

    await loginAs();

    for (const budget of budgets.slice(1, 3)) {
      const measurement = await measureRoute(page, budget.route);
      measurement.label = budget.label;
      measurements.push(measurement);
    }

    const inductionBudget = budgets[3]!;
    const inductionMeasurement = await measureRoute(page, inductionBudget.route);
    inductionMeasurement.label = inductionBudget.label;
    measurements.push(inductionMeasurement);

    for (const budget of budgets) {
      const metric = measurements.find((candidate) => candidate.label === budget.label);
      expect(metric, `missing measurement for ${budget.label}`).toBeTruthy();
      const row = metric!;
      expect(
        row.lcpMs,
        `${budget.label} route exceeded LCP budget (${row.lcpMs}ms > ${budget.lcpMs}ms)`,
      ).toBeLessThanOrEqual(budget.lcpMs);
      expect(
        row.tbtMs,
        `${budget.label} route exceeded TBT surrogate budget (${row.tbtMs}ms > ${budget.tbtMs}ms)`,
      ).toBeLessThanOrEqual(budget.tbtMs);
      expect(
        row.jsBytes,
        `${budget.label} route exceeded JS transfer budget (${row.jsBytes} bytes > ${budget.jsBytes} bytes)`,
      ).toBeLessThanOrEqual(budget.jsBytes);
    }

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(
      OUTPUT_PATH,
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          project: testInfo.project.name,
          budgets,
          measurements,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  });
});
