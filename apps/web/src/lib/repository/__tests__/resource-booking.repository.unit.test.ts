/* eslint-disable no-restricted-imports */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    bookableResource: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    resourceBooking: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  cancelResourceBooking,
  createBookableResource,
  createResourceBooking,
} from "../resource-booking.repository";
import type { BookableResource, ResourceBooking } from "@prisma/client";

function mockResource(overrides: Partial<BookableResource> = {}): BookableResource {
  return {
    id: "resource-1",
    company_id: "company-1",
    site_id: "site-1",
    name: "Meeting Room A",
    resource_type: "ROOM",
    capacity: 8,
    location_label: null,
    notes: null,
    is_active: true,
    created_at: new Date("2026-03-07T00:00:00Z"),
    updated_at: new Date("2026-03-07T00:00:00Z"),
    ...overrides,
  };
}

function mockBooking(overrides: Partial<ResourceBooking> = {}): ResourceBooking {
  return {
    id: "booking-1",
    company_id: "company-1",
    site_id: "site-1",
    resource_id: "resource-1",
    title: "Toolbox Talk",
    contact_name: null,
    contact_email: null,
    booked_by_user_id: "user-1",
    starts_at: new Date("2026-03-07T08:00:00Z"),
    ends_at: new Date("2026-03-07T09:00:00Z"),
    status: "CONFIRMED",
    notes: null,
    cancelled_at: null,
    created_at: new Date("2026-03-07T00:00:00Z"),
    updated_at: new Date("2026-03-07T00:00:00Z"),
    ...overrides,
  };
}

describe("resource-booking.repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bookable resource", async () => {
    vi.mocked(prisma.bookableResource.create).mockResolvedValue(mockResource());

    const created = await createBookableResource("company-1", {
      site_id: "site-1",
      name: "Meeting Room A",
      resource_type: "ROOM",
      capacity: 8,
    });

    expect(created.id).toBe("resource-1");
    expect(prisma.bookableResource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-1",
          site_id: "site-1",
          name: "Meeting Room A",
          resource_type: "ROOM",
          capacity: 8,
        }),
      }),
    );
  });

  it("prevents overlapping bookings for the same resource", async () => {
    vi.mocked(prisma.bookableResource.findFirst).mockResolvedValue(mockResource());
    vi.mocked(prisma.resourceBooking.findFirst).mockResolvedValue(mockBooking());

    await expect(
      createResourceBooking("company-1", {
        site_id: "site-1",
        resource_id: "resource-1",
        title: "Overlap",
        starts_at: new Date("2026-03-07T08:30:00Z"),
        ends_at: new Date("2026-03-07T09:30:00Z"),
      }),
    ).rejects.toThrow(/already booked/i);

    expect(prisma.resourceBooking.create).not.toHaveBeenCalled();
  });

  it("creates booking when no conflicts exist", async () => {
    vi.mocked(prisma.bookableResource.findFirst).mockResolvedValue(mockResource());
    vi.mocked(prisma.resourceBooking.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.resourceBooking.create).mockResolvedValue(mockBooking());

    const booking = await createResourceBooking("company-1", {
      site_id: "site-1",
      resource_id: "resource-1",
      title: "Safety briefing",
      starts_at: new Date("2026-03-07T10:00:00Z"),
      ends_at: new Date("2026-03-07T11:00:00Z"),
      booked_by_user_id: "user-1",
    });

    expect(booking.id).toBe("booking-1");
    expect(prisma.resourceBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          company_id: "company-1",
          site_id: "site-1",
          resource_id: "resource-1",
          title: "Safety briefing",
          status: "CONFIRMED",
        }),
      }),
    );
  });

  it("cancels an active booking", async () => {
    vi.mocked(prisma.resourceBooking.findFirst)
      .mockResolvedValueOnce(mockBooking({ status: "CONFIRMED" }))
      .mockResolvedValueOnce(
        mockBooking({
          status: "CANCELLED",
          cancelled_at: new Date("2026-03-07T07:00:00Z"),
        }),
      );
    vi.mocked(prisma.resourceBooking.updateMany).mockResolvedValue({ count: 1 });

    const cancelled = await cancelResourceBooking("company-1", "booking-1");

    expect(cancelled.status).toBe("CANCELLED");
    expect(prisma.resourceBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: "booking-1" }),
            expect.objectContaining({ company_id: "company-1" }),
          ]),
        }),
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });
});
