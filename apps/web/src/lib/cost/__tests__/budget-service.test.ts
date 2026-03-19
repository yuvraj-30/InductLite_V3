import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("budget service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-20T12:00:00.000Z"));
    process.env = {
      ...originalEnv,
      ENV_BUDGET_TIER: "MVP",
      MAX_MONTHLY_EGRESS_GB: "100",
      MAX_MONTHLY_STORAGE_GB: "50",
      MAX_MONTHLY_JOB_MINUTES: "1000",
      MAX_MONTHLY_SERVER_ACTION_INVOCATIONS: "1000000",
      MAX_MONTHLY_COMPUTE_INVOCATIONS: "1200000",
      MAX_MONTHLY_COMPUTE_RUNTIME_MINUTES: "2500",
    };
    delete process.env.BUDGET_TELEMETRY_SNAPSHOT_JSON;
    delete process.env.BUDGET_TELEMETRY_SNAPSHOT_FILE;
    delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_FILE;
    delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON;
    delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_URL;
    delete process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_TOKEN;
    delete process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS;
    delete process.env.BUDGET_TELEMETRY_STALE_AFTER_HOURS;
  });

  afterEach(async () => {
    const counters = await import("../compute-counters");
    counters.resetComputeCounters();
    vi.useRealTimers();
    process.env = originalEnv;
  });

  it("enters soft limit and denies non-critical export creation when projected spend exceeds 80%", async () => {
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    process.env.BUDGET_TELEMETRY_SNAPSHOT_JSON = JSON.stringify({
      source: "provider-billing",
      capturedAt: now.toISOString(),
      periodStart: monthStart.toISOString(),
      actualSpendNzd: 80,
    });

    const budgetService = await import("../budget-service");
    const state = await budgetService.getBudgetState();
    const deniedDecision = await budgetService.enforceBudgetPath(
      "admin.export.create",
    );
    const allowedDecision = await budgetService.enforceBudgetPath(
      "public.signin.create",
    );

    expect(state.mode).toBe("SOFT_LIMIT");
    expect(deniedDecision.allowed).toBe(false);
    expect(deniedDecision.controlId).toBe("COST-009");
    expect(allowedDecision.allowed).toBe(true);
  });

  it("enters BUDGET_PROTECT when telemetry is stale and still allows compliance export retrieval", async () => {
    process.env.BUDGET_TELEMETRY_STALE_AFTER_HOURS = "6";
    process.env.BUDGET_TELEMETRY_SNAPSHOT_JSON = JSON.stringify({
      source: "provider-billing",
      capturedAt: "2026-03-01T00:00:00.000Z",
      periodStart: "2026-03-01T00:00:00.000Z",
      actualSpendNzd: 25,
    });

    const budgetService = await import("../budget-service");
    const state = await budgetService.getBudgetState();
    const deniedDecision = await budgetService.enforceBudgetPath(
      "notifications.sms.send",
    );
    const allowedDecision = await budgetService.enforceBudgetPath(
      "compliance.export.download",
    );

    expect(state.mode).toBe("BUDGET_PROTECT");
    expect(state.telemetryStale).toBe(true);
    expect(deniedDecision.allowed).toBe(false);
    expect(deniedDecision.controlId).toBe("COST-008");
    expect(allowedDecision.allowed).toBe(true);
  });

  it("uses compute counters as a hard-stop signal when runtime caps are exceeded", async () => {
    process.env.MAX_MONTHLY_SERVER_ACTION_INVOCATIONS = "1";
    process.env.BUDGET_TELEMETRY_SNAPSHOT_JSON = JSON.stringify({
      source: "provider-billing",
      capturedAt: new Date().toISOString(),
      periodStart: new Date().toISOString(),
      actualSpendNzd: 10,
    });

    const budgetService = await import("../budget-service");
    const counters = await import("../compute-counters");

    counters.recordComputeInvocation("server_action");
    counters.recordComputeInvocation("server_action");

    const state = await budgetService.getBudgetState();
    const decision = await budgetService.enforceBudgetPath("admin.export.create");

    expect(state.mode).toBe("BUDGET_PROTECT");
    expect(
      state.signals.some((signal) => signal.controlId === "COST-004"),
    ).toBe(true);
    expect(decision.allowed).toBe(false);
  });

  it("aggregates provider billing manifests and exposes a provider-backed telemetry source", async () => {
    process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS = "render, neon";
    process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON = JSON.stringify({
      capturedAt: "2026-03-20T11:45:00.000Z",
      month: "2026-03",
      entries: [
        {
          provider: "render",
          sourceType: "provider_api",
          capturedAt: "2026-03-20T11:40:00.000Z",
          amountNzd: 55,
        },
        {
          provider: "neon",
          sourceType: "invoice_export",
          capturedAt: "2026-03-20T11:42:00.000Z",
          amountNzd: 35,
        },
      ],
    });

    const budgetService = await import("../budget-service");
    const state = await budgetService.getBudgetState();

    expect(state.telemetrySource).toContain("provider-billing-manifest");
    expect(state.actualSpendNzd).toBe(90);
    expect(state.mode).toBe("SOFT_LIMIT");
  });

  it("fails closed when a required provider feed is missing from the manifest", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.BUDGET_TELEMETRY_REQUIRED_PROVIDERS = "render, neon, upstash";
    process.env.BUDGET_TELEMETRY_PROVIDER_BILLING_JSON = JSON.stringify({
      capturedAt: "2026-03-20T11:45:00.000Z",
      month: "2026-03",
      entries: [
        {
          provider: "render",
          sourceType: "provider_api",
          capturedAt: "2026-03-20T11:40:00.000Z",
          amountNzd: 40,
        },
        {
          provider: "neon",
          sourceType: "invoice_export",
          capturedAt: "2026-03-20T11:42:00.000Z",
          amountNzd: 20,
        },
      ],
    });

    const budgetService = await import("../budget-service");
    const state = await budgetService.getBudgetState();

    expect(state.mode).toBe("BUDGET_PROTECT");
    expect(state.telemetrySource).toBeNull();
    expect(state.signals.some((signal) => signal.controlId === "COST-008")).toBe(
      true,
    );
  });
});
