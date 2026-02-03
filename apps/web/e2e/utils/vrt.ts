import fs from "fs";
import path from "path";

const VRT_ENABLED = process.env.VRT_ENABLED === "1";
const VRT_API_URL = process.env.VRT_API_URL || "http://localhost:8080";
const VRT_API_KEY = process.env.VRT_API_KEY || "";

function ensureDir(p: string) {
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch (err) {
    // noop
  }
}

/**
 * Upload a screenshot buffer to a VisualRegressionTracker instance via its upload endpoint.
 * This is a minimal helper that attempts a multipart/form-data POST to `/api/runs/upload`.
 * Works for quick local-testing when VRT is available.
 */
export async function uploadScreenshotToVrt(opts: {
  name: string;
  buffer: Buffer;
  browser?: string;
  viewport?: { width: number; height: number };
  project?: string;
}) {
  if (!VRT_ENABLED) {
    const outDir = path.resolve(process.cwd(), "e2e/vrt-local-out");
    ensureDir(outDir);
    const outFile = path.join(outDir, `${Date.now()}-${opts.name}.png`);
    fs.writeFileSync(outFile, opts.buffer);
    console.warn(
      `VRT_DISABLED: wrote screenshot to ${outFile} (set VRT_ENABLED=1,VRT_API_URL and VRT_API_KEY to upload)`,
    );
    return { skipped: true, path: outFile };
  }

  if (!VRT_API_KEY || !VRT_API_URL) {
    throw new Error(
      "VRT_ENABLED is set but VRT_API_URL or VRT_API_KEY is missing in environment",
    );
  }

  // Use global fetch (Node 18+). Build multipart form data
  // If runtime doesn't support global FormData/Blob, fallback to saving locally.

  if (typeof FormData === "undefined" || typeof Blob === "undefined") {
    const outDir = path.resolve(process.cwd(), "e2e/vrt-local-out");
    ensureDir(outDir);
    const outFile = path.join(outDir, `${Date.now()}-${opts.name}.png`);
    fs.writeFileSync(outFile, opts.buffer);
    console.warn(
      `No FormData/Blob support in this Node runtime; wrote screenshot to ${outFile}`,
    );
    return { skipped: true, path: outFile };
  }

  const form = new FormData();
  // fields commonly accepted by the VRT upload API - tune for your server if needed
  form.append(
    "project",
    opts.project || process.env.VRT_PROJECT_NAME || "default",
  );
  form.append("name", opts.name);
  form.append(
    "branchName",
    process.env.GITHUB_REF_NAME || process.env.BRANCH || "local",
  );
  form.append(
    "buildName",
    process.env.CI_BUILD_ID || process.env.BUILD_NAME || "local-build",
  );
  if (opts.browser) form.append("browser", opts.browser);
  if (opts.viewport)
    form.append("viewport", `${opts.viewport.width}x${opts.viewport.height}`);

  // Convert Node Buffer to ArrayBuffer slice for Blob
  const ab = opts.buffer.buffer.slice(
    opts.buffer.byteOffset,
    opts.buffer.byteOffset + opts.buffer.byteLength,
  ) as ArrayBuffer;
  // Use a Uint8Array to provide an ArrayBufferView to Blob and avoid SharedArrayBuffer typing issues
  const blob = new Blob([new Uint8Array(ab)], { type: "image/png" });
  // field name `image` matches many VRT setups — change if your backend expects another name
  form.append("image", blob, `${opts.name}.png`);

  const url = `${VRT_API_URL.replace(/\/$/, "")}/test-runs/multipart`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VRT_API_KEY}`,
    },
    body: form as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `VRT upload failed: ${res.status} ${res.statusText} - ${text}`,
    );
  }

  const json = await res.json();
  return { skipped: false, res: json };
}
