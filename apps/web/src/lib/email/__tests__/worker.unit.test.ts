import { describe, it, expect, vi, beforeEach } from "vitest";
import { processEmailQueue } from "../worker";
import { publicDb } from "../../db/public-db";
import { sendEmail } from "../resend";

vi.mock("../resend", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "test-id" }),
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

describe("processEmailQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should detect red flags and queue emails to site managers", async () => {
    const mockResponse = {
      id: "resp-1",
      answers: [
        { questionId: "q-1", answer: "yes" },
        { questionId: "q-2", answer: "no" },
      ],
      passed: true,
      sign_in_record: {
        company_id: "comp-1",
        visitor_name: "John Doe",
        site_id: "site-1",
        site: {
          name: "Test Site",
          site_managers: [
            {
              user: {
                email: "manager@example.com",
              },
            },
          ],
        },
      },
      template: {
        questions: [
          { id: "q-1", question_text: "Fever?", red_flag: true },
          { id: "q-2", question_text: "Hard hat?", red_flag: false },
        ],
      },
    };

    vi.spyOn(publicDb.inductionResponse, "findMany")
      .mockResolvedValueOnce([mockResponse as any])
      .mockResolvedValue([]); // Ensure only runs once

    vi.spyOn(publicDb.auditLog, "findFirst").mockResolvedValue(null);

    const auditSpy = vi
      .spyOn(publicDb.auditLog, "create")
      .mockResolvedValue({} as any);

    await processEmailQueue();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "manager@example.com",
        subject: expect.stringContaining("RED FLAG ALERT"),
      }),
    );

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "email.red_flag_alert",
          entity_id: "resp-1",
        }),
      }),
    );
  });

  it("should process pending notifications from EmailNotification table", async () => {
    const mockNotification = {
      id: "notif-1",
      to: "user@example.com",
      subject: "Test Subject",
      body: "Test Body",
      attempts: 0,
    };

    // The emailNotification property is added to publicDb late-bound/dynamically
    // in apps/web/src/lib/email/worker.ts (L124-138). When mocking, we must
    // ensure the property exists on the mocked publicDb.
    const dbAny = publicDb as any;

    // Ensure the EmailNotification mock exists
    if (!dbAny.emailNotification) {
      dbAny.emailNotification = {
        findMany: vi.fn(),
        update: vi.fn(),
      };
    }

    vi.spyOn(dbAny.emailNotification, "findMany")
      .mockResolvedValueOnce([mockNotification])
      .mockResolvedValue([]);
    const updateSpy = vi
      .spyOn(dbAny.emailNotification, "update")
      .mockResolvedValue({});

    await processEmailQueue();

    expect(sendEmail).toHaveBeenCalledWith({
      to: "user@example.com",
      subject: "Test Subject",
      html: "Test Body",
    });

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1" },
        data: expect.objectContaining({ status: "SENT" }),
      }),
    );
  });
});
