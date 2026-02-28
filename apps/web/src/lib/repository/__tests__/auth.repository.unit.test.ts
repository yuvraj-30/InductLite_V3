import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  tx: {
    company: { create: vi.fn() },
    user: { create: vi.fn() },
    site: { create: vi.fn() },
    siteManagerAssignment: { create: vi.fn() },
    sitePublicLink: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  prisma: {
    company: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: mocks.prisma.company,
    user: mocks.prisma.user,
    $transaction: mocks.prisma.$transaction,
  },
}));

import { registerCompanyWithAdmin } from "../auth.repository";

describe("Auth Repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(mocks.prisma.$transaction).mockImplementation(
      async (
        callback: (tx: typeof mocks.tx) => Promise<{ companyId: string }>,
      ) => callback(mocks.tx),
    );

    vi.mocked(mocks.prisma.company.findFirst).mockResolvedValue(null);
    vi.mocked(mocks.prisma.user.findFirst).mockResolvedValue(null);

    vi.mocked(mocks.tx.company.create).mockResolvedValue({
      id: "company-123",
      name: "BuildRight NZ",
    });
    vi.mocked(mocks.tx.user.create).mockResolvedValue({ id: "user-123" });
    vi.mocked(mocks.tx.site.create).mockResolvedValue({
      id: "site-123",
      name: "Main Site",
    });
    vi.mocked(mocks.tx.siteManagerAssignment.create).mockResolvedValue({
      id: "assignment-1",
    });
    vi.mocked(mocks.tx.sitePublicLink.create).mockResolvedValue({
      id: "public-link-1",
    });
    vi.mocked(mocks.tx.auditLog.create).mockResolvedValue({
      id: "audit-1",
    });
  });

  it("throws ALREADY_EXISTS when admin email is already in use", async () => {
    vi.mocked(mocks.prisma.user.findFirst).mockResolvedValue({ id: "existing" });

    await expect(
      registerCompanyWithAdmin({
        companyName: "BuildRight NZ",
        adminName: "Founding Admin",
        adminEmail: "admin@buildright.co.nz",
        adminPasswordHash: "hashed-password",
        firstSiteName: "Main Site",
      }),
    ).rejects.toMatchObject({
      code: "ALREADY_EXISTS",
    });
  });

  it("creates company, admin, site, public link, and audit log in one transaction", async () => {
    const result = await registerCompanyWithAdmin({
      companyName: "BuildRight NZ",
      adminName: "Founding Admin",
      adminEmail: "admin@buildright.co.nz",
      adminPasswordHash: "hashed-password",
      firstSiteName: "Main Site",
      requestId: "req-123",
    });

    expect(result).toEqual({ companyId: "company-123" });
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.company.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "BuildRight NZ",
          retention_days: 365,
        }),
      }),
    );
    expect(mocks.tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-123",
          email: "admin@buildright.co.nz",
          role: "ADMIN",
        }),
      }),
    );
    expect(mocks.tx.sitePublicLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "site-123",
          is_active: true,
          slug: expect.any(String),
        }),
      }),
    );
    expect(mocks.tx.siteManagerAssignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-123",
          site_id: "site-123",
          user_id: "user-123",
        }),
      }),
    );
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-123",
          user_id: "user-123",
          action: "company.signup",
          request_id: "req-123",
        }),
      }),
    );
  });
});
