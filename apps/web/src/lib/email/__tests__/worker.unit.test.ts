import { describe, it, expect, vi, beforeEach } from "vitest";
import { processEmailQueue } from "../worker";
import { publicDb } from "@/lib/db/public-db";
import { sendEmail } from "../resend";

vi.mock("../resend", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db/public-db", () => ({
  publicDb: {
    inductionResponse: { findMany: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    emailNotification: { findMany: vi.fn(), update: vi.fn() },
  },
}));

describe("Email Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect red flags and send alert emails", async () => {
    const mockResponse = {
      id: "res-1",
      answers: [{ questionId: "q-1", answer: "yes" }],
      template: {
        questions: [{ id: "q-1", question_text: "Danger?", red_flag: true }],
      },
      sign_in_record: {
        visitor_name: "Alice",
        company_id: "c1",
        site: {
          name: "Site A",
          site_managers: [{ user: { email: "manager@test.com" } }],
        },
      },
    };

    vi.mocked(publicDb.inductionResponse.findMany).mockResolvedValue([
      mockResponse,
    ] as any);
    vi.mocked(publicDb.auditLog.findFirst).mockResolvedValue(null);

    await processEmailQueue();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager@test.com",
        subject: expect.stringContaining("RED FLAG"),
      }),
    );
    expect(publicDb.auditLog.create).toHaveBeenCalled();
  });

  it("should process pending notifications from the table", async () => {
    const mockNotification = {
      id: "notif-1",
      to: "admin@test.com",
      subject: "Test",
      body: "Body",
      attempts: 0,
    };

    vi.mocked(publicDb.inductionResponse.findMany).mockResolvedValue([]);
    vi.mocked((publicDb as any).emailNotification.findMany).mockResolvedValue([
      mockNotification,
    ]);

    await processEmailQueue();

    expect(sendEmail).toHaveBeenCalledWith({
      to: "admin@test.com",
      subject: "Test",
      html: "Body",
    });
    expect((publicDb as any).emailNotification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });
});
