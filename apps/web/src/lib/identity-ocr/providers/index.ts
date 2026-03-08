import { findCompanyComplianceSettings } from "@/lib/repository/company.repository";
import type { IdentityOcrProvider } from "./base";
import { MockIdentityOcrProvider } from "./mock";
import { TextractIdentityOcrProvider } from "./textract";

const DEFAULT_PROVIDER_KEY = "MOCK";
const DEFAULT_TEXTRACT_REGION = "ap-southeast-2";
const RESIDENCY_CACHE_TTL_MS = 5 * 60 * 1000;

const providerCache = new Map<string, IdentityOcrProvider>();
const residencyCache = new Map<
  string,
  { region: "NZ" | "AU" | "APAC" | "GLOBAL"; expiresAt: number }
>();

function normalizeProviderKey(value: string | undefined | null): string {
  return value?.trim().toUpperCase() || DEFAULT_PROVIDER_KEY;
}

function normalizeResidencyRegion(
  value: string | null | undefined,
): "NZ" | "AU" | "APAC" | "GLOBAL" {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "NZ") return "NZ";
  if (normalized === "AU") return "AU";
  if (normalized === "APAC") return "APAC";
  return "GLOBAL";
}

function resolveProviderKeyForRegion(
  region: "NZ" | "AU" | "APAC" | "GLOBAL",
): string {
  const fallback = normalizeProviderKey(process.env.OCR_PROVIDER);
  if (region === "NZ") {
    return normalizeProviderKey(process.env.OCR_PROVIDER_NZ) || fallback;
  }
  if (region === "AU") {
    return normalizeProviderKey(process.env.OCR_PROVIDER_AU) || fallback;
  }
  if (region === "APAC") {
    return normalizeProviderKey(process.env.OCR_PROVIDER_APAC) || fallback;
  }
  return normalizeProviderKey(process.env.OCR_PROVIDER_GLOBAL) || fallback;
}

function parseTextractRegion(providerKey: string): string {
  if (providerKey === "TEXTRACT" || providerKey === "AWS_TEXTRACT") {
    return process.env.OCR_TEXTRACT_REGION?.trim() || DEFAULT_TEXTRACT_REGION;
  }

  if (providerKey.startsWith("TEXTRACT_")) {
    return providerKey.slice("TEXTRACT_".length).toLowerCase().replace(/_/g, "-");
  }

  if (providerKey.startsWith("AWS_TEXTRACT_")) {
    return providerKey
      .slice("AWS_TEXTRACT_".length)
      .toLowerCase()
      .replace(/_/g, "-");
  }

  return DEFAULT_TEXTRACT_REGION;
}

function buildProvider(providerKey: string): IdentityOcrProvider {
  if (providerKey === "MOCK") {
    return new MockIdentityOcrProvider();
  }

  if (
    providerKey === "TEXTRACT" ||
    providerKey === "AWS_TEXTRACT" ||
    providerKey.startsWith("TEXTRACT_") ||
    providerKey.startsWith("AWS_TEXTRACT_")
  ) {
    const region = parseTextractRegion(providerKey);
    return new TextractIdentityOcrProvider({
      providerKey,
      region,
    });
  }

  return new MockIdentityOcrProvider();
}

function getProvider(providerKey: string): IdentityOcrProvider {
  const normalized = normalizeProviderKey(providerKey);
  const cached = providerCache.get(normalized);
  if (cached) {
    return cached;
  }

  const provider = buildProvider(normalized);
  providerCache.set(normalized, provider);
  return provider;
}

async function resolveCompanyResidencyRegion(
  companyId: string,
): Promise<"NZ" | "AU" | "APAC" | "GLOBAL"> {
  const now = Date.now();
  const cached = residencyCache.get(companyId);
  if (cached && cached.expiresAt > now) {
    return cached.region;
  }

  let region: "NZ" | "AU" | "APAC" | "GLOBAL" = "GLOBAL";
  try {
    const settings = await findCompanyComplianceSettings(companyId);
    region = normalizeResidencyRegion(settings?.data_residency_region);
  } catch {
    // Fall back to global routing so OCR does not fail closed on residency lookup errors.
    region = "GLOBAL";
  }

  residencyCache.set(companyId, {
    region,
    expiresAt: now + RESIDENCY_CACHE_TTL_MS,
  });

  return region;
}

export async function resolveIdentityOcrProvider(
  companyId: string,
): Promise<IdentityOcrProvider> {
  const region = await resolveCompanyResidencyRegion(companyId);
  const providerKey = resolveProviderKeyForRegion(region);
  return getProvider(providerKey);
}

export function resetIdentityOcrProviderCachesForTests(): void {
  providerCache.clear();
  residencyCache.clear();
}
