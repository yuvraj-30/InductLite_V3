/* eslint-disable no-restricted-imports */
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
    },
  },
}));

// Import after mocking
import { prisma } from "@/lib/db/prisma";
import { purgeInactiveUser } from "../user.repository";

describe("User Repository (unit)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("purgeInactiveUser should delete only inactive user rows in company scope", async () => {
    vi.mocked(prisma.user.deleteMany).mockResolvedValue({ count: 1 });

    const deleted = await purgeInactiveUser("company-123", "u1");

    expect(prisma.user.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              id: "u1",
              company_id: "company-123",
              is_active: false,
            }),
            expect.objectContaining({ company_id: "company-123" }),
          ]),
        }),
      }),
    );
    expect(deleted).toBe(true);
  });
});

