import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findCompanyComplianceSettings: vi.fn(),
}));

vi.mock("@/lib/repository/company.repository", () => ({
  findCompanyComplianceSettings: mocks.findCompanyComplianceSettings,
}));

import {
  resolveIdentityOcrProvider,
  resetIdentityOcrProviderCachesForTests,
} from "../index";

const ORIGINAL_ENV = { ...process.env };

describe("identity OCR provider resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.OCR_PROVIDER;
    delete process.env.OCR_PROVIDER_NZ;
    delete process.env.OCR_PROVIDER_AU;
    delete process.env.OCR_PROVIDER_APAC;
    delete process.env.OCR_PROVIDER_GLOBAL;
    delete process.env.OCR_TEXTRACT_REGION;
    resetIdentityOcrProviderCachesForTests();
    mocks.findCompanyComplianceSettings.mockResolvedValue({
      data_residency_region: null,
    });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetIdentityOcrProviderCachesForTests();
  });

  it("defaults to MOCK provider when no provider env is configured", async () => {
    const provider = await resolveIdentityOcrProvider("company-1");
    expect(provider.key).toBe("MOCK");
  });

  it("uses NZ-specific provider when company region is NZ", async () => {
    process.env.OCR_PROVIDER = "MOCK";
    process.env.OCR_PROVIDER_NZ = "TEXTRACT_AP_SOUTHEAST_2";
    mocks.findCompanyComplianceSettings.mockResolvedValue({
      data_residency_region: "NZ",
    });

    const provider = await resolveIdentityOcrProvider("company-2");
    expect(provider.key).toBe("TEXTRACT_AP_SOUTHEAST_2");
  });

  it("falls back to MOCK when configured provider key is unknown", async () => {
    process.env.OCR_PROVIDER = "UNKNOWN_PROVIDER";
    mocks.findCompanyComplianceSettings.mockResolvedValue({
      data_residency_region: "GLOBAL",
    });

    const provider = await resolveIdentityOcrProvider("company-3");
    expect(provider.key).toBe("MOCK");
  });
});
