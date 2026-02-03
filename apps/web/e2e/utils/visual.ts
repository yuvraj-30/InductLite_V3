import type { Page } from "@playwright/test";

/**
 * Minimal Visual helper: takes screenshots and optionally uploads to VisualRegressionTracker
 * - Controlled by env VRT_ENABLED ("1") and VRT_API_URL / VRT_API_KEY
 * - If VRT is not enabled, falls back to Playwright snapshot comparisons
 */

export async function takeAndCompare(
  page: Page,
  name: string,
  opts?: { fullPage?: boolean; regionSelector?: string },
) {
  const filename = `${name.replace(/[^a-z0-9-_.]/gi, "_")}.png`;

  if (process.env.VRT_ENABLED === "1") {
    // When VRT enabled, upload the screenshot to the tracker via its API
    // Implementation: capture screenshot buffer and POST to VRT API endpoint
    const buffer = await page.screenshot({ fullPage: !!opts?.fullPage });

    const apiUrl = process.env.VRT_API_URL;
    const apiKey = process.env.VRT_API_KEY;
    if (!apiUrl || !apiKey) {
      throw new Error(
        "VRT_ENABLED=1 requires VRT_API_URL and VRT_API_KEY to be set",
      );
    }

    const form = new FormData();
    // @ts-expect-error Node FormData global may be missing - Playwright Node env supports fetch with blob
    form.append("image", new Blob([buffer]), filename);
    form.append("name", name);

    const body = form as unknown as BodyInit;

    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/api/runs/upload`, {
      method: "POST",
      headers: {
        Authorization: `ApiKey ${apiKey}`,
      },
      body,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => undefined);
      throw new Error(`VRT upload failed: ${res.status} ${txt ?? ""}`);
    }

    return { uploaded: true };
  }

  // Default: Playwright snapshot assertion
  // The caller should use Playwright expect(page).toHaveScreenshot with the same filename
  // We return filename so tests can call expect(page).toHaveScreenshot(filename)
  return { uploaded: false, filename };
}
