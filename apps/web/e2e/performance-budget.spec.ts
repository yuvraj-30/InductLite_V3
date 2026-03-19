import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./test-fixtures";
import { PERF_BUDGET_ROUTES, type PerfRouteBudget } from "./route-governance";

interface RouteMeasurement {
  label: string;
  route: string;
  lcpMs: number;
  tbtMs: number;
  cls: number;
  inpMs: number;
  jsBytes: number;
  domContentLoadedMs: number;
}

interface RouteBudgetFailure {
  label: string;
  route: string;
  failures: string[];
}

const OUTPUT_PATH = path.join(
  process.cwd(),
  "test-results",
  "uiux-performance-budget-report.json",
);

async function installPerfObservers(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as {
      __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
    }).__uiuxPerf = {
      lcp: 0,
      tbt: 0,
      cls: 0,
      inp: 0,
    };

    try {
      const lcpObserver = new PerformanceObserver((entries) => {
        const bag = (
          window as unknown as {
            __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
          }
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
          window as unknown as {
            __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
          }
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

    try {
      const clsObserver = new PerformanceObserver((entries) => {
        const bag = (
          window as unknown as {
            __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
          }
        ).__uiuxPerf;
        if (!bag) return;
        for (const entry of entries.getEntries()) {
          const shiftEntry = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!shiftEntry.hadRecentInput) {
            bag.cls += shiftEntry.value ?? 0;
          }
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Unsupported browser capabilities should not crash the suite.
    }

    try {
      const eventObserver = new PerformanceObserver((entries) => {
        const bag = (
          window as unknown as {
            __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
          }
        ).__uiuxPerf;
        if (!bag) return;
        for (const entry of entries.getEntries()) {
          if (entry.duration > bag.inp) {
            bag.inp = entry.duration;
          }
        }
      });
      eventObserver.observe({ type: "event", buffered: true, durationThreshold: 16 });
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
  await page.keyboard.press("Tab").catch(() => null);
  await page.keyboard.press("Tab").catch(() => null);
  await page.waitForTimeout(250);

  return page.evaluate((currentRoute) => {
    const perfBag = (
      window as unknown as {
        __uiuxPerf?: { lcp: number; tbt: number; cls: number; inp: number };
      }
    ).__uiuxPerf ?? { lcp: 0, tbt: 0, cls: 0, inp: 0 };
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
      cls: Number(perfBag.cls.toFixed(3)),
      inpMs: Math.max(0, Math.round(perfBag.inp)),
      jsBytes,
      domContentLoadedMs,
    };
  }, route);
}

test.describe("UI/UX performance budget", () => {
  test.describe.configure({ mode: "serial", timeout: 420_000 });

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

    const budgets: PerfRouteBudget[] = PERF_BUDGET_ROUTES.map((budget) => ({
      ...budget,
      route:
        budget.route === "/s/:slug" ? `/s/${seededSlug}` : budget.route,
    }));

    const measurements: RouteMeasurement[] = [];

    const loginBudget = budgets[0]!;
    const loginMeasurement = await measureRoute(page, loginBudget.route);
    loginMeasurement.label = loginBudget.label;
    measurements.push(loginMeasurement);

    await loginAs();

    for (const budget of budgets.slice(1)) {
      const measurement = await measureRoute(page, budget.route);
      measurement.label = budget.label;
      measurements.push(measurement);
    }

    const failures: RouteBudgetFailure[] = [];
    for (const budget of budgets) {
      const metric = measurements.find((candidate) => candidate.label === budget.label);
      if (!metric) {
        failures.push({
          label: budget.label,
          route: budget.route,
          failures: [`missing measurement for ${budget.label}`],
        });
        continue;
      }
      const row = metric!;
      const routeFailures: string[] = [];
      if (row.lcpMs > budget.lcpMs) {
        routeFailures.push(
          `${budget.label} route exceeded LCP budget (${row.lcpMs}ms > ${budget.lcpMs}ms)`,
        );
      }
      if (row.tbtMs > budget.tbtMs) {
        routeFailures.push(
          `${budget.label} route exceeded TBT surrogate budget (${row.tbtMs}ms > ${budget.tbtMs}ms)`,
        );
      }
      if (row.cls > budget.cls) {
        routeFailures.push(
          `${budget.label} route exceeded CLS budget (${row.cls} > ${budget.cls})`,
        );
      }
      if (row.inpMs > budget.inpMs) {
        routeFailures.push(
          `${budget.label} route exceeded interaction budget (${row.inpMs}ms > ${budget.inpMs}ms)`,
        );
      }
      if (row.jsBytes > budget.jsBytes) {
        routeFailures.push(
          `${budget.label} route exceeded JS transfer budget (${row.jsBytes} bytes > ${budget.jsBytes} bytes)`,
        );
      }
      if (routeFailures.length > 0) {
        failures.push({
          label: budget.label,
          route: budget.route,
          failures: routeFailures,
        });
      }
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
          failures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    expect(
      failures,
      failures.flatMap((failure) => failure.failures).join("\n"),
    ).toEqual([]);
  });
});
