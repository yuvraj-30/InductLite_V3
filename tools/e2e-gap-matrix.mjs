#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_ROOT = path.join(ROOT, "apps", "web", "src", "app");
const E2E_ROOT = path.join(ROOT, "apps", "web", "e2e");
const OUTPUT_JSON = path.join(ROOT, "docs", "E2E_TEST_GAP_MATRIX.json");
const OUTPUT_MD = path.join(ROOT, "docs", "E2E_TEST_GAP_MATRIX.md");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".git",
  "test-results",
  "playwright-report",
  "vrt-local-out",
]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function toPosix(inputPath) {
  return inputPath.replace(/\\/g, "/");
}

function rel(inputPath) {
  return toPosix(path.relative(ROOT, inputPath));
}

function normalizeUrlPath(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  if (
    lowered.startsWith("mailto:") ||
    lowered.startsWith("tel:") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:") ||
    lowered.startsWith("vbscript:")
  ) {
    return null;
  }
  if (trimmed.startsWith("#")) return null;

  let pathOnly = trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const u = new URL(trimmed);
      pathOnly = `${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  }

  if (!pathOnly.startsWith("/")) return null;

  const noQuery = pathOnly.split("?")[0]?.split("#")[0] ?? "";
  if (!noQuery) return null;
  if (noQuery === "/") return "/";
  return noQuery.replace(/\/+$/, "");
}

function isDynamicSegment(segment) {
  return segment.startsWith("[") && segment.endsWith("]");
}

function appFileToRoute(inputFile) {
  const relative = rel(inputFile);
  const noPrefix = relative.replace(/^apps\/web\/src\/app\//, "");
  const isPage = /\/page\.(ts|tsx)$/.test(noPrefix);
  const isRoute = /\/route\.(ts|tsx)$/.test(noPrefix);
  if (!isPage && !isRoute) return null;

  const withoutLeaf = noPrefix.replace(/\/(page|route)\.(ts|tsx)$/, "");
  const rawSegments = withoutLeaf.split("/").filter(Boolean);

  const cleanedSegments = rawSegments
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .map((segment) => {
      if (!isDynamicSegment(segment)) return segment;
      if (segment.startsWith("[...")) return "*";
      const inner = segment.slice(1, -1);
      return `:${inner}`;
    });

  let routePath = `/${cleanedSegments.join("/")}`;
  if (routePath === "/") {
    routePath = "/";
  } else {
    routePath = routePath.replace(/\/+/g, "/");
  }

  const routeType = isRoute ? "route-handler" : "page";
  const surface = routePath.startsWith("/api/") ? "api" : "ui";

  return {
    sourceFile: relative,
    routePath,
    routeType,
    surface,
  };
}

function routePathToRegex(routePath) {
  if (routePath === "/") return /^\/$/;

  const segments = routePath.split("/").filter(Boolean);
  const regexSegments = segments.map((segment) => {
    if (segment === "*") return ".+";
    if (segment.startsWith(":")) return "[^/]+";
    return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return new RegExp(`^/${regexSegments.join("/")}/?$`);
}

function extractPathLiterals(specContent) {
  const found = [];

  const quotedPathRe = /["'](\/[^"'\\\r\n]*)["']/g;
  let quotedMatch = quotedPathRe.exec(specContent);
  while (quotedMatch) {
    const rawPath = quotedMatch[1];
    if (rawPath) found.push(rawPath);
    quotedMatch = quotedPathRe.exec(specContent);
  }

  const templatePathRe = /`(\/[^`\r\n]*)`/g;
  let templateMatch = templatePathRe.exec(specContent);
  while (templateMatch) {
    const rawTemplate = templateMatch[1];
    if (rawTemplate) {
      found.push(rawTemplate.replace(/\$\{[^}]+\}/g, "dynamic"));
    }
    templateMatch = templatePathRe.exec(specContent);
  }

  return found.map(normalizeUrlPath).filter((value) => Boolean(value));
}

function extractRegexRouteMatchers(specContent) {
  const matchers = [];
  let index = 0;
  while (index < specContent.length) {
    const literal = readRegexLiteral(specContent, index);
    if (!literal) {
      index += 1;
      continue;
    }

    const { body, flags, endIndex } = literal;
    if (body && body.includes("\\/")) {
      const slashTokenCount = (body.match(/\\\//g) ?? []).length;
      const hasBoundaryHint =
        body.startsWith("^") ||
        body.includes("$") ||
        body.includes("\\?") ||
        body.includes("\\b");
      if (slashTokenCount >= 2 || hasBoundaryHint) {
        try {
          matchers.push(new RegExp(body, flags));
        } catch {
          // Ignore invalid regex literals in static extraction.
        }
      }
    }
    index = endIndex;
  }
  return matchers;
}

function readRegexLiteral(specContent, startIndex) {
  if (specContent[startIndex] !== "/") {
    return null;
  }

  const nextChar = specContent[startIndex + 1] ?? "";
  if (nextChar === "/" || nextChar === "*") {
    return null;
  }

  if (!looksLikeRegexStart(specContent, startIndex)) {
    return null;
  }

  let cursor = startIndex + 1;
  let escaped = false;
  let inCharacterClass = false;

  while (cursor < specContent.length) {
    const char = specContent[cursor];
    if (char === "\r" || char === "\n") {
      return null;
    }

    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      cursor += 1;
      continue;
    }

    if (char === "[" && !inCharacterClass) {
      inCharacterClass = true;
      cursor += 1;
      continue;
    }

    if (char === "]" && inCharacterClass) {
      inCharacterClass = false;
      cursor += 1;
      continue;
    }

    if (char === "/" && !inCharacterClass) {
      const body = specContent.slice(startIndex + 1, cursor);
      let flagCursor = cursor + 1;
      while (flagCursor < specContent.length) {
        const flag = specContent[flagCursor];
        if (!/[a-z]/i.test(flag)) {
          break;
        }
        flagCursor += 1;
      }
      return {
        body,
        flags: specContent.slice(cursor + 1, flagCursor),
        endIndex: flagCursor,
      };
    }

    cursor += 1;
  }

  return null;
}

function looksLikeRegexStart(specContent, startIndex) {
  let cursor = startIndex - 1;
  while (cursor >= 0) {
    const char = specContent[cursor];
    if (/\s/.test(char)) {
      cursor -= 1;
      continue;
    }

    if (/[A-Za-z0-9_$)\]]/.test(char)) {
      return false;
    }

    return true;
  }

  return true;
}

function routePriority(row) {
  const route = row.routePath;

  if (
    route.startsWith("/api/") ||
    route === "/login" ||
    route === "/register" ||
    route === "/change-password" ||
    route === "/admin" ||
    route.startsWith("/admin") ||
    route.startsWith("/s/")
  ) {
    return "P0";
  }

  if (
    route === "/" ||
    route === "/pricing" ||
    route === "/demo" ||
    route === "/compare" ||
    route === "/terms" ||
    route === "/privacy" ||
    route === "/unauthorized" ||
    route === "/~offline" ||
    route === "/sign-out"
  ) {
    return "P1";
  }

  return "P2";
}

function routeRisk(row) {
  const route = row.routePath;

  if (route.startsWith("/api/")) return "API contract / integration behavior";
  if (route.startsWith("/admin")) return "Admin workflow / operational UX";
  if (route.startsWith("/s/")) return "Public sign-in entrypoint";
  if (route === "/login" || route === "/register" || route === "/change-password") {
    return "Authentication flow";
  }
  return "Public site UX / SEO";
}

function parseArgValue(argv, name, fallback) {
  const prefixed = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefixed));
  if (inline) return inline.slice(prefixed.length);

  const idx = argv.indexOf(name);
  if (idx !== -1) {
    const next = argv[idx + 1];
    if (next && !next.startsWith("--")) return next;
  }

  return fallback;
}

function parseCliOptions(argv) {
  const dynamicLinks =
    argv.includes("--dynamic-links") || argv.includes("--dynamic");
  const jsFlows = argv.includes("--js-flows") || argv.includes("--js-flow");
  const baseUrl = parseArgValue(
    argv,
    "--base-url",
    process.env.BASE_URL || "http://127.0.0.1:3000",
  );
  const maxPages = Number.parseInt(parseArgValue(argv, "--max-pages", "250"), 10);
  const maxDepth = Number.parseInt(parseArgValue(argv, "--max-depth", "4"), 10);
  const maxButtonsPerPage = Number.parseInt(
    parseArgValue(argv, "--max-buttons-per-page", "16"),
    10,
  );

  return {
    dynamicLinks: dynamicLinks || jsFlows,
    jsFlows,
    baseUrl,
    maxPages: Number.isFinite(maxPages) && maxPages > 0 ? maxPages : 250,
    maxDepth: Number.isFinite(maxDepth) && maxDepth >= 0 ? maxDepth : 4,
    maxButtonsPerPage:
      Number.isFinite(maxButtonsPerPage) && maxButtonsPerPage > 0
        ? maxButtonsPerPage
        : 16,
  };
}

function makeRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildTestRouteHeaders(extra = {}) {
  const headers = { ...extra };
  if (process.env.TEST_RUNNER_SECRET_KEY) {
    headers["x-test-secret"] = process.env.TEST_RUNNER_SECRET_KEY;
  }
  return headers;
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonSafe(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function trySeedPublicSlug(baseUrl) {
  const endpoint = `${baseUrl}/api/test/seed-public-site`;
  const body = { slugPrefix: `e2e-gap-${Date.now().toString(36)}` };

  const response = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: buildTestRouteHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(body),
    },
    15000,
  );

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    throw new Error(`seed-public-site failed (${response.status}): ${txt}`);
  }

  const payload = await parseJsonSafe(response);
  if (!payload?.success || !payload?.slug) {
    throw new Error(`seed-public-site unexpected response: ${JSON.stringify(payload)}`);
  }

  return payload.slug;
}

async function tryCreateAdminCookie(baseUrl) {
  const clientKey = `e2e-gap-${makeRequestId()}`;
  const email = `e2e-gap-${makeRequestId()}@example.test`;
  const password = "Admin123!";
  const createUserResponse = await fetchWithTimeout(
    `${baseUrl}/api/test/create-user`,
    {
      method: "POST",
      headers: buildTestRouteHeaders({
        "content-type": "application/json",
        "x-e2e-client": clientKey,
      }),
      body: JSON.stringify({
        email,
        password,
        role: "ADMIN",
        companySlug: `e2e-gap-company-${makeRequestId()}`,
      }),
    },
    15000,
  );

  if (!createUserResponse.ok) {
    const txt = await createUserResponse.text().catch(() => "");
    throw new Error(`create-user failed (${createUserResponse.status}): ${txt}`);
  }

  const sessionResponse = await fetchWithTimeout(
    `${baseUrl}/api/test/create-session?email=${encodeURIComponent(email)}&json=1`,
    {
      method: "GET",
      headers: buildTestRouteHeaders({ "x-e2e-client": clientKey }),
    },
    15000,
  );

  if (!sessionResponse.ok) {
    const txt = await sessionResponse.text().catch(() => "");
    throw new Error(`create-session failed (${sessionResponse.status}): ${txt}`);
  }

  const sessionJson = await parseJsonSafe(sessionResponse);
  if (!sessionJson?.cookieName || !sessionJson?.cookieValue) {
    throw new Error(`create-session missing cookie fields: ${JSON.stringify(sessionJson)}`);
  }

  return {
    cookieHeader: `${sessionJson.cookieName}=${sessionJson.cookieValue}`,
    clientKey,
  };
}

function extractInternalLinksFromHtml(html, baseOrigin) {
  const out = new Set();
  const hrefRe = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

  let match = hrefRe.exec(html);
  while (match) {
    const candidate = match[1] ?? match[2] ?? match[3] ?? "";
    if (!candidate) {
      match = hrefRe.exec(html);
      continue;
    }

    let normalized = normalizeUrlPath(candidate);
    if (!normalized && (candidate.startsWith("http://") || candidate.startsWith("https://"))) {
      try {
        const u = new URL(candidate);
        if (u.origin === baseOrigin) {
          normalized = normalizeUrlPath(`${u.pathname}${u.search}`);
        }
      } catch {
        // ignore invalid URLs
      }
    }

    if (normalized) out.add(normalized);
    match = hrefRe.exec(html);
  }

  return [...out];
}

function isLikelyAssetPath(urlPath) {
  return /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|map)$/i.test(urlPath);
}

function parseCookieHeader(cookieHeader) {
  const idx = cookieHeader.indexOf("=");
  if (idx <= 0) return null;
  return {
    name: cookieHeader.slice(0, idx),
    value: cookieHeader.slice(idx + 1),
  };
}

function shouldSkipButtonCandidate(candidate) {
  if (!candidate) return true;
  if (candidate.disabled) return true;
  const type = String(candidate.type || "").toLowerCase();
  if (type === "submit" || type === "reset") return true;

  const text = String(candidate.text || "").trim().toLowerCase();
  const id = String(candidate.id || "").trim().toLowerCase();
  const cls = String(candidate.cls || "").trim().toLowerCase();
  const joined = `${text} ${id} ${cls}`.trim();
  if (!joined) return true;

  // Avoid mutating/destructive controls in automatic discovery.
  if (
    /\b(delete|remove|purge|deactivate|archive|confirm|approve|reject|submit|create|save|queue|sync|process|resolve|clear)\b/.test(
      joined,
    )
  ) {
    return true;
  }

  return false;
}

async function discoverJsFlowPaths(options, contextInfo) {
  const meta = {
    enabled: true,
    attempted: true,
    pagesVisited: 0,
    clicksAttempted: 0,
    navigationClicks: 0,
    discoveredPaths: 0,
    errors: [],
  };

  let chromium = null;
  try {
    ({ chromium } = await import("@playwright/test"));
  } catch (error) {
    meta.errors.push(`playwright import failed: ${String(error)}`);
    return { paths: [], meta };
  }

  const discovered = new Set();
  const visited = new Set();
  const queue = [];

  const enqueue = (urlPath, depth, scope) => {
    const normalized = normalizeUrlPath(urlPath);
    if (!normalized) return;
    const key = `${scope}:${normalized}`;
    if (visited.has(key)) return;
    queue.push({ path: normalized, depth, scope });
  };

  for (const pathItem of contextInfo.publicStarts) {
    enqueue(pathItem, 0, "public");
  }
  if (contextInfo.adminCookieHeader) {
    for (const pathItem of contextInfo.adminStarts) {
      enqueue(pathItem, 0, "admin");
    }
  }

  let browser = null;
  let page = null;
  let context = null;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();

    if (contextInfo.adminCookieHeader) {
      const parsedCookie = parseCookieHeader(contextInfo.adminCookieHeader);
      if (parsedCookie) {
        await context.addCookies([
          {
            name: parsedCookie.name,
            value: parsedCookie.value,
            url: contextInfo.baseOrigin,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
            expires: Math.floor(Date.now() / 1000) + 4 * 60 * 60,
          },
        ]);
      }
    }

    page = await context.newPage();
    if (contextInfo.adminClientKey) {
      await page.setExtraHTTPHeaders({
        "x-e2e-client": contextInfo.adminClientKey,
      });
    }

    while (queue.length > 0 && visited.size < options.maxPages) {
      const current = queue.shift();
      if (!current) break;
      const visitKey = `${current.scope}:${current.path}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);

      if (current.scope === "admin" && !contextInfo.adminCookieHeader) {
        continue;
      }

      try {
        await page.goto(`${contextInfo.baseOrigin}${current.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 12000,
        });
      } catch {
        continue;
      }

      meta.pagesVisited += 1;
      const loadedPath = normalizeUrlPath(
        `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
      );
      if (loadedPath) discovered.add(loadedPath);

      const anchorLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll("a[href]"))
          .map((anchor) => anchor.getAttribute("href") || "")
          .filter((href) => Boolean(href)),
      );
      for (const link of anchorLinks) {
        const normalizedLink = normalizeUrlPath(link);
        if (!normalizedLink) continue;
        discovered.add(normalizedLink);
        if (current.depth >= options.maxDepth) continue;
        if (normalizedLink.startsWith("/api/") || isLikelyAssetPath(normalizedLink)) {
          continue;
        }
        const nextScope =
          normalizedLink.startsWith("/admin") && contextInfo.adminCookieHeader
            ? "admin"
            : current.scope;
        enqueue(normalizedLink, current.depth + 1, nextScope);
      }

      const buttonSelector = "button, [role='button']";
      const candidates = await page.evaluate(
        ({ selector, maxButtons }) => {
          const nodes = Array.from(document.querySelectorAll(selector));
          const out = [];
          for (let i = 0; i < nodes.length && out.length < maxButtons; i += 1) {
            const el = nodes[i];
            if (!(el instanceof HTMLElement)) continue;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const hidden =
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.width === 0 ||
              rect.height === 0;
            if (hidden) continue;
            const disabled =
              (el instanceof HTMLButtonElement && el.disabled) ||
              el.getAttribute("aria-disabled") === "true";
            out.push({
              index: i,
              type:
                el instanceof HTMLButtonElement
                  ? (el.type || "")
                  : (el.getAttribute("type") || ""),
              disabled,
              text:
                (el.innerText || "").trim() ||
                (el.getAttribute("aria-label") || "").trim(),
              id: el.id || "",
              cls: String(el.className || ""),
            });
          }
          return out;
        },
        { selector: buttonSelector, maxButtons: options.maxButtonsPerPage },
      );

      for (const candidate of candidates) {
        if (shouldSkipButtonCandidate(candidate)) continue;
        const beforePath = normalizeUrlPath(
          `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
        );
        meta.clicksAttempted += 1;

        try {
          const locator = page.locator(buttonSelector).nth(candidate.index);
          await locator.click({ timeout: 1800, force: true });
          await page.waitForTimeout(500);
          await page.waitForLoadState("domcontentloaded", { timeout: 2500 }).catch(
            () => undefined,
          );
        } catch {
          continue;
        }

        const afterPath = normalizeUrlPath(
          `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
        );
        if (afterPath && beforePath && afterPath !== beforePath) {
          discovered.add(afterPath);
          meta.navigationClicks += 1;
          if (
            current.depth < options.maxDepth &&
            !afterPath.startsWith("/api/") &&
            !isLikelyAssetPath(afterPath)
          ) {
            const nextScope =
              afterPath.startsWith("/admin") && contextInfo.adminCookieHeader
                ? "admin"
                : current.scope;
            enqueue(afterPath, current.depth + 1, nextScope);
          }
          try {
            await page.goto(`${contextInfo.baseOrigin}${current.path}`, {
              waitUntil: "domcontentloaded",
              timeout: 10000,
            });
          } catch {
            break;
          }
        } else {
          await page.keyboard.press("Escape").catch(() => undefined);
        }

        for (const extraPage of context.pages()) {
          if (extraPage !== page) {
            await extraPage.close().catch(() => undefined);
          }
        }
      }
    }
  } catch (error) {
    meta.errors.push(`js-flow crawl failed: ${String(error)}`);
  } finally {
    if (page) {
      await page.close().catch(() => undefined);
    }
    if (context) {
      await context.close().catch(() => undefined);
    }
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }

  meta.discoveredPaths = discovered.size;
  return { paths: [...discovered].sort(), meta };
}

async function discoverDynamicPaths(options) {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const baseOrigin = new URL(baseUrl).origin;
  const meta = {
    enabled: true,
    baseUrl,
    maxPages: options.maxPages,
    maxDepth: options.maxDepth,
    seededPublicSlug: null,
    adminSessionEstablished: false,
    jsFlowsEnabled: options.jsFlows,
    anchorDiscoveredPaths: 0,
    jsFlowDiscoveredPaths: 0,
    jsFlowStats: null,
    errors: [],
  };

  const discovered = new Set();
  const visited = new Set();
  const queue = [];

  const enqueue = (urlPath, depth, scope) => {
    const normalized = normalizeUrlPath(urlPath);
    if (!normalized) return;
    const key = `${scope}:${normalized}`;
    if (visited.has(key)) return;
    queue.push({ path: normalized, depth, scope });
  };

  let adminCookie = null;
  let adminClientKey = null;

  try {
    const runtimeProbe = await fetchWithTimeout(`${baseUrl}/api/test/runtime`, {
      method: "GET",
      headers: buildTestRouteHeaders(),
    });
    if (!runtimeProbe.ok) {
      const body = await runtimeProbe.text().catch(() => "");
      throw new Error(`runtime probe failed (${runtimeProbe.status}): ${body}`);
    }
  } catch (error) {
    meta.errors.push(
      `dynamic crawl disabled: cannot reach app/test runtime at ${baseUrl} (${String(error)})`,
    );
    return { paths: [], meta };
  }

  try {
    meta.seededPublicSlug = await trySeedPublicSlug(baseUrl);
  } catch (error) {
    meta.errors.push(`seed-public-site unavailable: ${String(error)}`);
  }

  try {
    const session = await tryCreateAdminCookie(baseUrl);
    adminCookie = session.cookieHeader;
    adminClientKey = session.clientKey;
    meta.adminSessionEstablished = true;
  } catch (error) {
    meta.errors.push(`admin session unavailable: ${String(error)}`);
  }

  const publicStarts = [
    "/",
    "/login",
    "/contractor",
    "/register",
    "/change-password",
    "/pricing",
    "/demo",
    "/compare",
    "/privacy",
    "/terms",
    "/unauthorized",
    "/~offline",
    "/sign-out",
  ];
  for (const start of publicStarts) enqueue(start, 0, "public");
  if (meta.seededPublicSlug) {
    enqueue(`/s/${meta.seededPublicSlug}`, 0, "public");
    enqueue(`/s/${meta.seededPublicSlug}/kiosk`, 0, "public");
  }

  if (adminCookie) {
    const adminStarts = [
      "/admin",
      "/admin/dashboard",
      "/admin/sites",
      "/admin/templates",
      "/admin/users",
      "/admin/live-register",
      "/admin/history",
      "/admin/exports",
      "/admin/settings",
      "/admin/contractors",
    ];
    for (const start of adminStarts) enqueue(start, 0, "admin");
  }

  while (queue.length > 0 && visited.size < options.maxPages) {
    const current = queue.shift();
    if (!current) break;
    const visitKey = `${current.scope}:${current.path}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    discovered.add(current.path);

    const headers = {};
    if (current.scope === "admin" && adminCookie) {
      headers.cookie = adminCookie;
    }
    if (adminClientKey) {
      headers["x-e2e-client"] = adminClientKey;
    }

    let response;
    try {
      response = await fetchWithTimeout(
        `${baseOrigin}${current.path}`,
        {
          method: "GET",
          headers,
        },
        12000,
      );
    } catch {
      continue;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) continue;

    const html = await response.text().catch(() => "");
    if (!html) continue;

    const links = extractInternalLinksFromHtml(html, baseOrigin);
    for (const linkPath of links) {
      discovered.add(linkPath);
      if (current.depth >= options.maxDepth) continue;
      if (isLikelyAssetPath(linkPath)) continue;

      if (linkPath.startsWith("/admin")) {
        if (!adminCookie) continue;
        enqueue(linkPath, current.depth + 1, "admin");
        continue;
      }

      if (linkPath.startsWith("/api/")) {
        continue;
      }

      enqueue(linkPath, current.depth + 1, current.scope);
    }
  }

  meta.anchorDiscoveredPaths = discovered.size;

  if (options.jsFlows) {
    const jsFlowResult = await discoverJsFlowPaths(options, {
      baseOrigin,
      adminCookieHeader: adminCookie,
      adminClientKey,
      publicStarts: [
        "/",
        "/login",
        "/contractor",
        "/register",
        "/change-password",
        "/pricing",
        "/demo",
        "/compare",
        "/privacy",
        "/terms",
        "/unauthorized",
        "/~offline",
        "/sign-out",
        ...(meta.seededPublicSlug
          ? [`/s/${meta.seededPublicSlug}`, `/s/${meta.seededPublicSlug}/kiosk`]
          : []),
      ],
      adminStarts: adminCookie
        ? [
            "/admin",
            "/admin/dashboard",
            "/admin/sites",
            "/admin/templates",
            "/admin/users",
            "/admin/live-register",
            "/admin/history",
            "/admin/exports",
            "/admin/settings",
            "/admin/contractors",
          ]
        : [],
    });

    for (const jsPath of jsFlowResult.paths) {
      discovered.add(jsPath);
    }
    meta.jsFlowDiscoveredPaths = jsFlowResult.paths.length;
    meta.jsFlowStats = jsFlowResult.meta;
    for (const err of jsFlowResult.meta.errors ?? []) {
      meta.errors.push(err);
    }
  }

  return { paths: [...discovered].sort(), meta };
}

function buildStaticEvidence(specFiles) {
  const pathToSpecs = new Map();
  const regexMatchersBySpec = new Map();

  for (const specRel of specFiles) {
    const absSpec = path.join(ROOT, specRel);
    const content = fs.readFileSync(absSpec, "utf8");
    const paths = extractPathLiterals(content);
    regexMatchersBySpec.set(specRel, extractRegexRouteMatchers(content));
    for (const urlPath of paths) {
      const bucket = pathToSpecs.get(urlPath) ?? new Set();
      bucket.add(specRel);
      pathToSpecs.set(urlPath, bucket);
    }
  }

  return { pathToSpecs, regexMatchersBySpec };
}

async function buildMatrix(options) {
  const appFiles = walk(APP_ROOT).filter((file) =>
    /(?:^|\/)(page|route)\.(ts|tsx)$/.test(toPosix(file)),
  );
  const routes = appFiles.map(appFileToRoute).filter((value) => Boolean(value));

  const specFiles = walk(E2E_ROOT)
    .filter((file) => /\.spec\.ts$/.test(path.basename(file)))
    .map((file) => rel(file));

  const staticEvidence = buildStaticEvidence(specFiles);
  const staticReferencedPaths = [...staticEvidence.pathToSpecs.keys()].sort();

  const dynamicEvidence = options.dynamicLinks
    ? await discoverDynamicPaths(options)
    : {
        paths: [],
        meta: {
          enabled: false,
          baseUrl: null,
          maxPages: 0,
          maxDepth: 0,
          seededPublicSlug: null,
          adminSessionEstablished: false,
          errors: [],
        },
      };

  const dynamicPathSet = new Set(dynamicEvidence.paths);
  const referencedPaths = [...new Set([...staticReferencedPaths, ...dynamicEvidence.paths])].sort();

  const rows = routes
    .sort((a, b) => a.routePath.localeCompare(b.routePath))
    .map((routeRow) => {
      const matcher = routePathToRegex(routeRow.routePath);
      const routeSamplePath = routeRow.routePath
        .split("/")
        .map((segment) => {
          if (segment.startsWith(":")) return "dynamic";
          if (segment === "*") return "dynamic/path";
          return segment;
        })
        .join("/")
        .replace(/\/+/g, "/");

      const matchedPaths = referencedPaths.filter((candidate) => matcher.test(candidate));
      const regexMatchedSpecs = specFiles.filter((specRel) => {
        const regexMatchers = staticEvidence.regexMatchersBySpec.get(specRel) ?? [];
        return regexMatchers.some((rx) => rx.test(routeSamplePath));
      });

      const matchedSpecs = [
        ...new Set(
          [
            ...matchedPaths.flatMap((candidate) => [
              ...(staticEvidence.pathToSpecs.get(candidate) ?? []),
            ]),
            ...regexMatchedSpecs,
            ...(matchedPaths.some((candidate) => dynamicPathSet.has(candidate))
              ? ["runtime-crawl(dynamic-links)"]
              : []),
          ],
        ),
      ].sort();

      const dynamicMatchedPaths = matchedPaths.filter((candidate) =>
        dynamicPathSet.has(candidate),
      );

      const hasCoverage = matchedSpecs.length > 0;
      return {
        ...routeRow,
        priority: routePriority(routeRow),
        risk: routeRisk(routeRow),
        status: hasCoverage ? "Covered" : "Gap",
        evidencePaths: matchedPaths,
        evidenceSpecs: matchedSpecs,
        dynamicEvidencePaths: dynamicMatchedPaths,
      };
    });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalAppRoutes: rows.length,
    totalPlaywrightSpecs: specFiles.length,
    totalReferencedPaths: referencedPaths.length,
    staticReferencedPaths: staticReferencedPaths.length,
    dynamicReferencedPaths: dynamicEvidence.paths.length,
    dynamicLinksMode: options.dynamicLinks,
    jsFlowsMode: options.jsFlows,
    coveredRoutes: rows.filter((row) => row.status === "Covered").length,
    gaps: rows.filter((row) => row.status === "Gap").length,
    uiRoutes: rows.filter((row) => row.surface === "ui").length,
    apiRoutes: rows.filter((row) => row.surface === "api").length,
    coveredUiRoutes: rows.filter(
      (row) => row.surface === "ui" && row.status === "Covered",
    ).length,
    coveredApiRoutes: rows.filter(
      (row) => row.surface === "api" && row.status === "Covered",
    ).length,
  };

  return {
    summary,
    rows,
    referencedPaths,
    specFiles,
    dynamic: dynamicEvidence.meta,
  };
}

function writeOutputs(matrix) {
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(matrix, null, 2)}\n`, "utf8");

  const gapRows = matrix.rows
    .filter((row) => row.status === "Gap")
    .sort((a, b) => {
      const order = { P0: 0, P1: 1, P2: 2 };
      return order[a.priority] - order[b.priority] || a.routePath.localeCompare(b.routePath);
    });

  const lines = [];
  lines.push("# Playwright E2E Gap Matrix");
  lines.push("");
  lines.push(`Generated: ${matrix.summary.generatedAt}`);
  lines.push("");
  lines.push(
    "- Method: static route-to-path evidence from Playwright spec files (`apps/web/e2e/*.spec.ts`).",
  );
  lines.push(
    "- Optional dynamic mode (`--dynamic-links`) crawls rendered `<a href>` links from a running app.",
  );
  lines.push(
    "- Limitation: still undercounts links created only after deep client interactions.",
  );
  lines.push("");
  lines.push(`- Total app routes/pages scanned: ${matrix.summary.totalAppRoutes}`);
  lines.push(`- Playwright spec files scanned: ${matrix.summary.totalPlaywrightSpecs}`);
  lines.push(`- Distinct referenced paths found: ${matrix.summary.totalReferencedPaths}`);
  lines.push(`- Static referenced paths: ${matrix.summary.staticReferencedPaths}`);
  lines.push(`- Dynamic referenced paths: ${matrix.summary.dynamicReferencedPaths}`);
  lines.push(`- JS-flow mode enabled: ${matrix.summary.jsFlowsMode ? "yes" : "no"}`);
  lines.push(`- Anchor-crawl discovered paths: ${matrix.dynamic?.anchorDiscoveredPaths ?? 0}`);
  lines.push(`- JS-flow discovered paths: ${matrix.dynamic?.jsFlowDiscoveredPaths ?? 0}`);
  lines.push(`- Covered routes/pages: ${matrix.summary.coveredRoutes}`);
  lines.push(`- Gaps: ${matrix.summary.gaps}`);
  lines.push(
    `- UI coverage: ${matrix.summary.coveredUiRoutes}/${matrix.summary.uiRoutes}`,
  );
  lines.push(
    `- API coverage: ${matrix.summary.coveredApiRoutes}/${matrix.summary.apiRoutes}`,
  );
  lines.push(`- Dynamic mode enabled: ${matrix.summary.dynamicLinksMode ? "yes" : "no"}`);
  if (matrix.dynamic?.errors?.length) {
    lines.push("- Dynamic mode notes:");
    for (const error of matrix.dynamic.errors) {
      lines.push(`  - ${error}`);
    }
  }
  lines.push("");
  lines.push("## Prioritized E2E Gaps");
  lines.push("");
  lines.push("| Priority | Route | Surface | Risk | Suggested Playwright Coverage |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of gapRows.slice(0, 200)) {
    const suggestion =
      row.surface === "api"
        ? "APIRequestContext contract test"
        : row.routePath.startsWith("/admin")
          ? "Authenticated UI journey (happy + guardrail path)"
          : row.routePath.startsWith("/s/")
            ? "Public sign-in flow branch test"
            : "Public navigation/load test";
    lines.push(
      `| ${row.priority} | \`${row.routePath}\` | ${row.surface} | ${row.risk} | ${suggestion} |`,
    );
  }
  lines.push("");
  lines.push("## Full Matrix");
  lines.push("");
  lines.push("| Route | Source File | Surface | Status | Evidence Spec(s) |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const row of matrix.rows) {
    lines.push(
      `| \`${row.routePath}\` | \`${row.sourceFile}\` | ${row.surface} | ${row.status} | ${row.evidenceSpecs.length ? row.evidenceSpecs.map((s) => `\`${s}\``).join(", ") : "-"} |`,
    );
  }
  lines.push("");

  fs.writeFileSync(OUTPUT_MD, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));
  const matrix = await buildMatrix(options);
  writeOutputs(matrix);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        summary: matrix.summary,
        dynamic: matrix.dynamic,
        outputs: {
          jsonPath: rel(OUTPUT_JSON),
          mdPath: rel(OUTPUT_MD),
        },
      },
      null,
      2,
    ),
  );
}

await main();
