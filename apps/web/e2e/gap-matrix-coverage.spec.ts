import { test, expect } from "./test-fixtures";

const UI_GAP_PATH_SAMPLES = [
  "/admin/access-ops",
  "/admin/approvals",
  "/admin/audit-analytics",
  "/admin/benchmarks",
  "/admin/communications",
  "/admin/deliveries",
  "/admin/evidence",
  "/admin/incidents",
  "/admin/integrations/channels",
  "/admin/integrations/procore",
  "/admin/mobile",
  "/admin/mobile/native",
  "/admin/permits",
  "/admin/permits/templates",
  "/admin/plan-configurator",
  "/admin/policy-simulator",
  "/admin/pre-registrations",
  "/admin/prequalification-exchange",
  "/admin/resources",
  "/admin/risk-passport",
  "/admin/safety-copilot",
  "/admin/safety-forms",
  "/admin/sites/dynamic/access",
  "/admin/sites/dynamic/lms",
  "/admin/sites/dynamic/webhooks",
  "/admin/templates/dynamic",
  "/admin/templates/archived",
  "/admin/templates/new",
  "/admin/trust-graph",
  "/admin/users/dynamic",
  "/admin/users/new",
  "/admin/webhooks",
  "/change-password",
  "/compare",
  "/contractor/portal",
  "/demo",
  "/favicon.ico",
  "/health",
  "/pricing",
  "/privacy",
  "/register",
  "/terms",
  "/verify",
];

const API_GAP_PATH_SAMPLES = [
  "/api/access-connectors/generic/test",
  "/api/auth/directory-sync",
  "/api/auth/logout",
  "/api/auth/sso/callback",
  "/api/auth/sso/start",
  "/api/broadcasts/ack",
  "/api/client-errors",
  "/api/cron/digest",
  "/api/cron/export-scheduler",
  "/api/cron/maintenance",
  "/api/csp-report",
  "/api/evidence/verify",
  "/api/identity/ocr/verify",
  "/api/integrations/channels/actions",
  "/api/integrations/procore/workers",
  "/api/live",
  "/api/mobile/device-bootstrap",
  "/api/mobile/enrollment-token",
  "/api/mobile/geofence-events",
  "/api/mobile/geofence-events/replay",
  "/api/mobile/heartbeat",
  "/api/policy-simulator/runs/dynamic/export",
  "/api/push/subscriptions",
  "/api/ready",
  "/api/rollcall/dynamic/evidence",
  "/api/rollcall/dynamic/export",
  "/api/sign-ins/dynamic/identity-evidence",
  "/api/storage/contractor-documents/dynamic/download",
  "/api/storage/contractor-documents/commit",
  "/api/storage/contractor-documents/presign",
  "/api/storage/sign/dynamic",
  "/api/test/create-session?email=matrix%40example.test",
  "/api/test/lookup?email=matrix%40example.test",
  "/api/test/process-next-export",
  "/api/test/seed-public-site",
  "/api/test/set-user-lock",
  "/api/v1/partner/sign-ins",
  "/api/v1/partner/sites",
];

function materializeUiPath(
  path: string,
  seeded: { siteId?: string; templateId?: string } | null,
): string {
  if (!seeded) return path;
  return path
    .replace("/admin/sites/dynamic/", `/admin/sites/${seeded.siteId ?? "dynamic"}/`)
    .replace("/admin/templates/dynamic", `/admin/templates/${seeded.templateId ?? "dynamic"}`);
}

test.describe("Gap Matrix Coverage Inventory", () => {
  test.describe.configure({ timeout: 600_000 });

  test("declares the remaining UI route samples", () => {
    expect(UI_GAP_PATH_SAMPLES.length).toBeGreaterThan(0);
  });

  test("declares the remaining API route samples", () => {
    expect(API_GAP_PATH_SAMPLES.length).toBeGreaterThan(0);
  });

  test("ui gap routes do not produce 5xx responses", async ({
    page,
    loginAs,
    workerUser,
    seedPublicSite,
  }) => {
    await loginAs(workerUser.email);
    const seeded = await seedPublicSite({
      slugPrefix: "gap-matrix-ui",
      companySlug: `test-company-${workerUser.clientKey}`,
    });

    for (const rawPath of UI_GAP_PATH_SAMPLES) {
      const path = materializeUiPath(rawPath, seeded);
      const response = await page.request.get(path, { maxRedirects: 5 });
      const status = response.status();
      expect(
        status,
        `UI route returned 5xx: ${path} (status ${status})`,
      ).toBeLessThan(500);
      expect(
        status,
        `UI route returned invalid HTTP status: ${path} (status ${status})`,
      ).toBeGreaterThanOrEqual(100);
    }
  });
});
