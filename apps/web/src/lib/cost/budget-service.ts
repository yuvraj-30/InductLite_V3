import fs from "fs/promises";
import { GUARDRAILS } from "@/lib/guardrails";
import {
  getComputeCounterSnapshot,
  recordComputeInvocation,
  recordComputeRuntimeMinutes,
  type ComputeEntrypoint,
} from "./compute-counters";

const NZD_TIER_BUDGETS = {
  MVP: 150,
  EARLY: 500,
  GROWTH: 2000,
} as const;

const BUDGET_SOFT_LIMIT_THRESHOLD = 0.8;
const DEFAULT_STALE_AFTER_HOURS = 6;

export type BudgetPathId =
  | "auth.login"
  | "auth.logout"
  | "auth.session.refresh"
  | "public.signin.create"
  | "public.signout.complete"
  | "compliance.export.download"
  | "admin.export.create"
  | "admin.export.download"
  | "notifications.sms.send"
  | "notifications.email.queue"
  | "visual-regression.run";

export type BudgetMode = "NORMAL" | "SOFT_LIMIT" | "BUDGET_PROTECT";

export interface BudgetTelemetrySnapshot {
  source: string;
  capturedAt: string | Date;
  actualSpendNzd: number;
  periodStart?: string | Date;
  periodEnd?: string | Date;
  notes?: string | null;
}

export interface BudgetTelemetryProvider {
  loadLatestSnapshot(): Promise<BudgetTelemetrySnapshot | null>;
}

interface ProviderBillingManifestEntry {
  provider: string;
  sourceType: "provider_api" | "invoice_export";
  capturedAt: string | Date;
  amountNzd: number;
  invoiceRef?: string | null;
  originalCurrency?: string | null;
  originalAmount?: number | null;
  fxRateToNzd?: number | null;
  notes?: string | null;
}

interface ProviderBillingManifest {
  capturedAt: string | Date;
  month: string;
  entries: ProviderBillingManifestEntry[];
  notes?: string | null;
}

export interface BudgetSignal {
  controlId: string;
  violatedLimit: string;
  message: string;
  ratio?: number;
}

export interface BudgetState {
  mode: BudgetMode;
  budgetTier: keyof typeof NZD_TIER_BUDGETS;
  monthlyBudgetNzd: number;
  projectedSpendNzd: number | null;
  actualSpendNzd: number | null;
  telemetrySource: string | null;
  telemetryCapturedAt: string | null;
  telemetryStale: boolean;
  signals: BudgetSignal[];
  criticalPaths: BudgetPathId[];
}

export interface BudgetDecision {
  allowed: boolean;
  mode: BudgetMode;
  controlId: string | null;
  violatedLimit: string | null;
  scope: "environment";
  message: string;
  state: BudgetState;
}

interface ParsedTelemetrySnapshot {
  source: string;
  capturedAt: Date;
  actualSpendNzd: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  notes: string | null;
}

const CRITICAL_BUDGET_PATHS = new Set<BudgetPathId>([
  "auth.login",
  "auth.logout",
  "auth.session.refresh",
  "public.signin.create",
  "public.signout.complete",
  "compliance.export.download",
]);

const SOFT_LIMIT_DENIED_PATHS = new Set<BudgetPathId>([
  "admin.export.create",
  "admin.export.download",
  "notifications.sms.send",
  "notifications.email.queue",
  "visual-regression.run",
]);

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDate(value: string | Date | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTelemetrySnapshot(
  raw: BudgetTelemetrySnapshot | null,
): ParsedTelemetrySnapshot | null {
  if (!raw) {
    return null;
  }

  const capturedAt = normalizeDate(raw.capturedAt);
  if (!capturedAt) {
    return null;
  }

  const actualSpendNzd = Number(raw.actualSpendNzd);
  if (!Number.isFinite(actualSpendNzd) || actualSpendNzd < 0) {
    return null;
  }

  return {
    source: raw.source?.trim() || "unknown",
    capturedAt,
    actualSpendNzd,
    periodStart: normalizeDate(raw.periodStart),
    periodEnd: normalizeDate(raw.periodEnd),
    notes: raw.notes?.trim() || null,
  };
}

async function loadTelemetrySnapshotFromFile(
  filePath: string,
): Promise<BudgetTelemetrySnapshot | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as BudgetTelemetrySnapshot;
  } catch {
    return null;
  }
}

async function loadProviderBillingManifestFromFile(
  filePath: string,
): Promise<ProviderBillingManifest | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as ProviderBillingManifest;
  } catch {
    return null;
  }
}

async function loadProviderBillingManifestFromUrl(
  url: string,
): Promise<ProviderBillingManifest | null> {
  try {
    const token = process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_TOKEN?.trim();
    const response = await fetch(url, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ProviderBillingManifest;
  } catch {
    return null;
  }
}

function normalizeProviderKey(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "_");
}

function parseRequiredProviders(): string[] {
  return (process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS ?? "")
    .split(",")
    .map((value) => normalizeProviderKey(value))
    .filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
}

function buildUtcMonthRange(monthKey: string): {
  periodStart: Date;
  periodEnd: Date;
} | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 1)),
  };
}

function buildTelemetrySnapshotFromProviderBillingManifest(
  manifest: ProviderBillingManifest | null,
): BudgetTelemetrySnapshot | null {
  if (!manifest) {
    return null;
  }

  const capturedAt = normalizeDate(manifest.capturedAt);
  const monthRange = buildUtcMonthRange(manifest.month?.trim() ?? "");
  if (!capturedAt || !monthRange || !Array.isArray(manifest.entries)) {
    return null;
  }

  const allowedSourceTypes = new Set(["provider_api", "invoice_export"]);
  const providers = new Set<string>();
  let actualSpendNzd = 0;

  for (const entry of manifest.entries) {
    const provider = normalizeProviderKey(entry.provider ?? "");
    const sourceType = entry.sourceType?.trim().toLowerCase();
    const entryCapturedAt = normalizeDate(entry.capturedAt);
    const amountNzd = Number(entry.amountNzd);

    if (
      !provider ||
      !sourceType ||
      !allowedSourceTypes.has(sourceType) ||
      !entryCapturedAt ||
      !Number.isFinite(amountNzd) ||
      amountNzd < 0
    ) {
      return null;
    }

    providers.add(provider);
    actualSpendNzd += amountNzd;
  }

  const requiredProviders = parseRequiredProviders();
  if (
    requiredProviders.length > 0 &&
    requiredProviders.some((provider) => !providers.has(provider))
  ) {
    return null;
  }

  return {
    source: `provider-billing-manifest:${Array.from(providers).sort().join(",")}`,
    capturedAt,
    actualSpendNzd,
    periodStart: monthRange.periodStart,
    periodEnd: monthRange.periodEnd,
    notes: manifest.notes?.trim() || null,
  };
}

async function loadProviderBillingTelemetrySnapshot(): Promise<BudgetTelemetrySnapshot | null> {
  const jsonPayload = process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON?.trim();
  if (jsonPayload) {
    try {
      return buildTelemetrySnapshotFromProviderBillingManifest(
        JSON.parse(jsonPayload) as ProviderBillingManifest,
      );
    } catch {
      return null;
    }
  }

  const remoteUrl = process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_URL?.trim();
  if (remoteUrl) {
    return buildTelemetrySnapshotFromProviderBillingManifest(
      await loadProviderBillingManifestFromUrl(remoteUrl),
    );
  }

  const filePath = process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE?.trim();
  if (filePath) {
    return buildTelemetrySnapshotFromProviderBillingManifest(
      await loadProviderBillingManifestFromFile(filePath),
    );
  }

  return null;
}

async function loadDefaultTelemetrySnapshot(): Promise<BudgetTelemetrySnapshot | null> {
  const providerBillingSnapshot = await loadProviderBillingTelemetrySnapshot();
  if (providerBillingSnapshot) {
    return providerBillingSnapshot;
  }

  const jsonPayload = process.env.BUDGET_TELEMETRY_SNAPSHOT_JSON?.trim();
  if (jsonPayload) {
    try {
      return JSON.parse(jsonPayload) as BudgetTelemetrySnapshot;
    } catch {
      return null;
    }
  }

  const filePath = process.env.BUDGET_TELEMETRY_SNAPSHOT_FILE?.trim();
  if (filePath) {
    return loadTelemetrySnapshotFromFile(filePath);
  }

  return null;
}

class EnvBudgetTelemetryProvider implements BudgetTelemetryProvider {
  async loadLatestSnapshot(): Promise<BudgetTelemetrySnapshot | null> {
    return loadDefaultTelemetrySnapshot();
  }
}

const defaultTelemetryProvider = new EnvBudgetTelemetryProvider();

function getDaysInUtcMonth(date: Date): number {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

function getElapsedUtcDaysInMonth(now: Date): number {
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const elapsedMs = now.getTime() - monthStart;
  return Math.max(1 / 24, elapsedMs / (24 * 60 * 60 * 1000));
}

function summarizeComputeSignals(): BudgetSignal[] {
  const snapshot = getComputeCounterSnapshot();
  const totalInvocations = Object.values(snapshot).reduce(
    (sum, entry) => sum + entry.invocations,
    0,
  );
  const totalRuntimeMinutes = Object.values(snapshot).reduce(
    (sum, entry) => sum + entry.runtimeMinutes,
    0,
  );

  const evaluatedSignals: Array<BudgetSignal | null> = [
    summarizeSignal(
      "COST-003",
      "MAX_MONTHLY_JOB_MINUTES",
      snapshot.scheduled_job.runtimeMinutes,
      GUARDRAILS.MAX_MONTHLY_JOB_MINUTES,
      "Scheduled job runtime minutes are within the monthly guardrail",
    ),
    summarizeSignal(
      "COST-004",
      "MAX_MONTHLY_SERVER_ACTION_INVOCATIONS",
      snapshot.server_action.invocations,
      GUARDRAILS.MAX_MONTHLY_SERVER_ACTION_INVOCATIONS,
      "Server action invocations are within the monthly guardrail",
    ),
    summarizeSignal(
      "COST-005",
      "MAX_MONTHLY_COMPUTE_INVOCATIONS",
      totalInvocations,
      GUARDRAILS.MAX_MONTHLY_COMPUTE_INVOCATIONS,
      "Compute invocations are within the monthly guardrail",
    ),
    summarizeSignal(
      "COST-006",
      "MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES",
      totalRuntimeMinutes,
      GUARDRAILS.MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES,
      "Compute runtime minutes are within the monthly guardrail",
    ),
  ];

  return evaluatedSignals.filter((signal): signal is BudgetSignal => Boolean(signal));
}

function summarizeSignal(
  controlId: string,
  limitName: string,
  current: number,
  limit: number,
  message: string,
): BudgetSignal | null {
  if (!Number.isFinite(current) || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }

  const ratio = current / limit;
  if (ratio < BUDGET_SOFT_LIMIT_THRESHOLD) {
    return null;
  }

  return {
    controlId,
    violatedLimit: `${limitName}=${limit}`,
    message: `${message} (${current}/${limit})`,
    ratio,
  };
}

function buildSpendSignals(
  now: Date,
  telemetry: ParsedTelemetrySnapshot | null,
): {
  projectedSpendNzd: number | null;
  actualSpendNzd: number | null;
  telemetrySource: string | null;
  telemetryCapturedAt: string | null;
  telemetryStale: boolean;
  signals: BudgetSignal[];
} {
  const monthlyBudgetNzd = NZD_TIER_BUDGETS[GUARDRAILS.ENV_BUDGET_TIER];
  const staleAfterHours = parsePositiveNumber(
    process.env.BUDGET_TELEMETRY_STALE_AFTER_HOURS,
    DEFAULT_STALE_AFTER_HOURS,
  );
  const staleThresholdMs = staleAfterHours * 60 * 60 * 1000;
  const requireTelemetryFailSafe = process.env.NODE_ENV === "production";

  if (!telemetry) {
    return {
      projectedSpendNzd: null,
      actualSpendNzd: null,
      telemetrySource: null,
      telemetryCapturedAt: null,
      telemetryStale: requireTelemetryFailSafe,
      signals: requireTelemetryFailSafe
        ? [
            {
              controlId: "COST-008",
              violatedLimit: `BUDGET_TELEMETRY_STALE_AFTER_HOURS=${staleAfterHours}`,
              message:
                "Budget telemetry is missing, so the environment must enter BUDGET_PROTECT fail-safe mode",
              ratio: 1,
            },
          ]
        : [],
    };
  }

  const telemetryAgeMs = now.getTime() - telemetry.capturedAt.getTime();
  const telemetryStale = telemetryAgeMs > staleThresholdMs;
  const elapsedDays = getElapsedUtcDaysInMonth(now);
  const projectedSpendNzd =
    (telemetry.actualSpendNzd / elapsedDays) * getDaysInUtcMonth(now);
  const signals: BudgetSignal[] = [];

  if (telemetryStale) {
    signals.push({
      controlId: "COST-008",
      violatedLimit: `BUDGET_TELEMETRY_STALE_AFTER_HOURS=${staleAfterHours}`,
      message:
        "Budget telemetry is stale, so the environment must enter BUDGET_PROTECT fail-safe mode",
      ratio: 1,
    });
  }

  const spendRatio = projectedSpendNzd / monthlyBudgetNzd;
  if (spendRatio >= 1) {
    signals.push({
      controlId: "COST-008",
      violatedLimit: `PROJECTED_MONTHLY_SPEND_NZD<=${monthlyBudgetNzd}`,
      message: `Projected monthly spend ${projectedSpendNzd.toFixed(2)} NZD exceeds the ${GUARDRAILS.ENV_BUDGET_TIER} budget`,
      ratio: spendRatio,
    });
  } else if (spendRatio >= BUDGET_SOFT_LIMIT_THRESHOLD) {
    signals.push({
      controlId: "COST-009",
      violatedLimit: `PROJECTED_MONTHLY_SPEND_NZD<=${monthlyBudgetNzd}`,
      message: `Projected monthly spend ${projectedSpendNzd.toFixed(2)} NZD exceeded the 80% soft limit for ${GUARDRAILS.ENV_BUDGET_TIER}`,
      ratio: spendRatio,
    });
  }

  return {
    projectedSpendNzd,
    actualSpendNzd: telemetry.actualSpendNzd,
    telemetrySource: telemetry.source,
    telemetryCapturedAt: telemetry.capturedAt.toISOString(),
    telemetryStale,
    signals,
  };
}

function deriveBudgetMode(signals: BudgetSignal[]): BudgetMode {
  const hardSignal = signals.some(
    (signal) =>
      signal.controlId === "COST-008" ||
      (typeof signal.ratio === "number" && signal.ratio >= 1),
  );
  if (hardSignal) {
    return "BUDGET_PROTECT";
  }

  const softSignal = signals.some(
    (signal) =>
      signal.controlId === "COST-009" ||
      (typeof signal.ratio === "number" &&
        signal.ratio >= BUDGET_SOFT_LIMIT_THRESHOLD),
  );
  if (softSignal) {
    return "SOFT_LIMIT";
  }

  return "NORMAL";
}

export async function getBudgetState(
  provider: BudgetTelemetryProvider = defaultTelemetryProvider,
): Promise<BudgetState> {
  const now = new Date();
  const telemetry = parseTelemetrySnapshot(await provider.loadLatestSnapshot());
  const spendState = buildSpendSignals(now, telemetry);
  const computeSignals = summarizeComputeSignals();
  const signals = [...spendState.signals, ...computeSignals];

  return {
    mode: deriveBudgetMode(signals),
    budgetTier: GUARDRAILS.ENV_BUDGET_TIER,
    monthlyBudgetNzd: NZD_TIER_BUDGETS[GUARDRAILS.ENV_BUDGET_TIER],
    projectedSpendNzd: spendState.projectedSpendNzd,
    actualSpendNzd: spendState.actualSpendNzd,
    telemetrySource: spendState.telemetrySource,
    telemetryCapturedAt: spendState.telemetryCapturedAt,
    telemetryStale: spendState.telemetryStale,
    signals,
    criticalPaths: Array.from(CRITICAL_BUDGET_PATHS),
  };
}

function getPrimarySignal(
  mode: BudgetMode,
  state: BudgetState,
): BudgetSignal | null {
  if (mode === "BUDGET_PROTECT") {
    return (
      state.signals.find((signal) => signal.controlId === "COST-008") ??
      state.signals.find((signal) => (signal.ratio ?? 0) >= 1) ??
      null
    );
  }

  if (mode === "SOFT_LIMIT") {
    return (
      state.signals.find((signal) => signal.controlId === "COST-009") ??
      state.signals.find(
        (signal) =>
          (signal.ratio ?? 0) >= BUDGET_SOFT_LIMIT_THRESHOLD &&
          (signal.ratio ?? 0) < 1,
      ) ??
      null
    );
  }

  return null;
}

export async function enforceBudgetPath(
  pathId: BudgetPathId,
  provider: BudgetTelemetryProvider = defaultTelemetryProvider,
): Promise<BudgetDecision> {
  const state = await getBudgetState(provider);
  if (state.mode === "NORMAL") {
    return {
      allowed: true,
      mode: state.mode,
      controlId: null,
      violatedLimit: null,
      scope: "environment",
      message: "Budget state is healthy",
      state,
    };
  }

  if (
    state.mode === "SOFT_LIMIT" &&
    !SOFT_LIMIT_DENIED_PATHS.has(pathId)
  ) {
    return {
      allowed: true,
      mode: state.mode,
      controlId: null,
      violatedLimit: null,
      scope: "environment",
      message: "Budget soft limit is active, but this path remains allowed",
      state,
    };
  }

  if (
    state.mode === "BUDGET_PROTECT" &&
    CRITICAL_BUDGET_PATHS.has(pathId)
  ) {
    return {
      allowed: true,
      mode: state.mode,
      controlId: null,
      violatedLimit: null,
      scope: "environment",
      message: "BUDGET_PROTECT is active, but this critical path remains allowed",
      state,
    };
  }

  const primarySignal = getPrimarySignal(state.mode, state);
  const defaultControlId = state.mode === "BUDGET_PROTECT" ? "COST-008" : "COST-009";

  return {
    allowed: false,
    mode: state.mode,
    controlId: primarySignal?.controlId ?? defaultControlId,
    violatedLimit:
      primarySignal?.violatedLimit ??
      `ENV_BUDGET_TIER=${state.budgetTier}`,
    scope: "environment",
    message:
      state.mode === "BUDGET_PROTECT"
        ? "This operation is disabled because the environment is in BUDGET_PROTECT mode"
        : "This non-critical operation is disabled because the environment exceeded the budget soft limit",
    state,
  };
}

export function startBudgetTrackedOperation(
  entrypoint: ComputeEntrypoint,
): () => void {
  const startedAt = Date.now();
  recordComputeInvocation(entrypoint);

  return () => {
    const elapsedMinutes = (Date.now() - startedAt) / 60_000;
    recordComputeRuntimeMinutes(entrypoint, elapsedMinutes);
  };
}
