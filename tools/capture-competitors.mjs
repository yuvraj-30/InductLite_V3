#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "competitors");

const COMPETITORS = [
  { name: "SignOnSite", url: "https://www.signonsite.com/" },
  { name: "SiteDocs", url: "https://www.sitedocs.com/" },
  { name: "HammerTech", url: "https://www.hammertech.com/en-us/" },
  { name: "SaferMe", url: "https://saferme.com/" },
  { name: "Sitemate", url: "https://sitemate.com/" },
  { name: "EVA Check-in", url: "https://www.evacheckin.com/" },
  { name: "SiteConnect", url: "https://siteconnect.io/" },
  { name: "SwipedOn", url: "https://www.swipedon.com/" },
  { name: "Sine", url: "https://www.sine.co/" },
  { name: "Worksite", url: "https://www.worksite.nz/" },
  { name: "ThinkSafe", url: "https://www.thinksafe.co.nz/" },
  { name: "Site App Pro", url: "https://www.siteapppro.com/" },
  { name: "1Breadcrumb", url: "https://www.1breadcrumb.com/" },
  { name: "InductLite", url: "https://inductlite-app.onrender.com/" },
];

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeFilePart(input) {
  return input
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 140);
}

function assetNameFromUrl(url, fallbackExt, index) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return `${String(index).padStart(3, "0")}_asset${fallbackExt}`;
  }
  const pathname = u.pathname || "/";
  const base = pathname.split("/").filter(Boolean).pop() || "index";
  const cleanBase = sanitizeFilePart(base);
  const hash = crypto.createHash("sha1").update(url).digest("hex").slice(0, 10);
  const ext = path.extname(cleanBase) || fallbackExt;
  const stem = path.basename(cleanBase, path.extname(cleanBase));
  return `${String(index).padStart(3, "0")}_${stem}_${hash}${ext}`;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeText(filePath, content) {
  await fs.writeFile(filePath, content, "utf8");
}

function asAbsolute(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function captureCompetitor(browser, competitor) {
  const slug = slugify(competitor.name);
  const baseDir = path.join(OUTPUT_ROOT, slug);
  const screenshotsDir = path.join(baseDir, "screenshots");
  const inspectedDir = path.join(baseDir, "inspected");
  const assetsCssDir = path.join(inspectedDir, "assets", "css");
  const assetsJsDir = path.join(inspectedDir, "assets", "js");

  await ensureDir(screenshotsDir);
  await ensureDir(inspectedDir);
  await ensureDir(assetsCssDir);
  await ensureDir(assetsJsDir);

  const context = await browser.newContext({
    viewport: { width: 1440, height: 2200 },
    ignoreHTTPSErrors: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    locale: "en-US",
  });
  const page = await context.newPage();

  const startedAt = new Date().toISOString();
  const networkEntries = [];
  const errors = [];

  page.on("response", (response) => {
    const req = response.request();
    const resourceType = req.resourceType();
    if (
      resourceType === "document" ||
      resourceType === "stylesheet" ||
      resourceType === "script"
    ) {
      networkEntries.push({
        url: response.url(),
        status: response.status(),
        resourceType,
        contentType: response.headers()["content-type"] ?? "",
      });
    }
  });

  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${String(err)}`);
  });

  let gotoStatus = null;
  let finalUrl = competitor.url;
  let title = "";
  let html = "";
  let domInfo = {
    metaDescription: "",
    h1: [],
    stylesheetLinks: [],
    scriptSrc: [],
  };

  try {
    const response = await page.goto(competitor.url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    gotoStatus = response?.status?.() ?? null;
    await page.waitForTimeout(3500);

    finalUrl = page.url();
    title = await page.title();
    html = await page.content();

    domInfo = await page.evaluate(() => {
      const getAttr = (selector, attr) =>
        Array.from(document.querySelectorAll(selector))
          .map((el) => el.getAttribute(attr) || "")
          .filter(Boolean);
      const h1 = Array.from(document.querySelectorAll("h1"))
        .map((n) => n.textContent?.trim() || "")
        .filter(Boolean)
        .slice(0, 10);
      const metaDescription =
        document
          .querySelector('meta[name="description"]')
          ?.getAttribute("content")
          ?.trim() || "";
      return {
        metaDescription,
        h1,
        stylesheetLinks: getAttr('link[rel="stylesheet"]', "href"),
        scriptSrc: getAttr("script[src]", "src"),
      };
    });

    await page.screenshot({
      path: path.join(screenshotsDir, "landing-viewport.png"),
      fullPage: false,
      type: "png",
    });
    await page.screenshot({
      path: path.join(screenshotsDir, "landing-full.png"),
      fullPage: true,
      type: "png",
    });
  } catch (err) {
    errors.push(`goto/capture_error: ${String(err)}`);
  } finally {
    try {
      if (html) {
        await writeText(path.join(inspectedDir, "page.html"), html);
      }
    } catch (err) {
      errors.push(`write_html_error: ${String(err)}`);
    }
  }

  const domStyles = domInfo.stylesheetLinks
    .map((s) => asAbsolute(finalUrl, s))
    .filter(Boolean);
  const domScripts = domInfo.scriptSrc
    .map((s) => asAbsolute(finalUrl, s))
    .filter(Boolean);

  const netStyles = networkEntries
    .filter((e) => e.resourceType === "stylesheet")
    .map((e) => e.url);
  const netScripts = networkEntries
    .filter((e) => e.resourceType === "script")
    .map((e) => e.url);

  const cssUrls = [...new Set([...domStyles, ...netStyles])].slice(0, 30);
  const jsUrls = [...new Set([...domScripts, ...netScripts])].slice(0, 30);

  const downloadedCss = [];
  const downloadedJs = [];

  for (let i = 0; i < cssUrls.length; i++) {
    const url = cssUrls[i];
    try {
      const res = await fetchWithTimeout(url, 20000);
      if (!res.ok) {
        errors.push(`css_fetch_non_ok: ${res.status} ${url}`);
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      const fileName = assetNameFromUrl(url, ".css", i + 1);
      const filePath = path.join(assetsCssDir, fileName);
      await writeText(filePath, text);
      downloadedCss.push({
        sourceUrl: url,
        file: path.relative(baseDir, filePath).replaceAll("\\", "/"),
        contentType,
        bytes: Buffer.byteLength(text, "utf8"),
      });
    } catch (err) {
      errors.push(`css_fetch_error: ${url} :: ${String(err)}`);
    }
  }

  for (let i = 0; i < jsUrls.length; i++) {
    const url = jsUrls[i];
    try {
      const res = await fetchWithTimeout(url, 20000);
      if (!res.ok) {
        errors.push(`js_fetch_non_ok: ${res.status} ${url}`);
        continue;
      }
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      const fileName = assetNameFromUrl(url, ".js", i + 1);
      const filePath = path.join(assetsJsDir, fileName);
      await writeText(filePath, text);
      downloadedJs.push({
        sourceUrl: url,
        file: path.relative(baseDir, filePath).replaceAll("\\", "/"),
        contentType,
        bytes: Buffer.byteLength(text, "utf8"),
      });
    } catch (err) {
      errors.push(`js_fetch_error: ${url} :: ${String(err)}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const metadata = {
    competitor: competitor.name,
    sourceUrl: competitor.url,
    finalUrl,
    startedAt,
    finishedAt,
    page: {
      status: gotoStatus,
      title,
      metaDescription: domInfo.metaDescription,
      h1: domInfo.h1,
    },
    capture: {
      screenshots: ["screenshots/landing-viewport.png", "screenshots/landing-full.png"],
      html: html ? "inspected/page.html" : null,
      cssCount: downloadedCss.length,
      jsCount: downloadedJs.length,
    },
    assets: {
      cssUrls,
      jsUrls,
      downloadedCss,
      downloadedJs,
    },
    network: networkEntries,
    errors,
  };

  await writeText(
    path.join(inspectedDir, "metadata.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  await writeText(
    path.join(inspectedDir, "network.json"),
    `${JSON.stringify(networkEntries, null, 2)}\n`,
  );

  const summaryLines = [
    `# ${competitor.name} Landing Page Capture`,
    "",
    `- Source URL: ${competitor.url}`,
    `- Final URL: ${finalUrl}`,
    `- Captured at: ${finishedAt}`,
    `- HTTP status (main document): ${gotoStatus ?? "unknown"}`,
    `- Title: ${title || "(empty)"}`,
    `- Meta description: ${domInfo.metaDescription || "(empty)"}`,
    `- H1 headings: ${
      domInfo.h1.length ? domInfo.h1.map((h) => `"${h}"`).join(", ") : "(none detected)"
    }`,
    "",
    "## Files",
    "",
    "- `screenshots/landing-viewport.png`",
    "- `screenshots/landing-full.png`",
    html ? "- `inspected/page.html`" : "- `inspected/page.html` (not captured)",
    "- `inspected/metadata.json`",
    "- `inspected/network.json`",
    `- Downloaded CSS assets: ${downloadedCss.length}`,
    `- Downloaded JS assets: ${downloadedJs.length}`,
    "",
  ];

  if (errors.length) {
    summaryLines.push("## Capture Errors", "");
    for (const err of errors) {
      summaryLines.push(`- ${err}`);
    }
    summaryLines.push("");
  }

  await writeText(path.join(inspectedDir, "summary.md"), `${summaryLines.join("\n")}\n`);
  await context.close();

  return {
    name: competitor.name,
    slug,
    sourceUrl: competitor.url,
    finalUrl,
    status: gotoStatus,
    cssDownloaded: downloadedCss.length,
    jsDownloaded: downloadedJs.length,
    errorCount: errors.length,
  };
}

async function main() {
  await ensureDir(OUTPUT_ROOT);
  const browser = await chromium.launch({ headless: true });
  const indexRows = [];

  try {
    for (const competitor of COMPETITORS) {
      // eslint-disable-next-line no-console
      console.log(`Capturing ${competitor.name} -> ${competitor.url}`);
      const result = await captureCompetitor(browser, competitor);
      indexRows.push(result);
      // eslint-disable-next-line no-console
      console.log(
        `Done ${competitor.name}: status=${String(result.status)} css=${result.cssDownloaded} js=${result.jsDownloaded} errors=${result.errorCount}`,
      );
    }
  } finally {
    await browser.close();
  }

  const indexMd = [
    "# Competitor Capture Index",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Competitor | Folder | Source URL | Final URL | Status | CSS | JS | Errors |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
    ...indexRows.map(
      (r) =>
        `| ${r.name} | \`${r.slug}\` | ${r.sourceUrl} | ${r.finalUrl} | ${String(
          r.status ?? "",
        )} | ${r.cssDownloaded} | ${r.jsDownloaded} | ${r.errorCount} |`,
    ),
    "",
    "Each competitor folder contains:",
    "- `screenshots/landing-viewport.png`",
    "- `screenshots/landing-full.png`",
    "- `inspected/page.html` (if captured)",
    "- `inspected/summary.md`",
    "- `inspected/metadata.json`",
    "- `inspected/network.json`",
    "- `inspected/assets/css/*`",
    "- `inspected/assets/js/*`",
    "",
  ].join("\n");

  await writeText(path.join(OUTPUT_ROOT, "INDEX.md"), `${indexMd}\n`);
  await writeText(path.join(OUTPUT_ROOT, "index.json"), `${JSON.stringify(indexRows, null, 2)}\n`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
