import { beforeEach, describe, expect, it, vi } from "vitest";

const emailNotificationDelegate = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
}));

const scopedQueries = vi.hoisted(() => ({
  listPendingEmailNotificationsGlobal: vi.fn(),
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => ({
    emailNotification: emailNotificationDelegate,
  })),
}));

vi.mock("@/lib/db/scoped", () => ({
  listPendingEmailNotificationsGlobal: scopedQueries.listPendingEmailNotificationsGlobal,
}));

vi.mock("@/lib/cost/budget-service", () => ({
  enforceBudgetPath: vi.fn().mockResolvedValue({
    allowed: true,
    mode: "NORMAL",
    controlId: null,
    message: "Budget state is healthy",
  }),
}));

import { enforceBudgetPath } from "@/lib/cost/budget-service";
import {
  listPendingEmailNotifications,
  markEmailNotificationAttemptFailed,
  markEmailNotificationSent,
  queueEmailNotification,
} from "../email.repository";

describe("Email Repository Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enforceBudgetPath).mockResolvedValue({
      allowed: true,
      mode: "NORMAL",
      controlId: null,
      message: "Budget state is healthy",
    } as any);
    vi.mocked(emailNotificationDelegate.create).mockResolvedValue({
      id: "email-1",
      to: "admin@example.com",
      subject: "Subject",
      body: "<p>Hello</p>",
      company_id: "company-id",
      user_id: null,
      status: "PENDING",
      attempts: 0,
      sent_at: null,
      last_tried: null,
      error: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as any);
    vi.mocked(emailNotificationDelegate.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(scopedQueries.listPendingEmailNotificationsGlobal).mockResolvedValue([]);
  });

  it("queues an email notification when budget allows", async () => {
    const result = await queueEmailNotification("company-id", {
      to: "Admin@Example.com",
      subject: " Subject ",
      body: " <p>Hello</p> ",
    });

    expect(result.id).toBe("email-1");
    expect(emailNotificationDelegate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          to: "admin@example.com",
          subject: "Subject",
          body: "<p>Hello</p>",
          status: "PENDING",
        }),
      }),
    );
  });

  it("throws when the budget guard denies email queueing", async () => {
    vi.mocked(enforceBudgetPath).mockResolvedValue({
      allowed: false,
      mode: "BUDGET_PROTECT",
      controlId: "COST-008",
      message: "This operation is disabled because the environment is in BUDGET_PROTECT mode",
    } as any);

    await expect(
      queueEmailNotification("company-id", {
        to: "admin@example.com",
        subject: "Subject",
        body: "<p>Hello</p>",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    expect(emailNotificationDelegate.create).not.toHaveBeenCalled();
  });

  it("lists pending email notifications through approved global DB infrastructure", async () => {
    vi.mocked(scopedQueries.listPendingEmailNotificationsGlobal).mockResolvedValue([
      {
        id: "email-1",
        company_id: "company-id",
        to: "admin@example.com",
        subject: "Subject",
        body: "<p>Hello</p>",
        attempts: 1,
      },
    ] as any);

    const result = await listPendingEmailNotifications(25);

    expect(result).toEqual([
      expect.objectContaining({
        id: "email-1",
        company_id: "company-id",
      }),
    ]);
    expect(scopedQueries.listPendingEmailNotificationsGlobal).toHaveBeenCalledWith(25);
  });

  it("marks a delivered email notification via scoped tenant access", async () => {
    await markEmailNotificationSent("company-id", "email-1", 2);

    expect(emailNotificationDelegate.updateMany).toHaveBeenCalledWith({
      where: {
        id: "email-1",
        company_id: "company-id",
      },
      data: expect.objectContaining({
        status: "SENT",
        attempts: 2,
        error: null,
        last_tried: null,
      }),
    });
  });

  it("marks a failed delivery attempt via scoped tenant access", async () => {
    await markEmailNotificationAttemptFailed(
      "company-id",
      "email-1",
      3,
      "smtp timeout",
    );

    expect(emailNotificationDelegate.updateMany).toHaveBeenCalledWith({
      where: {
        id: "email-1",
        company_id: "company-id",
      },
      data: expect.objectContaining({
        status: "FAILED",
        attempts: 3,
        error: "smtp timeout",
      }),
    });
  });
});
