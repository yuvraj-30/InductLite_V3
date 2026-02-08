import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { publicDb } from "@/lib/db/public-db";
import { processWeeklyDigest } from "../../src/lib/email/worker";
import { sendEmail } from "../../src/lib/email/resend";

vi.mock("@/lib/email/resend", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "test-id" }),
}));

describe("Weekly Digest Integration (Cron)", () => {
  const companyId = "test-company-digest";

  beforeEach(async () => {
    vi.useFakeTimers();
    // Monday 2026-02-09 08:00:00
    const mockDate = new Date("2026-02-09T08:00:00Z");
    vi.setSystemTime(mockDate);

    // Setup DB
    await publicDb.auditLog.deleteMany({ where: { company_id: companyId } });
    await publicDb.signInRecord.deleteMany({
      where: { company_id: companyId },
    });
    await publicDb.user.deleteMany({ where: { company_id: companyId } });
    await publicDb.company.upsert({
      where: { id: companyId },
      create: { id: companyId, name: "Digest Co", slug: "digest-co" },
      update: {},
    });

    await publicDb.user.create({
      data: {
        company_id: companyId,
        email: "admin@digest.com",
        name: "Admin",
        password_hash: "xxx",
        role: "ADMIN",
        is_active: true,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should trigger weekly digest and verify email queue for admins", async () => {
    // 1. Create some data for the last week
    await publicDb.signInRecord.create({
      data: {
        company_id: companyId,
        site_id: "site-1", // Doesn't need to exist if we don't include it
        visitor_name: "Recent Visitor",
        visitor_phone: "123",
        sign_in_ts: new Date("2026-02-05T10:00:00Z"), // Last Thursday
      },
    });

    // 2. Trigger Cron logic
    await processWeeklyDigest();

    // 3. Verify Email was sent
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@digest.com",
        subject: expect.stringContaining("Weekly Safety Digest"),
        html: expect.stringContaining("Total Inductions/Sign-ins: 1"),
      }),
    );

    // 4. Verify Audit Log
    const audit = await publicDb.auditLog.findFirst({
      where: { company_id: companyId, action: "email.weekly_digest" },
    });
    expect(audit).toBeDefined();
    expect((audit?.details as any).inductionCount).toBe(1);
  });
});
