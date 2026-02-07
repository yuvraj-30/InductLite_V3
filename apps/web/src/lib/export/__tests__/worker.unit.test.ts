import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    signInRecord: { findMany: vi.fn() },
    contractor: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";

import {
  generateSignInCsvForCompany,
  generateContractorCsvForCompany,
} from "@/lib/export/worker";

describe("Export worker CSV generation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates sign-in CSV with E.164 phone", async () => {
    vi.mocked(prisma.signInRecord.findMany).mockResolvedValue([
      {
        id: "s1",
        company_id: "c1",
        site_id: "site-1",
        site: {
          id: "site-1",
          company_id: "c1",
          created_at: new Date(),
          name: "Site A",
          address: null,
          description: null,
          is_active: true,
          webhooks: null,
          updated_at: new Date(),
        },
        visitor_name: "Alice",
        visitor_phone: "021 123 4567",
        visitor_email: "a@x.com",
        employer_name: "Acme",
        visitor_type: "VISITOR" as const,
        sign_in_ts: new Date("2024-01-01T10:00:00Z"),
        sign_out_ts: null,
        signed_out_by: null,
        sign_out_token: null,
        sign_out_token_exp: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as import("@prisma/client").Prisma.SignInRecordGetPayload<{
        include: { site: true };
      }>,
    ] as import("@prisma/client").Prisma.SignInRecordGetPayload<{
      include: { site: true };
    }>[]);

    const csv = await generateSignInCsvForCompany("c1");

    expect(csv).toContain("visitor_phone");
    expect(csv).toMatch(/\+64211234567/);
    expect(csv).toMatch(/Site A/);
  });

  it("returns empty string when no contractors", async () => {
    vi.mocked(prisma.contractor.findMany).mockResolvedValue(
      [] as import("@prisma/client").Prisma.ContractorGetPayload<{
        include: { documents: true };
      }>[],
    );

    const csv = await generateContractorCsvForCompany("c1");
    expect(csv).toBe("");
  });

  it("generates contractor CSV with contact phone in E.164 and is_active flag", async () => {
    vi.mocked(prisma.contractor.findMany).mockResolvedValue([
      {
        id: "c1",
        company_id: "c1",
        name: "Contr",
        contact_name: "Bob",
        contact_email: "bob@x.com",
        contact_phone: "021 234 5678",
        trade: "Plumbing",
        is_active: true,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
        documents: [],
      } as import("@prisma/client").Prisma.ContractorGetPayload<{
        include: { documents: true };
      }>,
    ] as import("@prisma/client").Prisma.ContractorGetPayload<{
      include: { documents: true };
    }>[]);

    const csv = await generateContractorCsvForCompany("c1");
    expect(csv).toContain("contact_phone");
    expect(csv).toMatch(/\+64212345678/);
    expect(csv).toMatch(/yes/);
  });
});
