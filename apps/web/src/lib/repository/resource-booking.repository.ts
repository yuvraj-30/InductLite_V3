import { scopedDb } from "@/lib/db/scoped-db";
import type {
  BookableResource,
  ResourceInspectionRecord,
  ResourceInspectionStatus,
  ResourceBooking,
  ResourceBookingStatus,
  ResourceReadinessStatus,
  ResourceType,
} from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface CreateBookableResourceInput {
  site_id: string;
  name: string;
  resource_type?: ResourceType;
  capacity?: number;
  location_label?: string;
  notes?: string;
  readiness_status?: ResourceReadinessStatus;
  inspection_due_at?: Date | null;
  service_due_at?: Date | null;
  blocked_reason?: string | null;
}

export interface ListBookableResourcesFilter {
  site_id?: string;
  is_active?: boolean;
  limit?: number;
}

export interface CreateResourceBookingInput {
  site_id: string;
  resource_id: string;
  title: string;
  contact_name?: string;
  contact_email?: string;
  booked_by_user_id?: string;
  starts_at: Date;
  ends_at: Date;
  notes?: string;
}

export interface ListResourceBookingsFilter {
  site_id?: string;
  resource_id?: string;
  status?: ResourceBookingStatus;
  starts_before?: Date;
  ends_after?: Date;
  limit?: number;
}

export interface UpdateResourceComplianceInput {
  resource_id: string;
  readiness_status?: ResourceReadinessStatus;
  inspection_due_at?: Date | null;
  service_due_at?: Date | null;
  blocked_reason?: string | null;
  last_compliance_check_at?: Date | null;
}

export interface CreateResourceInspectionInput {
  resource_id: string;
  site_id: string;
  status?: ResourceInspectionStatus;
  inspected_at?: Date;
  inspected_by_user_id?: string | null;
  notes?: string;
}

export interface ResourceReadinessSummary {
  blocked: number;
  review_required: number;
  overdue_compliance: number;
}

interface ResourceDbDelegate {
  bookableResource: {
    create: (args: Record<string, unknown>) => Promise<BookableResource>;
    findFirst: (args: Record<string, unknown>) => Promise<BookableResource | null>;
    findMany: (args: Record<string, unknown>) => Promise<BookableResource[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  resourceBooking: {
    create: (args: Record<string, unknown>) => Promise<ResourceBooking>;
    findFirst: (args: Record<string, unknown>) => Promise<ResourceBooking | null>;
    findMany: (args: Record<string, unknown>) => Promise<ResourceBooking[]>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  resourceInspectionRecord: {
    create: (args: Record<string, unknown>) => Promise<ResourceInspectionRecord>;
    findMany: (args: Record<string, unknown>) => Promise<ResourceInspectionRecord[]>;
  };
}

function getResourceDb(companyId: string): ResourceDbDelegate {
  return scopedDb(companyId) as unknown as ResourceDbDelegate;
}

function normalizeOptionalDate(value?: Date | null): Date | null {
  if (!value) return null;
  if (Number.isNaN(value.getTime())) {
    throw new RepositoryError("date is invalid", "VALIDATION");
  }
  return value;
}

function shouldBlockBooking(
  resource: Pick<
    BookableResource,
    "readiness_status" | "inspection_due_at" | "service_due_at" | "blocked_reason"
  >,
  bookingStart: Date,
): string | null {
  if (resource.readiness_status === "BLOCKED") {
    return resource.blocked_reason || "Resource is blocked from use";
  }
  if (
    resource.inspection_due_at &&
    resource.inspection_due_at.getTime() <= bookingStart.getTime()
  ) {
    return "Resource inspection is overdue";
  }
  if (
    resource.service_due_at &&
    resource.service_due_at.getTime() <= bookingStart.getTime()
  ) {
    return "Resource service check is overdue";
  }
  return null;
}

export async function createBookableResource(
  companyId: string,
  input: CreateBookableResourceInput,
): Promise<BookableResource> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.name.trim()) {
    throw new RepositoryError("name is required", "VALIDATION");
  }
  const capacity = input.capacity ?? 1;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
    throw new RepositoryError("capacity must be between 1 and 500", "VALIDATION");
  }
  const inspectionDueAt = normalizeOptionalDate(input.inspection_due_at);
  const serviceDueAt = normalizeOptionalDate(input.service_due_at);

  const db = getResourceDb(companyId);
  try {
    return await db.bookableResource.create({
      data: {
        site_id: input.site_id,
        name: input.name.trim(),
        resource_type: input.resource_type ?? "OTHER",
        capacity,
        location_label: input.location_label?.trim() || null,
        notes: input.notes?.trim() || null,
        readiness_status: input.readiness_status ?? "READY",
        inspection_due_at: inspectionDueAt,
        service_due_at: serviceDueAt,
        blocked_reason: input.blocked_reason?.trim() || null,
        last_compliance_check_at: null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "BookableResource");
  }
}

export async function listBookableResources(
  companyId: string,
  filter?: ListBookableResourcesFilter,
): Promise<BookableResource[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 200, 1000));
  const db = getResourceDb(companyId);

  try {
    return await db.bookableResource.findMany({
      where: {
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.is_active !== undefined ? { is_active: filter.is_active } : {}),
      },
      orderBy: [{ site_id: "asc" }, { name: "asc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "BookableResource");
  }
}

export async function createResourceBooking(
  companyId: string,
  input: CreateResourceBookingInput,
): Promise<ResourceBooking> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.resource_id.trim()) {
    throw new RepositoryError("resource_id is required", "VALIDATION");
  }
  if (!input.title.trim()) {
    throw new RepositoryError("title is required", "VALIDATION");
  }
  if (!(input.starts_at instanceof Date) || Number.isNaN(input.starts_at.getTime())) {
    throw new RepositoryError("starts_at is invalid", "VALIDATION");
  }
  if (!(input.ends_at instanceof Date) || Number.isNaN(input.ends_at.getTime())) {
    throw new RepositoryError("ends_at is invalid", "VALIDATION");
  }
  if (input.ends_at <= input.starts_at) {
    throw new RepositoryError("ends_at must be after starts_at", "VALIDATION");
  }

  const db = getResourceDb(companyId);
  try {
    const resource = await db.bookableResource.findFirst({
      where: {
        id: input.resource_id,
        site_id: input.site_id,
        is_active: true,
      },
    });
    if (!resource) {
      throw new RepositoryError(
        "Resource not found or inactive for selected site",
        "NOT_FOUND",
      );
    }

    const bookingBlockReason = shouldBlockBooking(resource, input.starts_at);
    if (bookingBlockReason) {
      throw new RepositoryError(bookingBlockReason, "VALIDATION");
    }

    const conflict = await db.resourceBooking.findFirst({
      where: {
        resource_id: input.resource_id,
        status: "CONFIRMED",
        starts_at: { lt: input.ends_at },
        ends_at: { gt: input.starts_at },
      },
      orderBy: [{ starts_at: "asc" }],
    });
    if (conflict) {
      throw new RepositoryError(
        "Resource is already booked for that time window",
        "DUPLICATE",
      );
    }

    return await db.resourceBooking.create({
      data: {
        site_id: input.site_id,
        resource_id: input.resource_id,
        title: input.title.trim(),
        contact_name: input.contact_name?.trim() || null,
        contact_email: input.contact_email?.trim().toLowerCase() || null,
        booked_by_user_id: input.booked_by_user_id ?? null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        notes: input.notes?.trim() || null,
        status: "CONFIRMED",
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ResourceBooking");
  }
}

export async function updateResourceCompliance(
  companyId: string,
  input: UpdateResourceComplianceInput,
): Promise<BookableResource> {
  requireCompanyId(companyId);
  if (!input.resource_id.trim()) {
    throw new RepositoryError("resource_id is required", "VALIDATION");
  }

  const db = getResourceDb(companyId);
  try {
    const result = await db.bookableResource.updateMany({
      where: {
        id: input.resource_id,
      },
      data: {
        ...(input.readiness_status !== undefined
          ? { readiness_status: input.readiness_status }
          : {}),
        ...(input.inspection_due_at !== undefined
          ? { inspection_due_at: normalizeOptionalDate(input.inspection_due_at) }
          : {}),
        ...(input.service_due_at !== undefined
          ? { service_due_at: normalizeOptionalDate(input.service_due_at) }
          : {}),
        ...(input.blocked_reason !== undefined
          ? { blocked_reason: input.blocked_reason?.trim() || null }
          : {}),
        ...(input.last_compliance_check_at !== undefined
          ? {
              last_compliance_check_at: normalizeOptionalDate(
                input.last_compliance_check_at,
              ),
            }
          : {}),
      },
    });

    if (result.count === 0) {
      throw new RepositoryError("Resource not found", "NOT_FOUND");
    }

    const updated = await db.bookableResource.findFirst({
      where: { id: input.resource_id },
    });
    if (!updated) {
      throw new RepositoryError("Resource not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "BookableResource");
  }
}

export async function recordResourceInspection(
  companyId: string,
  input: CreateResourceInspectionInput,
): Promise<ResourceInspectionRecord> {
  requireCompanyId(companyId);
  if (!input.resource_id.trim()) {
    throw new RepositoryError("resource_id is required", "VALIDATION");
  }
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }

  const db = getResourceDb(companyId);
  const inspectedAt = normalizeOptionalDate(input.inspected_at ?? new Date());
  try {
    const resource = await db.bookableResource.findFirst({
      where: {
        id: input.resource_id,
        site_id: input.site_id,
      },
    });
    if (!resource) {
      throw new RepositoryError("Resource not found", "NOT_FOUND");
    }

    const inspection = await db.resourceInspectionRecord.create({
      data: {
        resource_id: input.resource_id,
        site_id: input.site_id,
        status: input.status ?? "PASS",
        inspected_at: inspectedAt,
        inspected_by_user_id: input.inspected_by_user_id ?? null,
        notes: input.notes?.trim() || null,
      },
    });

    await db.bookableResource.updateMany({
      where: { id: input.resource_id },
      data: {
        readiness_status: input.status === "FAIL" ? "BLOCKED" : "READY",
        blocked_reason:
          input.status === "FAIL"
            ? input.notes?.trim() || "Failed compliance inspection"
            : null,
        last_compliance_check_at: inspectedAt,
      },
    });

    return inspection;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ResourceInspectionRecord");
  }
}

export async function listResourceInspectionRecords(
  companyId: string,
  input?: { resource_id?: string; site_id?: string; limit?: number },
): Promise<ResourceInspectionRecord[]> {
  requireCompanyId(companyId);
  const db = getResourceDb(companyId);
  const limit = Math.max(1, Math.min(input?.limit ?? 200, 1000));

  try {
    return await db.resourceInspectionRecord.findMany({
      where: {
        ...(input?.resource_id ? { resource_id: input.resource_id } : {}),
        ...(input?.site_id ? { site_id: input.site_id } : {}),
      },
      orderBy: [{ inspected_at: "desc" }, { created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "ResourceInspectionRecord");
  }
}

export async function getResourceReadinessSummary(
  companyId: string,
  now: Date = new Date(),
): Promise<ResourceReadinessSummary> {
  requireCompanyId(companyId);
  const db = getResourceDb(companyId);

  try {
    const [blocked, reviewRequired, overdueCompliance] = await Promise.all([
      db.bookableResource.count({
        where: { readiness_status: "BLOCKED", is_active: true },
      }),
      db.bookableResource.count({
        where: { readiness_status: "REVIEW_REQUIRED", is_active: true },
      }),
      db.bookableResource.count({
        where: {
          is_active: true,
          OR: [
            { inspection_due_at: { lte: now } },
            { service_due_at: { lte: now } },
          ],
        },
      }),
    ]);

    return {
      blocked,
      review_required: reviewRequired,
      overdue_compliance: overdueCompliance,
    };
  } catch (error) {
    handlePrismaError(error, "BookableResource");
  }
}

export async function listResourceBookings(
  companyId: string,
  filter?: ListResourceBookingsFilter,
): Promise<ResourceBooking[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 200, 1000));
  const db = getResourceDb(companyId);

  try {
    return await db.resourceBooking.findMany({
      where: {
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.resource_id ? { resource_id: filter.resource_id } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.starts_before ? { starts_at: { lt: filter.starts_before } } : {}),
        ...(filter?.ends_after ? { ends_at: { gt: filter.ends_after } } : {}),
      },
      orderBy: [{ starts_at: "asc" }, { created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "ResourceBooking");
  }
}

export async function cancelResourceBooking(
  companyId: string,
  bookingId: string,
): Promise<ResourceBooking> {
  requireCompanyId(companyId);
  if (!bookingId.trim()) {
    throw new RepositoryError("bookingId is required", "VALIDATION");
  }

  const db = getResourceDb(companyId);
  try {
    const current = await db.resourceBooking.findFirst({
      where: { id: bookingId },
    });
    if (!current) {
      throw new RepositoryError("Resource booking not found", "NOT_FOUND");
    }
    if (current.status === "CANCELLED") {
      return current;
    }

    await db.resourceBooking.updateMany({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelled_at: new Date(),
      },
    });

    const updated = await db.resourceBooking.findFirst({
      where: { id: bookingId },
    });
    if (!updated) {
      throw new RepositoryError("Resource booking not found", "NOT_FOUND");
    }
    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "ResourceBooking");
  }
}
