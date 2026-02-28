import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness } from "./readiness";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findFirst: mocks.findFirst,
    },
  },
}));

describe("checkDatabaseReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok=true and latency when the ORM check succeeds", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const result = await checkDatabaseReadiness();

    expect(result.ok).toBe(true);
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(mocks.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: { id: "asc" },
    });
  });

  it("returns ok=false with error details when the ORM check fails", async () => {
    mocks.findFirst.mockRejectedValue(new Error("DB offline"));

    const result = await checkDatabaseReadiness();

    expect(result.ok).toBe(false);
    expect(result.error).toBe("DB offline");
    expect(result.latency_ms).toBeGreaterThanOrEqual(0);
  });
});
