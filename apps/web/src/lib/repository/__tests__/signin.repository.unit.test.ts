/* eslint-disable no-restricted-imports */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    site: {
      findMany: vi.fn(),
    },
    signInRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import type { SignInRecord } from "@prisma/client";

import {
  findSignInById,
  listCurrentlyOnSite,
  countCurrentlyOnSite,
  createSignIn,
  signOutVisitor,
  getDistinctEmployers,
  getSignInStats,
} from "../signin.repository";

function createMockSignIn(overrides: Partial<SignInRecord> = {}): SignInRecord {
  return {
    id: "s1",
    company_id: "company-123",
    site_id: "site-1",
    idempotency_key: null,
    visitor_name: "John",
    visitor_phone: "041234567",
    visitor_email: null,
    employer_name: null,
    visitor_type: "CONTRACTOR",
    hasAcceptedTerms: false,
    termsAcceptedAt: null,
    sign_in_ts: new Date(),
    sign_out_ts: null,
    signed_out_by: null,
    sign_out_token: null,
    sign_out_token_exp: null,
    notes: null,
    created_at: new Date(),
    ...overrides,
  } as SignInRecord;
}

describe("SignIn Repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.site.findMany).mockResolvedValue([]);
  });

  it("findSignInById should include company guard via scopedDb", async () => {
    vi.mocked(prisma.signInRecord.findFirst).mockResolvedValue(
      createMockSignIn(),
    );

    await findSignInById("company-123", "s1");

    expect(prisma.signInRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "s1", company_id: "company-123" }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );
  });

  it("listCurrentlyOnSite should use scoped where and optional site filter", async () => {
    vi.mocked(prisma.signInRecord.findMany).mockResolvedValue([
      createMockSignIn(),
    ]);

    await listCurrentlyOnSite("company-123", "site-1");

    expect(prisma.signInRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it("countCurrentlyOnSite should call count with company guard", async () => {
    vi.mocked(prisma.signInRecord.count).mockResolvedValue(5);

    const n = await countCurrentlyOnSite("company-123", "site-1");

    expect(prisma.signInRecord.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );

    expect(n).toBe(5);
  });

  it("createSignIn should inject company_id via scopedDb and normalize phone to E.164", async () => {
    const mock = createMockSignIn({ visitor_phone: "+6441234567" });
    vi.mocked(prisma.signInRecord.create).mockResolvedValue(mock);

    await createSignIn("company-123", {
      site_id: "site-1",
      visitor_name: "John",
      visitor_phone: "041234567",
    });

    expect(prisma.signInRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "site-1",
          company_id: "company-123",
          visitor_phone: "+6441234567",
        }),
      }),
    );
  });

  it("createSignIn should reject invalid phone numbers", async () => {
    await expect(
      createSignIn("company-123", {
        site_id: "site-1",
        visitor_name: "John",
        visitor_phone: "not-a-phone",
      } as unknown as import("../signin.repository").CreateSignInInput),
    ).rejects.toThrow(/Invalid phone number/);
  });

  it("signOutVisitor should use updateMany and check existing record", async () => {
    vi.mocked(prisma.signInRecord.updateMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.signInRecord.findFirst).mockResolvedValue(null);

    await expect(signOutVisitor("company-123", "s1", "u1")).rejects.toThrow();

    expect(prisma.signInRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );
  });

  it("getDistinctEmployers should return unique employer names", async () => {
    const mockEmployers: SignInRecord[] = [
      {
        id: "s1",
        company_id: "company-123",
        site_id: "site-1",
        idempotency_key: null,
        visitor_name: "John",
        visitor_phone: "+64211234567",
        visitor_email: null,
        employer_name: "A",
        visitor_type: "VISITOR" as const,
        hasAcceptedTerms: false,
        termsAcceptedAt: null,
        sign_in_ts: new Date(),
        sign_out_ts: null,
        signed_out_by: null,
        sign_out_token: null,
        sign_out_token_exp: null,
        notes: null,
        created_at: new Date(),
      },
    ];
    vi.mocked(prisma.signInRecord.findMany).mockResolvedValue(mockEmployers);

    const names = await getDistinctEmployers("company-123");

    expect(prisma.signInRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ AND: expect.any(Array) }),
      }),
    );

    expect(names).toEqual(["A"]);
  });

  it("getSignInStats should call groupBy and compute averages", async () => {
    vi.mocked(prisma.signInRecord.count).mockResolvedValue(2);
    type VisitorType = import("../signin.repository").VisitorType;
    const groupByMock = [
      {
        id: "s1",
        company_id: "company-123",
        site_id: "site-1",
        idempotency_key: null,
        visitor_name: "John",
        visitor_phone: "+64211234567",
        visitor_email: null,
        employer_name: null,
        visitor_type: "CONTRACTOR" as VisitorType,
        hasAcceptedTerms: false,
        termsAcceptedAt: null,
        sign_in_ts: new Date(),
        sign_out_ts: null,
        signed_out_by: null,
        sign_out_token: null,
        sign_out_token_exp: null,
        notes: null,
        created_at: new Date(),
        _count: { id: 2 },
      },
    ];
    vi.mocked(prisma.signInRecord.groupBy).mockResolvedValue(
      groupByMock as any,
    );
    const mockCompleted: SignInRecord[] = [
      {
        id: "s1",
        company_id: "company-123",
        site_id: "site-1",
        idempotency_key: null,
        visitor_name: "John",
        visitor_phone: "+64211234567",
        visitor_email: null,
        employer_name: null,
        visitor_type: "VISITOR" as const,
        hasAcceptedTerms: false,
        termsAcceptedAt: null,
        sign_in_ts: new Date(0),
        sign_out_ts: new Date(1000 * 60),
        signed_out_by: null,
        sign_out_token: null,
        sign_out_token_exp: null,
        notes: null,
        created_at: new Date(),
      },
    ];
    vi.mocked(prisma.signInRecord.findMany).mockResolvedValue(mockCompleted);

    const stats = await getSignInStats("company-123", {
      start: new Date(0),
      end: new Date(),
    } as unknown as import("../base").DateRangeFilter);

    expect(prisma.signInRecord.count).toHaveBeenCalled();
    expect(prisma.signInRecord.groupBy).toHaveBeenCalled();
    expect(stats.total).toBe(2);
  });
});
