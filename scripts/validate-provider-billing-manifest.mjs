import fs from "fs/promises";
import path from "path";

function fail(message) {
  console.error(`provider-billing-check: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (!token?.startsWith("--") || !next || next.startsWith("--")) {
      continue;
    }
    args.set(token.slice(2), next);
    index += 1;
  }
  return args;
}

function normalizeProvider(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.get("file") || process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE;
  if (!filePath) {
    fail("missing --file <manifest.json> or BUDGET_TELEMETRY_PROVIDER_BILLING_FILE");
  }

  const resolvedPath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const manifest = JSON.parse(raw);

  if (!manifest || typeof manifest !== "object") {
    fail("manifest must be a JSON object");
  }

  const capturedAt = normalizeDate(manifest.capturedAt);
  if (!capturedAt) {
    fail("manifest.capturedAt must be a valid ISO date");
  }

  if (!/^\d{4}-\d{2}$/.test(String(manifest.month ?? ""))) {
    fail("manifest.month must be in YYYY-MM format");
  }

  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    fail("manifest.entries must contain at least one provider entry");
  }

  const requiredProviders = String(
    args.get("required") || process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS || "",
  )
    .split(",")
    .map(normalizeProvider)
    .filter(Boolean);

  const allowedSourceTypes = new Set(["provider_api", "invoice_export"]);
  const presentProviders = new Set();
  let totalSpendNzd = 0;

  for (const [index, entry] of manifest.entries.entries()) {
    const provider = normalizeProvider(entry.provider);
    const sourceType = String(entry.sourceType ?? "").trim().toLowerCase();
    const entryCapturedAt = normalizeDate(entry.capturedAt);
    const amountNzd = Number(entry.amountNzd);

    if (!provider) {
      fail(`entries[${index}].provider is required`);
    }
    if (!allowedSourceTypes.has(sourceType)) {
      fail(
        `entries[${index}].sourceType must be one of ${Array.from(allowedSourceTypes).join(", ")}`,
      );
    }
    if (!entryCapturedAt) {
      fail(`entries[${index}].capturedAt must be a valid ISO date`);
    }
    if (!Number.isFinite(amountNzd) || amountNzd < 0) {
      fail(`entries[${index}].amountNzd must be a non-negative number`);
    }

    presentProviders.add(provider);
    totalSpendNzd += amountNzd;
  }

  const missingProviders = requiredProviders.filter(
    (provider) => !presentProviders.has(provider),
  );
  if (missingProviders.length > 0) {
    fail(`missing required providers: ${missingProviders.join(", ")}`);
  }

  console.log("provider-billing-check: PASS");
  console.log(`manifest: ${resolvedPath}`);
  console.log(`capturedAt: ${capturedAt.toISOString()}`);
  console.log(`month: ${manifest.month}`);
  console.log(`providers: ${Array.from(presentProviders).sort().join(", ")}`);
  console.log(`totalSpendNzd: ${totalSpendNzd.toFixed(2)}`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
