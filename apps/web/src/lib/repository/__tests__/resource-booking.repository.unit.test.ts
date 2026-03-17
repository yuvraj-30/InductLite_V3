import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/scoped-db", () => ({
  scopedDb: vi.fn(),
}));

import { scopedDb } from "@/lib/db/scoped-db";
import {
  cancelResourceBooking,
  createBookableResource,
  createResourceBooking,
  getResourceReadinessSummary,
  recordResourceInspection,
  updateResourceCompliance,
} from "../resource-booking.repository";
import type {
  BookableResource,
  ResourceBooking,
  ResourceInspectionRecord,
} from "@prisma/client";

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
    readiness_status: "READY",
    inspection_due_at: null,
    service_due_at: null,
    blocked_reason: null,
    last_compliance_check_at: null,
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

function mockInspection(
  overrides: Partial<ResourceInspectionRecord> = {},
): ResourceInspectionRecord {
  return {
    id: "inspection-1",
    company_id: "company-1",
    site_id: "site-1",
    resource_id: "resource-1",
    status: "PASS",
    inspected_at: new Date("2026-03-07T07:30:00Z"),
    inspected_by_user_id: "user-1",
    notes: null,
    created_at: new Date("2026-03-07T07:30:00Z"),
    updated_at: new Date("2026-03-07T07:30:00Z"),
    ...overrides,
  };
}

function createMockDb() {
  return {
    bookableResource: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    resourceBooking: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    resourceInspectionRecord: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe("resource-booking.repository (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a bookable resource with readiness metadata", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.create.mockResolvedValue(
      mockResource({ inspection_due_at: new Date("2026-03-08T00:00:00Z") }),
    );

    const created = await createBookableResource("company-1", {
      site_id: "site-1",
      name: "Meeting Room A",
      resource_type: "ROOM",
      capacity: 8,
      readiness_status: "REVIEW_REQUIRED",
      inspection_due_at: new Date("2026-03-08T00:00:00Z"),
    });

    expect(created.id).toBe("resource-1");
    expect(mockDb.bookableResource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "site-1",
          readiness_status: "REVIEW_REQUIRED",
        }),
      }),
    );
  });

  it("prevents overlapping bookings for the same resource", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.findFirst.mockResolvedValue(mockResource());
    mockDb.resourceBooking.findFirst.mockResolvedValue(mockBooking());

    await expect(
      createResourceBooking("company-1", {
        site_id: "site-1",
        resource_id: "resource-1",
        title: "Overlap",
        starts_at: new Date("2026-03-07T08:30:00Z"),
        ends_at: new Date("2026-03-07T09:30:00Z"),
      }),
    ).rejects.toThrow(/already booked/i);

    expect(mockDb.resourceBooking.create).not.toHaveBeenCalled();
  });

  it("blocks booking when resource compliance is overdue", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.findFirst.mockResolvedValue(
      mockResource({
        inspection_due_at: new Date("2026-03-07T08:00:00Z"),
      }),
    );

    await expect(
      createResourceBooking("company-1", {
        site_id: "site-1",
        resource_id: "resource-1",
        title: "Plant booking",
        starts_at: new Date("2026-03-07T08:00:00Z"),
        ends_at: new Date("2026-03-07T09:00:00Z"),
      }),
    ).rejects.toThrow(/inspection is overdue/i);
  });

  it("creates booking when no conflicts exist", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.findFirst.mockResolvedValue(mockResource());
    mockDb.resourceBooking.findFirst.mockResolvedValue(null);
    mockDb.resourceBooking.create.mockResolvedValue(mockBooking());

    const booking = await createResourceBooking("company-1", {
      site_id: "site-1",
      resource_id: "resource-1",
      title: "Safety briefing",
      starts_at: new Date("2026-03-07T10:00:00Z"),
      ends_at: new Date("2026-03-07T11:00:00Z"),
      booked_by_user_id: "user-1",
    });

    expect(booking.id).toBe("booking-1");
    expect(mockDb.resourceBooking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "site-1",
          resource_id: "resource-1",
          title: "Safety briefing",
          status: "CONFIRMED",
        }),
      }),
    );
  });

  it("updates resource compliance state", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.updateMany.mockResolvedValue({ count: 1 });
    mockDb.bookableResource.findFirst.mockResolvedValue(
      mockResource({ readiness_status: "BLOCKED", blocked_reason: "Awaiting service" }),
    );

    const updated = await updateResourceCompliance("company-1", {
      resource_id: "resource-1",
      readiness_status: "BLOCKED",
      blocked_reason: "Awaiting service",
    });

    expect(updated.readiness_status).toBe("BLOCKED");
    expect(mockDb.bookableResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readiness_status: "BLOCKED",
          blocked_reason: "Awaiting service",
        }),
      }),
    );
  });

  it("records inspections and blocks failed resources", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.findFirst.mockResolvedValue(mockResource());
    mockDb.resourceInspectionRecord.create.mockResolvedValue(
      mockInspection({ status: "FAIL", notes: "Guard missing" }),
    );
    mockDb.bookableResource.updateMany.mockResolvedValue({ count: 1 });

    const inspection = await recordResourceInspection("company-1", {
      resource_id: "resource-1",
      site_id: "site-1",
      status: "FAIL",
      notes: "Guard missing",
    });

    expect(inspection.status).toBe("FAIL");
    expect(mockDb.bookableResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          readiness_status: "BLOCKED",
          blocked_reason: "Guard missing",
        }),
      }),
    );
  });

  it("returns readiness summary counts", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.bookableResource.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);

    const summary = await getResourceReadinessSummary(
      "company-1",
      new Date("2026-03-07T08:00:00Z"),
    );

    expect(summary).toEqual({
      blocked: 2,
      review_required: 3,
      overdue_compliance: 4,
    });
  });

  it("cancels an active booking", async () => {
    const mockDb = createMockDb();
    vi.mocked(scopedDb).mockReturnValue(mockDb as never);
    mockDb.resourceBooking.findFirst
      .mockResolvedValueOnce(mockBooking({ status: "CONFIRMED" }))
      .mockResolvedValueOnce(
        mockBooking({
          status: "CANCELLED",
          cancelled_at: new Date("2026-03-07T07:00:00Z"),
        }),
      );
    mockDb.resourceBooking.updateMany.mockResolvedValue({ count: 1 });

    const cancelled = await cancelResourceBooking("company-1", "booking-1");

    expect(cancelled.status).toBe("CANCELLED");
    expect(mockDb.resourceBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "booking-1" }),
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });
});
