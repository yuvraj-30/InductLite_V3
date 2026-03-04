import { describe, it, expect, vi, beforeEach } from "vitest";
import { processEmailQueue } from "../worker";
import { publicDb } from "../../db/public-db";
import { sendEmail } from "../resend";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

vi.mock("../resend", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "test-id" }),
}));

vi.mock("@/lib/repository/email.repository", () => ({
  queueEmailNotification: vi.fn().mockResolvedValue({ id: "queued-1" }),
}));

vi.mock("@/lib/plans", () => ({
  EntitlementDeniedError: class EntitlementDeniedError extends Error {
    constructor(public readonly featureKey: string) {
      super(`Feature is not enabled for this tenant: ${featureKey}`);
      this.name = "EntitlementDeniedError";
    }
  },
  assertCompanyFeatureEnabled: vi.fn().mockResolvedValue({} as any),
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
    vi.mocked(assertCompanyFeatureEnabled).mockResolvedValue({} as any);

    const dbAny = publicDb as any;
    dbAny.inductionResponse = {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
    };
    dbAny.auditLog = {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    dbAny.company = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    dbAny.preRegistrationInvite = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    dbAny.contractor = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    dbAny.emailNotification = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
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

    const dbAny = publicDb as any;

    // Directly stub the method (vi.spyOn may fail on late-bound props in some envs)
    dbAny.inductionResponse.findMany = vi
      .fn()
      .mockResolvedValueOnce([mockResponse as any])
      .mockResolvedValue([]); // Ensure only runs once

    (publicDb as any).auditLog.findMany = vi.fn().mockResolvedValue([]);
    const auditSpy = ((publicDb as any).auditLog.create = vi
      .fn()
      .mockResolvedValue({} as any));

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

    // Directly stub the method (vi.spyOn may fail on late-bound props in some envs)
    dbAny.emailNotification.findMany = vi
      .fn()
      .mockResolvedValueOnce([mockNotification])
      .mockResolvedValue([]);
    // Directly stub update and capture spy
    const updateSpy = (dbAny.emailNotification.update = vi
      .fn()
      .mockResolvedValue({}));

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

  it("queues pre-registration reminder emails once per company batch", async () => {
    const dbAny = publicDb as any;
    dbAny.company.findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "comp-1",
          name: "Test Company",
          users: [{ id: "user-1", email: "admin@example.com" }],
        },
      ])
      .mockResolvedValue([]);
    dbAny.preRegistrationInvite.findMany = vi.fn().mockResolvedValue([
      {
        site: { name: "Main Site" },
        visitor_name: "John Worker",
        visitor_type: "CONTRACTOR",
        expires_at: new Date("2026-03-01T10:00:00Z"),
      },
    ]);
    dbAny.auditLog.findFirst = vi.fn().mockResolvedValue(null);
    const auditCreateSpy = (dbAny.auditLog.create = vi.fn().mockResolvedValue({}));

    await processEmailQueue();

    expect(queueEmailNotification).toHaveBeenCalledWith(
      "comp-1",
      expect.objectContaining({
        user_id: "user-1",
        to: "admin@example.com",
        subject: expect.stringContaining("pre-registration invite"),
      }),
    );
    expect(auditCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "preregistration.reminder_batch",
          entity_type: "PreRegistrationReminderBatch",
        }),
      }),
    );
  });

  it("queues contractor document expiry reminders with per-window dedupe", async () => {
    const dbAny = publicDb as any;
    dbAny.company.findMany = vi
      .fn()
      // Stage 2 (pre-registration reminders): no companies
      .mockResolvedValueOnce([])
      // Stage 3 (document reminders): one company
      .mockResolvedValueOnce([
        {
          id: "comp-1",
          name: "Test Company",
          users: [{ id: "user-1", email: "manager@example.com" }],
        },
      ])
      // Stage 3 second loop: stop
      .mockResolvedValue([]);
    dbAny.preRegistrationInvite.findMany = vi.fn().mockResolvedValue([]);
    dbAny.contractorDocument.findMany = vi.fn().mockResolvedValue([
      {
        id: "doc-1",
        contractor_id: "contractor-1",
        document_type: "LICENSE",
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    ]);
    dbAny.contractor.findMany = vi.fn().mockResolvedValue([
      {
        id: "contractor-1",
        name: "BuildRight Ltd",
      },
    ]);
    dbAny.auditLog.findMany = vi.fn().mockResolvedValue([]);
    const auditCreateManySpy = (dbAny.auditLog.createMany = vi
      .fn()
      .mockResolvedValue({ count: 1 }));

    await processEmailQueue();

    expect(queueEmailNotification).toHaveBeenCalledWith(
      "comp-1",
      expect.objectContaining({
        user_id: "user-1",
        to: "manager@example.com",
        subject: expect.stringContaining("contractor document"),
      }),
    );
    expect(auditCreateManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            action: "contractor.document_expiry_reminder",
            entity_type: "ContractorDocumentReminder",
          }),
        ]),
      }),
    );
  });

  it("skips invite reminder queueing when preregistration entitlement is disabled", async () => {
    const dbAny = publicDb as any;
    dbAny.company.findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: "comp-1",
          name: "Test Company",
          users: [{ id: "user-1", email: "admin@example.com" }],
        },
      ])
      .mockResolvedValue([]);
    dbAny.preRegistrationInvite.findMany = vi.fn().mockResolvedValue([
      {
        site: { name: "Main Site" },
        visitor_name: "John Worker",
        visitor_type: "CONTRACTOR",
        expires_at: new Date("2026-03-01T10:00:00Z"),
      },
    ]);

    vi.mocked(assertCompanyFeatureEnabled).mockRejectedValue(
      new EntitlementDeniedError("PREREG_INVITES"),
    );

    await processEmailQueue();

    expect(queueEmailNotification).not.toHaveBeenCalled();
    expect(dbAny.preRegistrationInvite.findMany).not.toHaveBeenCalled();
  });

  it("skips contractor document reminder queueing when enhanced reminders entitlement is disabled", async () => {
    const dbAny = publicDb as any;
    dbAny.company.findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "comp-1",
          name: "Test Company",
          users: [{ id: "user-1", email: "manager@example.com" }],
        },
      ])
      .mockResolvedValue([]);
    dbAny.contractorDocument.findMany = vi.fn().mockResolvedValue([
      {
        id: "doc-1",
        contractor_id: "contractor-1",
        document_type: "LICENSE",
        expires_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    ]);

    vi.mocked(assertCompanyFeatureEnabled).mockImplementation(
      async (_companyId, featureKey) => {
        if (featureKey === "REMINDERS_ENHANCED") {
          throw new EntitlementDeniedError("REMINDERS_ENHANCED");
        }
        return {} as any;
      },
    );

    await processEmailQueue();

    expect(dbAny.contractorDocument.findMany).not.toHaveBeenCalled();
    expect(queueEmailNotification).not.toHaveBeenCalled();
  });
});
