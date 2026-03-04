import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertOrigin: vi.fn(),
  generateRequestId: vi.fn(),
  getClientIp: vi.fn(),
  getUserAgent: vi.fn(),
  createRequestLogger: vi.fn(),
  checkDemoBookingRateLimit: vi.fn(),
  createDemoBookingRequest: vi.fn(),
  updateDemoBookingNotificationStatus: vi.fn(),
  sendEmail: vi.fn(),
  hashLookupValue: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  assertOrigin: mocks.assertOrigin,
  generateRequestId: mocks.generateRequestId,
  getClientIp: mocks.getClientIp,
  getUserAgent: mocks.getUserAgent,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkDemoBookingRateLimit: mocks.checkDemoBookingRateLimit,
}));

vi.mock("@/lib/repository/demo-booking.repository", () => ({
  createDemoBookingRequest: mocks.createDemoBookingRequest,
  updateDemoBookingNotificationStatus: mocks.updateDemoBookingNotificationStatus,
}));

vi.mock("@/lib/email/resend", () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock("@/lib/security/data-protection", () => ({
  hashLookupValue: mocks.hashLookupValue,
}));

import { submitDemoBookingAction } from "./actions";

describe("submitDemoBookingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEMO_BOOKING_NOTIFY_TO = "sales@inductlite.nz,support@inductlite.nz";
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.generateRequestId.mockReturnValue("req-demo");
    mocks.getClientIp.mockResolvedValue("203.0.113.15");
    mocks.getUserAgent.mockResolvedValue("test-agent");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.checkDemoBookingRateLimit.mockResolvedValue({
      success: true,
      limit: 6,
      remaining: 5,
      reset: Date.now() + 3600000,
    });
    mocks.hashLookupValue.mockReturnValue("hashed-ip");
    mocks.createDemoBookingRequest.mockResolvedValue({
      id: "c1234567890demo",
      created_at: new Date("2026-03-05T00:00:00.000Z"),
    });
    mocks.updateDemoBookingNotificationStatus.mockResolvedValue(undefined);
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("returns invalid origin when assertOrigin fails", async () => {
    mocks.assertOrigin.mockRejectedValue(new Error("Invalid request origin"));

    const formData = new FormData();
    formData.set("fullName", "Alex Manager");
    formData.set("workEmail", "alex@company.co.nz");
    formData.set("companyName", "BuildRight NZ");
    formData.set("requirements", "Need onboarding workflow support for six sites.");

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid request origin");
    }
    expect(mocks.createDemoBookingRequest).not.toHaveBeenCalled();
  });

  it("blocks when demo booking rate limit is exceeded", async () => {
    mocks.checkDemoBookingRateLimit.mockResolvedValue({
      success: false,
      limit: 6,
      remaining: 0,
      reset: Date.now() + 3600000,
    });

    const formData = new FormData();
    formData.set("fullName", "Alex Manager");
    formData.set("workEmail", "alex@company.co.nz");
    formData.set("companyName", "BuildRight NZ");
    formData.set("requirements", "Need onboarding workflow support for six sites.");

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Too many demo requests");
    }
    expect(mocks.createDemoBookingRequest).not.toHaveBeenCalled();
  });

  it("returns field validation errors for invalid input", async () => {
    const formData = new FormData();
    formData.set("fullName", "A");
    formData.set("workEmail", "invalid-email");
    formData.set("companyName", "");
    formData.set("requirements", "short");

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.fieldErrors).toBeDefined();
      expect(result.fieldErrors?.fullName?.[0]).toBeDefined();
      expect(result.fieldErrors?.workEmail?.[0]).toBeDefined();
    }
    expect(mocks.createDemoBookingRequest).not.toHaveBeenCalled();
  });

  it("stores request and sends notifications on success", async () => {
    const formData = new FormData();
    formData.set("fullName", "Alex Manager");
    formData.set("workEmail", "alex@company.co.nz");
    formData.set("companyName", "BuildRight NZ");
    formData.set("phone", "+64 21 123 4567");
    formData.set("siteCount", "6");
    formData.set("targetGoLiveDate", "2026-04-10");
    formData.set(
      "requirements",
      "Need QR sign-in, induction scoring, and emergency roll-call across six active sites.",
    );
    formData.set("sourcePath", "/demo");

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(true);
    expect(mocks.createDemoBookingRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Alex Manager",
        workEmail: "alex@company.co.nz",
        companyName: "BuildRight NZ",
        ipHash: "hashed-ip",
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
    expect(mocks.updateDemoBookingNotificationStatus).toHaveBeenCalledWith(
      "c1234567890demo",
      expect.objectContaining({
        status: "SENT",
      }),
    );
  });

  it("returns success for honeypot submissions without persisting", async () => {
    const formData = new FormData();
    formData.set("fullName", "Alex Manager");
    formData.set("workEmail", "alex@company.co.nz");
    formData.set("companyName", "BuildRight NZ");
    formData.set("requirements", "Need onboarding workflow support for six sites.");
    formData.set("website", "spam.example");

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(true);
    expect(mocks.createDemoBookingRequest).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("marks notification as failed when all emails fail", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("resend down"));

    const formData = new FormData();
    formData.set("fullName", "Alex Manager");
    formData.set("workEmail", "alex@company.co.nz");
    formData.set("companyName", "BuildRight NZ");
    formData.set(
      "requirements",
      "Need QR sign-in, induction scoring, and emergency roll-call across six active sites.",
    );

    const result = await submitDemoBookingAction(null, formData);

    expect(result.success).toBe(true);
    expect(mocks.updateDemoBookingNotificationStatus).toHaveBeenCalledWith(
      "c1234567890demo",
      expect.objectContaining({
        status: "FAILED",
      }),
    );
  });
});
