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
  queueEmailNotification: vi.fn(),
  createDeliveryItem: vi.fn(),
  transitionDeliveryItemStatus: vi.fn(),
  createDeliveryEvent: vi.fn(),
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

vi.mock("@/lib/repository/email.repository", () => ({
  queueEmailNotification: mocks.queueEmailNotification,
}));

vi.mock("@/lib/repository/delivery.repository", () => ({
  createDeliveryEvent: mocks.createDeliveryEvent,
  createDeliveryItem: mocks.createDeliveryItem,
  transitionDeliveryItemStatus: mocks.transitionDeliveryItemStatus,
}));

vi.mock("@/lib/repository/audit.repository", () => ({
  createAuditLog: mocks.createAuditLog,
}));

import {
  addDeliveryNoteAction,
  createDeliveryItemAction,
  transitionDeliveryItemAction,
} from "./actions";

describe("deliveries actions", () => {
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
    mocks.createDeliveryItem.mockResolvedValue({
      id: "del-1",
      site_id: "cm0000000000000000000001",
      reference_code: "REF-1",
      recipient_name: "Ari",
      carrier_name: "CourierCo",
      sender_name: "ACME",
    });
    mocks.transitionDeliveryItemStatus.mockResolvedValue({
      id: "del-1",
      status: "COLLECTED",
    });
    mocks.createDeliveryEvent.mockResolvedValue({ id: "evt-1" });
    mocks.queueEmailNotification.mockResolvedValue({ id: "email-1" });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it("creates delivery item and redirects success", async () => {
    const formData = new FormData();
    formData.set("siteId", "cm0000000000000000000001");
    formData.set("recipientName", "Ari");

    await expect(createDeliveryItemAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/deliveries?flashStatus=ok&flashMessage=Delivery+item+logged",
    );
    expect(mocks.createDeliveryItem).toHaveBeenCalledTimes(1);
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        action: "delivery.item.create",
      }),
    );
  });

  it("transitions delivery status and redirects success", async () => {
    const formData = new FormData();
    formData.set("deliveryItemId", "cm0000000000000000000101");
    formData.set("nextStatus", "COLLECTED");
    formData.set("note", "Picked up by recipient");

    await expect(transitionDeliveryItemAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/deliveries?flashStatus=ok&flashMessage=Delivery+marked+collected",
    );
    expect(mocks.transitionDeliveryItemStatus).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        next_status: "COLLECTED",
      }),
    );
  });

  it("adds delivery note and redirects success", async () => {
    const formData = new FormData();
    formData.set("deliveryItemId", "cm0000000000000000000101");
    formData.set("note", "Stored in secure cage");

    await expect(addDeliveryNoteAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/deliveries?flashStatus=ok&flashMessage=Delivery+note+added",
    );
    expect(mocks.createDeliveryEvent).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        delivery_item_id: "cm0000000000000000000101",
        event_type: "NOTE",
      }),
    );
  });
});
