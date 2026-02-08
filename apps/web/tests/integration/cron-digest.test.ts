import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../../src/app/api/cron/digest/route";
import { publicDb } from "../../src/lib/db/public-db";
import { sendEmail } from "../../src/lib/email/resend";

vi.mock("../../src/lib/email/resend", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../src/lib/db/public-db", () => ({
  publicDb: {
    inductionResponse: { count: vi.fn() },
    auditLog: { count: vi.fn() },
    contractorDocument: { count: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("../../src/lib/cron", () => ({
  requireCronSecret: vi.fn(() => ({
    ok: true,
    log: { info: vi.fn(), error: vi.fn() },
  })),
}));

describe("Weekly Digest Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  });

  it("should collect stats and email admins", async () => {
    vi.mocked(publicDb.inductionResponse.count).mockResolvedValue(10);
    vi.mocked(publicDb.auditLog.count).mockResolvedValue(2);
    vi.mocked(publicDb.contractorDocument.count).mockResolvedValue(5);
    vi.mocked(publicDb.user.findMany).mockResolvedValue([
      { email: "admin@test.com", name: "Admin" },
    ] as any);

    const req = new Request("http://localhost/api/cron/digest");
    await GET(req);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@test.com",
        subject: expect.stringContaining("Weekly Digest"),
        html: expect.stringContaining("Total Inductions:</strong> 10"),
      }),
    );
  });
});
