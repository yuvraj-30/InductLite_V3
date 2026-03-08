import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`REDIRECT:${url}`) as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;${url}`;
    throw error;
  }),
  assertOrigin: vi.fn(),
  checkPermission: vi.fn(),
  requireAuthenticatedContextReadOnly: vi.fn(),
  checkAdminMutationRateLimit: vi.fn(),
  generateRequestId: vi.fn(),
  createRequestLogger: vi.fn(),
  createBookableResource: vi.fn(),
  createResourceBooking: vi.fn(),
  cancelResourceBooking: vi.fn(),
  createAuditLog: vi.fn(),
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth", () => ({
  assertOrigin: mocks.assertOrigin,
  checkPermission: mocks.checkPermission,
}));

vi.mock("@/lib/tenant/context", () => ({
  requireAuthenticatedContextReadOnly: mocks.requireAuthenticatedContextReadOnly,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkAdminMutationRateLimit: mocks.checkAdminMutationRateLimit,
}));

vi.mock("@/lib/auth/csrf", () => ({
  generateRequestId: mocks.generateRequestId,
}));

vi.mock("@/lib/logger", () => ({
  createRequestLogger: mocks.createRequestLogger,
}));

vi.mock("@/lib/repository/resource-booking.repository", () => ({
  createBookableResource: mocks.createBookableResource,
  createResourceBooking: mocks.createResourceBooking,
  cancelResourceBooking: mocks.cancelResourceBooking,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import {
  cancelResourceBookingAction,
  createResourceAction,
  createResourceBookingAction,
} from "./actions";

describe("resources actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertOrigin.mockResolvedValue(undefined);
    mocks.checkPermission.mockResolvedValue({ success: true });
    mocks.requireAuthenticatedContextReadOnly.mockResolvedValue({
      companyId: "company-1",
      userId: "user-1",
    });
    mocks.checkAdminMutationRateLimit.mockResolvedValue({ success: true });
    mocks.generateRequestId.mockReturnValue("req-1");
    mocks.createRequestLogger.mockReturnValue(mocks.logger);
    mocks.createBookableResource.mockResolvedValue({
      id: "res-1",
      site_id: "cm0000000000000000000001",
      name: "Meeting Room A",
      resource_type: "ROOM",
      capacity: 8,
    });
    mocks.createResourceBooking.mockResolvedValue({
      id: "book-1",
      site_id: "cm0000000000000000000001",
      resource_id: "cm0000000000000000000101",
      starts_at: new Date("2026-03-08T08:00:00.000Z"),
      ends_at: new Date("2026-03-08T09:00:00.000Z"),
    });
    mocks.cancelResourceBooking.mockResolvedValue({
      id: "book-1",
      status: "CANCELLED",
      cancelled_at: new Date("2026-03-08T08:30:00.000Z"),
    });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("creates resource and redirects success", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("name", "Meeting Room A");
    formData.set("resourceType", "ROOM");
    formData.set("capacity", "8");

    await expect(createResourceAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/resources?flashStatus=ok&flashMessage=Resource+created",
    );
    expect(mocks.createBookableResource).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "resource.create",
        entity_type: "BookableResource",
      }),
    );
  });

  it("rejects booking when date values are invalid", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("resourceId", "cm0000000000000000000101");
    formData.set("title", "Morning booking");
    formData.set("startsAt", "bad-date");
    formData.set("endsAt", "bad-date");

    await expect(createResourceBookingAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/resources?flashStatus=error&flashMessage=Booking+start%2Fend+date+is+invalid",
    );
    expect(mocks.createResourceBooking).not.toHaveBeenCalled();
  });

  it("cancels booking and redirects success", async () => {
    const formData = new FormData();
    formData.set("bookingId", "cm0000000000000000000201");

    await expect(cancelResourceBookingAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/resources?flashStatus=ok&flashMessage=Booking+cancelled",
    );
    expect(mocks.cancelResourceBooking).toHaveBeenCalledWith(
      "company-1",
      "cm0000000000000000000201",
    );
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "resource.booking.cancel",
        entity_type: "ResourceBooking",
      }),
    );
  });
});
