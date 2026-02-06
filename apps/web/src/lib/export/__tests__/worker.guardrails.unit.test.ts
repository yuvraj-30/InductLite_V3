import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockPrisma = {
  signInRecord: { findMany: vi.fn() },
  contractor: { findMany: vi.fn() },
};

vi.mock("@/lib/db/prisma", () => ({
  prisma: mockPrisma,
}));

describe("Export worker guardrails", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it("throws when MAX_EXPORT_ROWS is exceeded", async () => {
    process.env.MAX_EXPORT_ROWS = "1";
    process.env.MAX_EXPORT_BYTES = "104857600";

    const { generateSignInCsvForCompany } = await import("../worker");

    mockPrisma.signInRecord.findMany.mockResolvedValue([
      {
        id: "s1",
        site_id: "site-1",
        site: { name: "Site A" },
        visitor_name: "Alice",
        visitor_phone: "021 123 4567",
        visitor_email: null,
        employer_name: null,
        visitor_type: "VISITOR",
        sign_in_ts: new Date("2024-01-01T10:00:00Z"),
        sign_out_ts: null,
        notes: null,
      },
      {
        id: "s2",
        site_id: "site-1",
        site: { name: "Site A" },
        visitor_name: "Bob",
        visitor_phone: "021 123 4567",
        visitor_email: null,
        employer_name: null,
        visitor_type: "VISITOR",
        sign_in_ts: new Date("2024-01-01T10:00:00Z"),
        sign_out_ts: null,
        notes: null,
      },
    ]);

    await expect(generateSignInCsvForCompany("company-1")).rejects.toThrow(
      "MAX_EXPORT_ROWS",
    );
  });

  it("throws when MAX_EXPORT_BYTES is exceeded", async () => {
    process.env.MAX_EXPORT_ROWS = "100";
    process.env.MAX_EXPORT_BYTES = "10";

    const { generateSignInCsvForCompany } = await import("../worker");

    mockPrisma.signInRecord.findMany.mockResolvedValue([
      {
        id: "s1",
        site_id: "site-1",
        site: { name: "Site A" },
        visitor_name: "Alice",
        visitor_phone: "021 123 4567",
        visitor_email: null,
        employer_name: null,
        visitor_type: "VISITOR",
        sign_in_ts: new Date("2024-01-01T10:00:00Z"),
        sign_out_ts: null,
        notes: null,
      },
    ]);

    await expect(generateSignInCsvForCompany("company-1")).rejects.toThrow(
      "MAX_EXPORT_BYTES",
    );
  });
});
