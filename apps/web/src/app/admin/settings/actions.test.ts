import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  findCompanyComplianceSettings: vi.fn(),
  updateCompanyComplianceSettings: vi.fn(),
  findCompanySsoSettings: vi.fn(),
  updateCompanySsoSettings: vi.fn(),
  createAuditLog: vi.fn(),
  buildCompanyInvoicePreview: vi.fn(),
  syncCompanyInvoicePreviewToAccounting: vi.fn(),
  parseCompanySsoConfig: vi.fn(),
  serializeCompanySsoConfig: vi.fn(),
  setClientSecret: vi.fn(),
  generateDirectorySyncApiKey: vi.fn(),
  hashDirectorySyncApiKey: vi.fn(),
  generatePartnerApiKey: vi.fn(),
  hashPartnerApiKey: vi.fn(),
  revalidatePath: vi.fn(),
  generateRequestId: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createRequestLogger: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanyComplianceSettings: mocks.findCompanyComplianceSettings,
  updateCompanyComplianceSettings: mocks.updateCompanyComplianceSettings,
  findCompanySsoSettings: mocks.findCompanySsoSettings,
  updateCompanySsoSettings: mocks.updateCompanySsoSettings,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock("@/lib/plans", () => ({
  buildCompanyInvoicePreview: mocks.buildCompanyInvoicePreview,
  syncCompanyInvoicePreviewToAccounting: mocks.syncCompanyInvoicePreviewToAccounting,
}));

vi.mock("@/lib/identity", () => ({
  parseCompanySsoConfig: mocks.parseCompanySsoConfig,
  serializeCompanySsoConfig: mocks.serializeCompanySsoConfig,
  setClientSecret: mocks.setClientSecret,
  generateDirectorySyncApiKey: mocks.generateDirectorySyncApiKey,
  hashDirectorySyncApiKey: mocks.hashDirectorySyncApiKey,
  generatePartnerApiKey: mocks.generatePartnerApiKey,
  hashPartnerApiKey: mocks.hashPartnerApiKey,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

import {
  rotateDirectorySyncApiKeyAction,
  rotatePartnerApiKeyAction,
  syncBillingPreviewAction,
  updateComplianceSettingsAction,
  updateSsoSettingsAction,
} from "./actions";

function buildValidFormData(): FormData {
  const formData = new FormData();
  formData.set("retentionDays", "365");
  formData.set("inductionRetentionDays", "365");
  formData.set("auditRetentionDays", "90");
  formData.set("incidentRetentionDays", "1825");
  formData.set("emergencyDrillRetentionDays", "1825");
  formData.set("complianceLegalHold", "true");
  formData.set("complianceLegalHoldReason", "Ongoing regulator investigation");
  formData.set("dataResidencyRegion", "NZ");
  formData.set("dataResidencyScope", "PRIMARY_AND_BACKUP");
  formData.set("dataResidencyNotes", "Primary NZ with AU backup.");
  return formData;
}

describe("updateComplianceSettingsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.findCompanyComplianceSettings.mockResolvedValue({
      id: "company-1",
      retention_days: 365,
      induction_retention_days: 365,
      audit_retention_days: 90,
      incident_retention_days: 1825,
      emergency_drill_retention_days: 1825,
      compliance_legal_hold: false,
      compliance_legal_hold_reason: null,
      compliance_legal_hold_set_at: null,
      data_residency_region: "NZ",
      data_residency_scope: "PRIMARY_ONLY",
      data_residency_notes: "Primary workload remains in NZ.",
      data_residency_attested_at: new Date("2026-03-08T00:00:00.000Z"),
      data_residency_attested_by: "user-1",
    });
    mocks.updateCompanyComplianceSettings.mockResolvedValue({
      id: "company-1",
      retention_days: 365,
      induction_retention_days: 365,
      audit_retention_days: 90,
      incident_retention_days: 1825,
      emergency_drill_retention_days: 1825,
      compliance_legal_hold: true,
      compliance_legal_hold_reason: "Ongoing regulator investigation",
      compliance_legal_hold_set_at: new Date("2026-02-23T00:00:00.000Z"),
      data_residency_region: "NZ",
      data_residency_scope: "PRIMARY_AND_BACKUP",
      data_residency_notes: "Primary NZ with AU backup.",
      data_residency_attested_at: new Date("2026-03-08T10:00:00.000Z"),
      data_residency_attested_by: "user-1",
    });
    mocks.createAuditLog.mockResolvedValue(undefined);
    mocks.buildCompanyInvoicePreview.mockResolvedValue({
      companyId: "company-1",
      currency: "NZD",
      generatedAt: new Date("2026-03-01T00:00:00.000Z"),
      activeSiteCount: 2,
      baseTotalCents: 10_000,
      creditTotalCents: 500,
      finalTotalCents: 9_500,
      siteInvoices: [],
    });
    mocks.syncCompanyInvoicePreviewToAccounting.mockResolvedValue({
      endpointUrl: "https://accounting.example.test/sync",
      statusCode: 200,
      payloadBytes: 1024,
      responseBody: null,
      sentAt: new Date("2026-03-01T00:05:00.000Z"),
    });
    mocks.findCompanySsoSettings.mockResolvedValue({
      id: "company-1",
      name: "BuildRight NZ",
      slug: "buildright-nz",
      sso_config: {
        enabled: false,
        provider: "OIDC_GENERIC",
        displayName: "BuildRight SSO",
        issuerUrl: "",
        clientId: "",
        clientSecretEncrypted: null,
        scopes: ["openid", "profile", "email"],
        autoProvisionUsers: true,
        defaultRole: "VIEWER",
        roleClaimPath: "roles",
        roleMapping: {
          ADMIN: ["admin"],
          SITE_MANAGER: ["manager"],
          VIEWER: ["viewer"],
        },
        allowedEmailDomains: [],
        directorySync: { enabled: false, tokenHash: null },
        partnerApi: {
          enabled: false,
          tokenHash: null,
          scopes: ["sites.read", "signins.read"],
          monthlyQuota: 10000,
        },
      },
    });
    mocks.updateCompanySsoSettings.mockResolvedValue({
      id: "company-1",
      name: "BuildRight NZ",
      slug: "buildright-nz",
      sso_config: {
        enabled: true,
      },
    });
    mocks.parseCompanySsoConfig.mockImplementation((raw: any) => ({
      enabled: raw?.enabled === true,
      provider:
        raw?.provider === "MICROSOFT_ENTRA" ? "MICROSOFT_ENTRA" : "OIDC_GENERIC",
      displayName: raw?.displayName ?? "Company SSO",
      issuerUrl: raw?.issuerUrl ?? "",
      clientId: raw?.clientId ?? "",
      clientSecretEncrypted: raw?.clientSecretEncrypted ?? null,
      scopes: Array.isArray(raw?.scopes)
        ? raw.scopes
        : ["openid", "profile", "email"],
      autoProvisionUsers: raw?.autoProvisionUsers !== false,
      defaultRole: raw?.defaultRole ?? "VIEWER",
      roleClaimPath: raw?.roleClaimPath ?? "roles",
      roleMapping: raw?.roleMapping ?? {
        ADMIN: ["admin"],
        SITE_MANAGER: ["manager"],
        VIEWER: ["viewer"],
      },
      allowedEmailDomains: Array.isArray(raw?.allowedEmailDomains)
        ? raw.allowedEmailDomains
        : [],
      directorySync: raw?.directorySync ?? { enabled: false, tokenHash: null },
      partnerApi: raw?.partnerApi ?? {
        enabled: false,
        tokenHash: null,
        scopes: ["sites.read", "signins.read"],
        monthlyQuota: 10000,
      },
    }));
    mocks.serializeCompanySsoConfig.mockImplementation((value: unknown) => value);
    mocks.setClientSecret.mockImplementation((config: any) => ({
      ...config,
      clientSecretEncrypted: "enc-secret",
    }));
    mocks.generateDirectorySyncApiKey.mockReturnValue("idsync_generated_key");
    mocks.hashDirectorySyncApiKey.mockReturnValue("hashed-directory-key");
    mocks.generatePartnerApiKey.mockReturnValue("partner_generated_key");
    mocks.hashPartnerApiKey.mockReturnValue("hashed-partner-key");
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
  });

  it("returns origin error when CSRF origin validation fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const result = await updateComplianceSettingsAction(null, buildValidFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Invalid request origin");
    }
    expect(mocks.updateCompanyComplianceSettings).not.toHaveBeenCalled();
  });

  it("validates legal-hold reason when hold is enabled", async () => {
    const formData = buildValidFormData();
    formData.set("complianceLegalHoldReason", "");

    const result = await updateComplianceSettingsAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors?.complianceLegalHoldReason?.[0]).toContain(
        "required",
      );
    }
    expect(mocks.updateCompanyComplianceSettings).not.toHaveBeenCalled();
  });

  it("updates settings and writes audit log on success", async () => {
    const result = await updateComplianceSettingsAction(null, buildValidFormData());

    expect(result.success).toBe(true);
    expect(mocks.updateCompanyComplianceSettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        retention_days: 365,
        induction_retention_days: 365,
        audit_retention_days: 90,
        incident_retention_days: 1825,
        emergency_drill_retention_days: 1825,
        compliance_legal_hold: true,
        data_residency_region: "NZ",
        data_residency_scope: "PRIMARY_AND_BACKUP",
        data_residency_attested_by: "user-1",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "settings.update",
        entity_type: "Company",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });

  it("syncs billing preview and records audit evidence", async () => {
    const result = await syncBillingPreviewAction();

    expect(result.success).toBe(true);
    expect(mocks.buildCompanyInvoicePreview).toHaveBeenCalledWith("company-1");
    expect(mocks.syncCompanyInvoicePreviewToAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        invoicePreview: expect.objectContaining({
          companyId: "company-1",
        }),
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "billing.invoice_sync",
      }),
    );
  });

  it("returns error when accounting endpoint is not configured", async () => {
    mocks.syncCompanyInvoicePreviewToAccounting.mockRejectedValue(
      new Error("ACCOUNTING_SYNC_ENDPOINT_URL is not configured"),
    );

    const result = await syncBillingPreviewAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("ACCOUNTING_SYNC_ENDPOINT_URL");
    }
    expect(mocks.createAuditLog).not.toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({ action: "billing.invoice_sync" }),
    );
  });
});

function buildValidSsoFormData(): FormData {
  const formData = new FormData();
  formData.set("enabled", "true");
  formData.set("provider", "MICROSOFT_ENTRA");
  formData.set("displayName", "BuildRight SSO");
  formData.set("issuerUrl", "https://login.microsoftonline.com/tenant/v2.0");
  formData.set("clientId", "entra-client-id");
  formData.set("clientSecret", "new-secret-value");
  formData.set("scopes", "openid, profile, email");
  formData.set("autoProvisionUsers", "true");
  formData.set("defaultRole", "VIEWER");
  formData.set("roleClaimPath", "roles");
  formData.set("roleMappingAdmin", "admin, administrators");
  formData.set("roleMappingSiteManager", "manager");
  formData.set("roleMappingViewer", "viewer");
  formData.set("allowedEmailDomains", "example.com");
  formData.set("directorySyncEnabled", "true");
  formData.set("partnerApiEnabled", "true");
  formData.set("partnerApiScopes", "sites.read, signins.read");
  formData.set("partnerApiMonthlyQuota", "15000");
  return formData;
}

describe("SSO settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.findCompanySsoSettings.mockResolvedValue({
      id: "company-1",
      name: "BuildRight NZ",
      slug: "buildright-nz",
      sso_config: {
        enabled: false,
        provider: "OIDC_GENERIC",
        displayName: "BuildRight SSO",
        issuerUrl: "",
        clientId: "",
        clientSecretEncrypted: null,
        scopes: ["openid", "profile", "email"],
        autoProvisionUsers: true,
        defaultRole: "VIEWER",
        roleClaimPath: "roles",
        roleMapping: {
          ADMIN: ["admin"],
          SITE_MANAGER: ["manager"],
          VIEWER: ["viewer"],
        },
        allowedEmailDomains: [],
        directorySync: { enabled: false, tokenHash: null },
        partnerApi: {
          enabled: false,
          tokenHash: null,
          scopes: ["sites.read", "signins.read"],
          monthlyQuota: 10000,
        },
      },
    });
    mocks.parseCompanySsoConfig.mockImplementation((raw: any) => ({
      enabled: raw?.enabled === true,
      provider:
        raw?.provider === "MICROSOFT_ENTRA" ? "MICROSOFT_ENTRA" : "OIDC_GENERIC",
      displayName: raw?.displayName ?? "Company SSO",
      issuerUrl: raw?.issuerUrl ?? "",
      clientId: raw?.clientId ?? "",
      clientSecretEncrypted: raw?.clientSecretEncrypted ?? null,
      scopes: Array.isArray(raw?.scopes)
        ? raw.scopes
        : ["openid", "profile", "email"],
      autoProvisionUsers: raw?.autoProvisionUsers !== false,
      defaultRole: raw?.defaultRole ?? "VIEWER",
      roleClaimPath: raw?.roleClaimPath ?? "roles",
      roleMapping: raw?.roleMapping ?? {
        ADMIN: ["admin"],
        SITE_MANAGER: ["manager"],
        VIEWER: ["viewer"],
      },
      allowedEmailDomains: Array.isArray(raw?.allowedEmailDomains)
        ? raw.allowedEmailDomains
        : [],
      directorySync: raw?.directorySync ?? { enabled: false, tokenHash: null },
      partnerApi: raw?.partnerApi ?? {
        enabled: false,
        tokenHash: null,
        scopes: ["sites.read", "signins.read"],
        monthlyQuota: 10000,
      },
    }));
    mocks.serializeCompanySsoConfig.mockImplementation((value: unknown) => value);
    mocks.setClientSecret.mockImplementation((config: any) => ({
      ...config,
      clientSecretEncrypted: "enc-secret",
    }));
    mocks.generateDirectorySyncApiKey.mockReturnValue("idsync_generated_key");
    mocks.hashDirectorySyncApiKey.mockReturnValue("hashed-directory-key");
    mocks.generatePartnerApiKey.mockReturnValue("partner_generated_key");
    mocks.hashPartnerApiKey.mockReturnValue("hashed-partner-key");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createAuditLog.mockResolvedValue(undefined);
  });

  it("updates SSO settings and records audit trail", async () => {
    const result = await updateSsoSettingsAction(null, buildValidSsoFormData());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.savedConfig.defaultRole).toBe("VIEWER");
    }
    expect(mocks.updateCompanySsoSettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        enabled: true,
        provider: "MICROSOFT_ENTRA",
        clientId: "entra-client-id",
      }),
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "settings.update",
        details: expect.objectContaining({
          area: "sso",
        }),
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/settings");
  });

  it("requires client secret when enabling SSO", async () => {
    const formData = buildValidSsoFormData();
    formData.set("clientSecret", "");
    mocks.findCompanySsoSettings.mockResolvedValueOnce({
      id: "company-1",
      name: "BuildRight NZ",
      slug: "buildright-nz",
      sso_config: {
        enabled: false,
        provider: "OIDC_GENERIC",
        displayName: "BuildRight SSO",
        issuerUrl: "https://login.example.com",
        clientId: "client-id",
        clientSecretEncrypted: null,
        scopes: ["openid", "profile", "email"],
        autoProvisionUsers: true,
        defaultRole: "VIEWER",
        roleClaimPath: "roles",
        roleMapping: {
          ADMIN: ["admin"],
          SITE_MANAGER: ["manager"],
          VIEWER: ["viewer"],
        },
        allowedEmailDomains: [],
        directorySync: { enabled: false, tokenHash: null },
        partnerApi: {
          enabled: false,
          tokenHash: null,
          scopes: ["sites.read", "signins.read"],
          monthlyQuota: 10000,
        },
      },
    });
    mocks.parseCompanySsoConfig.mockImplementationOnce(() => ({
      enabled: false,
      provider: "OIDC_GENERIC",
      displayName: "BuildRight SSO",
      issuerUrl: "https://login.example.com",
      clientId: "client-id",
      clientSecretEncrypted: null,
      scopes: ["openid", "profile", "email"],
      autoProvisionUsers: true,
      defaultRole: "VIEWER",
      roleClaimPath: "roles",
      roleMapping: {
        ADMIN: ["admin"],
        SITE_MANAGER: ["manager"],
        VIEWER: ["viewer"],
      },
      allowedEmailDomains: [],
      directorySync: { enabled: false, tokenHash: null },
      partnerApi: {
        enabled: false,
        tokenHash: null,
        scopes: ["sites.read", "signins.read"],
        monthlyQuota: 10000,
      },
    }));
    mocks.parseCompanySsoConfig.mockImplementationOnce((raw: any) => ({
      ...raw,
      clientSecretEncrypted: null,
      partnerApi: raw?.partnerApi ?? {
        enabled: false,
        tokenHash: null,
        scopes: ["sites.read", "signins.read"],
        monthlyQuota: 10000,
      },
    }));

    const result = await updateSsoSettingsAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Client secret is required");
      expect(result.fieldErrors?.clientSecret?.[0]).toContain("required");
    }
    expect(mocks.updateCompanySsoSettings).not.toHaveBeenCalled();
  });

  it("rejects invalid SSO origin", async () => {
    mocks.assertOrigin.mockRejectedValueOnce(new Error("Invalid request origin"));

    const result = await updateSsoSettingsAction(null, buildValidSsoFormData());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid request origin");
    }
    expect(mocks.updateCompanySsoSettings).not.toHaveBeenCalled();
  });

  it("rotates directory sync key and stores hashed token", async () => {
    const result = await rotateDirectorySyncApiKeyAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.apiKey).toBe("idsync_generated_key");
    }
    expect(mocks.hashDirectorySyncApiKey).toHaveBeenCalledWith(
      "idsync_generated_key",
    );
    expect(mocks.updateCompanySsoSettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        directorySync: expect.objectContaining({
          tokenHash: "hashed-directory-key",
        }),
      }),
    );
  });

  it("rotates partner API key and stores hashed token", async () => {
    const result = await rotatePartnerApiKeyAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.apiKey).toBe("partner_generated_key");
    }
    expect(mocks.hashPartnerApiKey).toHaveBeenCalledWith("partner_generated_key");
    expect(mocks.updateCompanySsoSettings).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        partnerApi: expect.objectContaining({
          tokenHash: "hashed-partner-key",
        }),
      }),
    );
  });
});
