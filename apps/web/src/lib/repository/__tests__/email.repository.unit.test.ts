import { beforeEach, describe, expect, it, vi } from "vitest";

const emailNotificationDelegate = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(() => ({
    emailNotification: emailNotificationDelegate,
  })),
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
import { queueEmailNotification } from "../email.repository";

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
});
