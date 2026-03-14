import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import type { UserRole } from "@prisma/client";
import { decryptString, encryptString } from "@/lib/security/data-protection";

export type SsoProvider = "OIDC_GENERIC" | "MICROSOFT_ENTRA";

export interface RoleMapping {
  ADMIN: string[];
  SITE_MANAGER: string[];
  VIEWER: string[];
}

export interface DirectorySyncConfig {
  enabled: boolean;
  tokenHash: string | null;
}

export interface PartnerApiConfig {
  enabled: boolean;
  tokenHash: string | null;
  scopes: string[];
  monthlyQuota: number;
}

export interface CompanySsoConfig {
  enabled: boolean;
  provider: SsoProvider;
  displayName: string;
  issuerUrl: string;
  clientId: string;
  clientSecretEncrypted: string | null;
  scopes: string[];
  autoProvisionUsers: boolean;
  defaultRole: UserRole;
  roleClaimPath: string;
  roleMapping: RoleMapping;
  allowedEmailDomains: string[];
  directorySync: DirectorySyncConfig;
  partnerApi: PartnerApiConfig;
}

const DEFAULT_SCOPES = ["openid", "profile", "email"];
const DEFAULT_PARTNER_API_SCOPES = ["sites.read", "signins.read"];
const MIN_PARTNER_API_MONTHLY_QUOTA = 100;
const MAX_PARTNER_API_MONTHLY_QUOTA = 1_000_000;
const TOKEN_HASH_V2_PREFIX = "v2:";
const TOKEN_HASH_V3_PREFIX = "v3:";
const DEFAULT_ROLE_MAPPING: RoleMapping = {
  ADMIN: ["admin", "admins"],
  SITE_MANAGER: ["site_manager", "site-managers", "manager"],
  VIEWER: ["viewer", "users", "read_only"],
};

function normalizeString(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeUrl(value: unknown): string {
  const raw = normalizeString(value, 2000);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function normalizeRole(value: unknown): UserRole {
  if (value === "ADMIN" || value === "SITE_MANAGER" || value === "VIEWER") {
    return value;
  }
  return "VIEWER";
}

function normalizeStringArray(
  value: unknown,
  maxItems = 20,
  maxItemLength = 120,
): string[] {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const item of value) {
    const normalized = normalizeString(item, maxItemLength);
    if (!normalized) continue;
    deduped.add(normalized);
    if (deduped.size >= maxItems) break;
  }
  return Array.from(deduped);
}

function normalizeEmailDomainArray(value: unknown): string[] {
  const domains = normalizeStringArray(value, 20, 190);
  return domains
    .map((domain) => domain.toLowerCase().replace(/^@/, ""))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain));
}

function normalizeRoleMapping(value: unknown): RoleMapping {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_ROLE_MAPPING };
  }

  const raw = value as Record<string, unknown>;
  return {
    ADMIN: normalizeStringArray(raw.ADMIN ?? DEFAULT_ROLE_MAPPING.ADMIN),
    SITE_MANAGER: normalizeStringArray(
      raw.SITE_MANAGER ?? DEFAULT_ROLE_MAPPING.SITE_MANAGER,
    ),
    VIEWER: normalizeStringArray(raw.VIEWER ?? DEFAULT_ROLE_MAPPING.VIEWER),
  };
}

function normalizePartnerApiScopes(value: unknown): string[] {
  const scopes = normalizeStringArray(value, 20, 80).map((scope) =>
    scope.toLowerCase(),
  );
  if (scopes.length === 0) {
    return [...DEFAULT_PARTNER_API_SCOPES];
  }

  const allowedScopes = new Set(["sites.read", "signins.read"]);
  const filtered = scopes.filter((scope) => allowedScopes.has(scope));
  return filtered.length > 0 ? filtered : [...DEFAULT_PARTNER_API_SCOPES];
}

function normalizePartnerApiQuota(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10_000;
  }
  const rounded = Math.trunc(value);
  return Math.max(
    MIN_PARTNER_API_MONTHLY_QUOTA,
    Math.min(MAX_PARTNER_API_MONTHLY_QUOTA, rounded),
  );
}

export function parseCompanySsoConfig(raw: unknown): CompanySsoConfig {
  const base =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const directoryRaw =
    base.directorySync && typeof base.directorySync === "object"
      ? (base.directorySync as Record<string, unknown>)
      : {};
  const partnerApiRaw =
    base.partnerApi && typeof base.partnerApi === "object"
      ? (base.partnerApi as Record<string, unknown>)
      : {};

  return {
    enabled: base.enabled === true,
    provider:
      base.provider === "MICROSOFT_ENTRA" ? "MICROSOFT_ENTRA" : "OIDC_GENERIC",
    displayName: normalizeString(base.displayName, 120) ?? "Company SSO",
    issuerUrl: normalizeUrl(base.issuerUrl),
    clientId: normalizeString(base.clientId, 300) ?? "",
    clientSecretEncrypted:
      normalizeString(base.clientSecretEncrypted, 4000) ?? null,
    scopes: (() => {
      const scopes = normalizeStringArray(base.scopes, 20, 80);
      return scopes.length > 0 ? scopes : [...DEFAULT_SCOPES];
    })(),
    autoProvisionUsers: base.autoProvisionUsers !== false,
    defaultRole: normalizeRole(base.defaultRole),
    roleClaimPath: normalizeString(base.roleClaimPath, 120) ?? "roles",
    roleMapping: normalizeRoleMapping(base.roleMapping),
    allowedEmailDomains: normalizeEmailDomainArray(base.allowedEmailDomains),
    directorySync: {
      enabled: directoryRaw.enabled === true,
      tokenHash: normalizeString(directoryRaw.tokenHash, 160) ?? null,
    },
    partnerApi: {
      enabled: partnerApiRaw.enabled === true,
      tokenHash: normalizeString(partnerApiRaw.tokenHash, 160) ?? null,
      scopes: normalizePartnerApiScopes(partnerApiRaw.scopes),
      monthlyQuota: normalizePartnerApiQuota(partnerApiRaw.monthlyQuota),
    },
  };
}

export function serializeCompanySsoConfig(
  input: CompanySsoConfig,
): Record<string, unknown> {
  return {
    enabled: input.enabled,
    provider: input.provider,
    displayName: input.displayName,
    issuerUrl: input.issuerUrl,
    clientId: input.clientId,
    clientSecretEncrypted: input.clientSecretEncrypted,
    scopes: input.scopes,
    autoProvisionUsers: input.autoProvisionUsers,
    defaultRole: input.defaultRole,
    roleClaimPath: input.roleClaimPath,
    roleMapping: input.roleMapping,
    allowedEmailDomains: input.allowedEmailDomains,
    directorySync: {
      enabled: input.directorySync.enabled,
      tokenHash: input.directorySync.tokenHash,
    },
    partnerApi: {
      enabled: input.partnerApi.enabled,
      tokenHash: input.partnerApi.tokenHash,
      scopes: input.partnerApi.scopes,
      monthlyQuota: input.partnerApi.monthlyQuota,
    },
  };
}

export function setClientSecret(
  config: CompanySsoConfig,
  plainSecret: string | null,
): CompanySsoConfig {
  if (!plainSecret) return config;

  return {
    ...config,
    clientSecretEncrypted: encryptString(plainSecret.trim()),
  };
}

export function decryptClientSecret(config: CompanySsoConfig): string | null {
  if (!config.clientSecretEncrypted) return null;
  try {
    return decryptString(config.clientSecretEncrypted);
  } catch {
    return null;
  }
}

export function generateDirectorySyncApiKey(): string {
  return `idsync_${randomBytes(24).toString("base64url")}`;
}

export function generatePartnerApiKey(): string {
  return `partner_${randomBytes(24).toString("base64url")}`;
}

function getApiKeyHashSecret(): string {
  const secret =
    process.env.DATA_ENCRYPTION_KEY?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "";

  if (!secret) {
    throw new Error("DATA_ENCRYPTION_KEY or SESSION_SECRET must be configured");
  }

  return secret;
}

function hashLegacyToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashTokenV2(value: string): string {
  return createHmac("sha256", getApiKeyHashSecret()).update(value).digest("hex");
}

function hashTokenV3(value: string): string {
  return scryptSync(value, getApiKeyHashSecret(), 32).toString("hex");
}

function extractStoredTokenDigest(expectedHash: string): {
  digest: string;
  version: "legacy" | "v2" | "v3";
} | null {
  const trimmed = expectedHash.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith(TOKEN_HASH_V3_PREFIX)) {
    return {
      digest: trimmed.slice(TOKEN_HASH_V3_PREFIX.length),
      version: "v3",
    };
  }

  if (trimmed.startsWith(TOKEN_HASH_V2_PREFIX)) {
    return {
      digest: trimmed.slice(TOKEN_HASH_V2_PREFIX.length),
      version: "v2",
    };
  }

  return {
    digest: trimmed,
    version: "legacy",
  };
}

function isHexDigest(value: string): boolean {
  return /^[a-f0-9]+$/i.test(value) && value.length % 2 === 0;
}

function hashToken(value: string): string {
  return `${TOKEN_HASH_V3_PREFIX}${hashTokenV3(value)}`;
}

export function fingerprintApiKey(value: string): string {
  return hashTokenV2(value).slice(0, 16);
}

export function hashDirectorySyncApiKey(apiKey: string): string {
  return hashToken(apiKey);
}

export function hashPartnerApiKey(apiKey: string): string {
  return hashToken(apiKey);
}

export function verifyDirectorySyncApiKey(
  apiKey: string,
  expectedHash: string | null,
): boolean {
  if (!expectedHash) return false;
  const parsed = extractStoredTokenDigest(expectedHash);
  if (!parsed || !isHexDigest(parsed.digest)) return false;
  const providedHash =
    parsed.version === "v3"
      ? hashTokenV3(apiKey)
      : parsed.version === "v2"
        ? hashTokenV2(apiKey)
        : hashLegacyToken(apiKey);
  const expected = Buffer.from(parsed.digest, "hex");
  const provided = Buffer.from(providedHash, "hex");
  if (expected.length === 0 || provided.length === 0) return false;
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function verifyPartnerApiKey(
  apiKey: string,
  expectedHash: string | null,
): boolean {
  if (!expectedHash) return false;
  const parsed = extractStoredTokenDigest(expectedHash);
  if (!parsed || !isHexDigest(parsed.digest)) return false;
  const providedHash =
    parsed.version === "v3"
      ? hashTokenV3(apiKey)
      : parsed.version === "v2"
        ? hashTokenV2(apiKey)
        : hashLegacyToken(apiKey);
  const expected = Buffer.from(parsed.digest, "hex");
  const provided = Buffer.from(providedHash, "hex");
  if (expected.length === 0 || provided.length === 0) return false;
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

function normalizeClaimValue(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getClaimByPath(
  claims: Record<string, unknown>,
  path: string,
): unknown {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return undefined;

  let cursor: unknown = claims;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

export function resolveRoleFromClaims(
  claims: Record<string, unknown>,
  config: CompanySsoConfig,
): UserRole {
  const claimValues = normalizeClaimValue(
    getClaimByPath(claims, config.roleClaimPath),
  ).map((value) => value.toLowerCase());

  const matchesRole = (role: UserRole): boolean => {
    const mapping = config.roleMapping[role].map((value) => value.toLowerCase());
    return mapping.some((mapped) => claimValues.includes(mapped));
  };

  if (matchesRole("ADMIN")) return "ADMIN";
  if (matchesRole("SITE_MANAGER")) return "SITE_MANAGER";
  if (matchesRole("VIEWER")) return "VIEWER";
  return config.defaultRole;
}

export function isEmailDomainAllowed(
  email: string,
  config: CompanySsoConfig,
): boolean {
  if (config.allowedEmailDomains.length === 0) return true;

  const [, domain = ""] = email.toLowerCase().split("@");
  if (!domain) return false;
  return config.allowedEmailDomains.includes(domain);
}
