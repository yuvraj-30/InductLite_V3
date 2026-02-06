 
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import type { User } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { scopedDb } from "../scoped-db";

describe("scopedDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should add company_id guard to findFirst/findMany/count", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    const db = scopedDb("company-123");

    await db.user.findFirst({ where: { email: "a@b.com" } });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ email: "a@b.com" }, { company_id: "company-123" }] },
      }),
    );

    await db.user.findMany({ where: { name: "x" }, skip: 1 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ name: "x" }, { company_id: "company-123" }] },
        skip: 1,
      }),
    );

    await db.user.count({ where: { is_active: true } });
    expect(prisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ is_active: true }, { company_id: "company-123" }] },
      }),
    );
  });

  it("should set company_id on create data", async () => {
    const created: User = {
      id: "u1",
      company_id: "company-123",
      email: "a@b.com",
      password_hash: "x",
      totp_secret: null,
      name: "Test",
      role: UserRole.VIEWER,
      is_active: true,
      failed_logins: 0,
      locked_until: null,
      last_login_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    vi.mocked(prisma.user.create).mockResolvedValue(created);

    const db = scopedDb("company-123");

    await db.user.create({ data: { email: "a@b.com" } });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "a@b.com",
          company_id: "company-123",
        }),
      }),
    );
  });

  it("should prevent unsafe operations via _unsafe.query", () => {
    const db = scopedDb("company-123");

    expect(() =>
      (
        db.user as unknown as {
          _unsafe: { query: (op: string, args: unknown) => unknown };
        }
      )._unsafe.query("update", {}),
    ).toThrow(/Unsafe Prisma operation "update" on tenant model "user"/);
    expect(() =>
      (
        db.user as unknown as {
          _unsafe: { query: (op: string, args: unknown) => unknown };
        }
      )._unsafe.query("findUnique", {}),
    ).toThrow(/Unsafe Prisma operation "findUnique" on tenant model "user"/);
  });
});
