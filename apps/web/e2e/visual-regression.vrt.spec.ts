import { test, expect } from "@playwright/test";
import { uploadScreenshotToVrt } from "./utils/vrt";

test("VRT - login page screenshot upload (example)", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  // Avoid waiting for networkidle because long-polling (socket.io) can block.
  // Wait for DOMContentLoaded which is sufficient for taking a screenshot.
  await page.waitForLoadState("domcontentloaded");

  const shot = await page.screenshot({ fullPage: true });
  const res = await uploadScreenshotToVrt({
      name: `login-page-${browserName}`,
      buffer: shot,
      browser: browserName,
      viewport: { width: 1280, height: 800 },
      project: process.env.VRT_PROJECT_NAME || "inductlite",
    });
  if (res.skipped) {
    expect(res.path).toBeTruthy();
  } else {
    expect(res.res).toHaveProperty("success");
  }
});
