/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    deliveryItem: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    deliveryEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  createDeliveryItem,
  transitionDeliveryItemStatus,
} from "../delivery.repository";
import type { DeliveryItem } from "@prisma/client";

function mockDeliveryItem(overrides: Partial<DeliveryItem> = {}): DeliveryItem {
  return {
    id: "delivery-1",
    company_id: "company-1",
    site_id: "site-1",
    reference_code: "DLV-REF-1",
    sender_name: null,
    carrier_name: null,
    recipient_name: "Receiver",
    recipient_email: null,
    recipient_phone: null,
    intended_for: null,
    status: "ARRIVED",
    notes: null,
    sla_due_at: null,
    arrived_at: new Date("2026-03-07T00:00:00Z"),
    notified_at: null,
    collected_at: null,
    collected_by_name: null,
    created_at: new Date("2026-03-07T00:00:00Z"),
    updated_at: new Date("2026-03-07T00:00:00Z"),
    ...overrides,
  };
}

describe("delivery.repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a delivery item and initial arrival event", async () => {
    const item = mockDeliveryItem();
    vi.mocked(prisma.deliveryItem.create).mockResolvedValue(item);
    vi.mocked(prisma.deliveryEvent.create).mockResolvedValue({
      id: "event-1",
      company_id: "company-1",
      delivery_item_id: "delivery-1",
      event_type: "ARRIVED",
      message: "Delivery item logged",
      status_from: null,
      status_to: null,
      actor_user_id: "user-1",
      metadata: null,
      created_at: new Date(),
    });

    const result = await createDeliveryItem("company-1", {
      site_id: "site-1",
      recipient_name: "Receiver",
      actor_user_id: "user-1",
    });

    expect(result.id).toBe("delivery-1");
    expect(prisma.deliveryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-1",
          site_id: "site-1",
          recipient_name: "Receiver",
          status: "ARRIVED",
        }),
      }),
    );
    expect(prisma.deliveryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-1",
          delivery_item_id: "delivery-1",
          event_type: "ARRIVED",
        }),
      }),
    );
  });

  it("blocks invalid terminal transition", async () => {
    vi.mocked(prisma.deliveryItem.findFirst).mockResolvedValue(
      mockDeliveryItem({ status: "COLLECTED" }),
    );

    await expect(
      transitionDeliveryItemStatus("company-1", {
        delivery_item_id: "delivery-1",
        next_status: "NOTIFIED",
      }),
    ).rejects.toThrow(/Invalid delivery status transition/);

    expect(prisma.deliveryItem.updateMany).not.toHaveBeenCalled();
  });

  it("transitions ARRIVED -> NOTIFIED and writes event", async () => {
    vi.mocked(prisma.deliveryItem.findFirst)
      .mockResolvedValueOnce(mockDeliveryItem({ status: "ARRIVED" }))
      .mockResolvedValueOnce(
        mockDeliveryItem({
          status: "NOTIFIED",
          notified_at: new Date("2026-03-07T01:00:00Z"),
        }),
      );
    vi.mocked(prisma.deliveryItem.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.deliveryEvent.create).mockResolvedValue({
      id: "event-2",
      company_id: "company-1",
      delivery_item_id: "delivery-1",
      event_type: "NOTIFIED",
      message: null,
      status_from: "ARRIVED",
      status_to: "NOTIFIED",
      actor_user_id: "user-1",
      metadata: null,
      created_at: new Date(),
    });

    const updated = await transitionDeliveryItemStatus("company-1", {
      delivery_item_id: "delivery-1",
      next_status: "NOTIFIED",
      actor_user_id: "user-1",
    });

    expect(updated.status).toBe("NOTIFIED");
    expect(prisma.deliveryItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "delivery-1" }),
            expect.objectContaining({ company_id: "company-1" }),
          ]),
        }),
        data: expect.objectContaining({ status: "NOTIFIED" }),
      }),
    );
    expect(prisma.deliveryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "NOTIFIED",
          status_from: "ARRIVED",
          status_to: "NOTIFIED",
        }),
      }),
    );
  });
});
