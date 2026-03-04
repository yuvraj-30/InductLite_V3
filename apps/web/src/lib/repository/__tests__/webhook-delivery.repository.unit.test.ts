/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    outboundWebhookDelivery: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  countOutboundWebhookDeliveriesByStatus,
  listOutboundWebhookDeliveries,
} from "../webhook-delivery.repository";

describe("webhook-delivery.repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists webhook deliveries with tenant guard", async () => {
    vi.mocked(prisma.outboundWebhookDelivery.findMany).mockResolvedValue([]);

    await listOutboundWebhookDeliveries("company-123", {
      status: "RETRYING",
      limit: 25,
    });

    expect(prisma.outboundWebhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
        take: 25,
      }),
    );
  });

  it("returns grouped counts by status", async () => {
    vi.mocked(prisma.outboundWebhookDelivery.groupBy).mockResolvedValue([
      { status: "SENT", _count: { _all: 7 } },
      { status: "DEAD", _count: { _all: 2 } },
    ] as never);

    const counts = await countOutboundWebhookDeliveriesByStatus("company-123");

    expect(prisma.outboundWebhookDelivery.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["status"],
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
      }),
    );
    expect(counts).toEqual({
      PENDING: 0,
      PROCESSING: 0,
      RETRYING: 0,
      SENT: 7,
      DEAD: 2,
    });
  });
});
