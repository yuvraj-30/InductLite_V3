"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import {
  cancelResourceBooking,
  createBookableResource,
  createResourceBooking,
  recordResourceInspection,
  updateResourceCompliance,
} from "@/lib/repository/resource-booking.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const createResourceSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(2).max(120),
  resourceType: z.enum(["DESK", "ROOM", "VEHICLE", "TOOL", "EQUIPMENT", "OTHER"]),
  capacity: z.coerce.number().int().min(1).max(500),
  locationLabel: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
  readinessStatus: z.enum(["READY", "REVIEW_REQUIRED", "BLOCKED"]).default("READY"),
  inspectionDueAt: z.string().optional().or(z.literal("")),
  serviceDueAt: z.string().optional().or(z.literal("")),
  blockedReason: z.string().max(500).optional().or(z.literal("")),
});

const createBookingSchema = z.object({
  siteId: z.string().cuid(),
  resourceId: z.string().cuid(),
  title: z.string().min(2).max(160),
  contactName: z.string().max(120).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

const cancelBookingSchema = z.object({
  bookingId: z.string().cuid(),
});

const updateComplianceSchema = z.object({
  resourceId: z.string().cuid(),
  readinessStatus: z.enum(["READY", "REVIEW_REQUIRED", "BLOCKED"]),
  inspectionDueAt: z.string().optional().or(z.literal("")),
  serviceDueAt: z.string().optional().or(z.literal("")),
  blockedReason: z.string().max(500).optional().or(z.literal("")),
});

const recordInspectionSchema = z.object({
  resourceId: z.string().cuid(),
  siteId: z.string().cuid(),
  status: z.enum(["PASS", "FAIL"]).default("PASS"),
  inspectedAt: z.string().optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({
    flashStatus: status,
    flashMessage: message,
  });
  redirect(`/admin/resources?${params.toString()}`);
}

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function parseOptionalDateTime(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_DATE");
  }
  return parsed;
}

async function authorizeResourceMutation() {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    statusRedirect("error", permission.error);
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    statusRedirect("error", "Too many admin updates right now. Please retry in a minute.");
  }

  return context;
}

export async function createResourceAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeResourceMutation();
  const parsed = createResourceSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    name: formData.get("name")?.toString() ?? "",
    resourceType: formData.get("resourceType")?.toString() ?? "OTHER",
    capacity: formData.get("capacity")?.toString() ?? "1",
    locationLabel: formData.get("locationLabel")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    readinessStatus: formData.get("readinessStatus")?.toString() ?? "READY",
    inspectionDueAt: formData.get("inspectionDueAt")?.toString() ?? "",
    serviceDueAt: formData.get("serviceDueAt")?.toString() ?? "",
    blockedReason: formData.get("blockedReason")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid resource input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/resources",
    method: "POST",
  });

  try {
    const inspectionDueAt = parseOptionalDateTime(parsed.data.inspectionDueAt);
    const serviceDueAt = parseOptionalDateTime(parsed.data.serviceDueAt);
    const resource = await createBookableResource(context.companyId, {
      site_id: parsed.data.siteId,
      name: parsed.data.name,
      resource_type: parsed.data.resourceType,
      capacity: parsed.data.capacity,
      location_label: parsed.data.locationLabel || undefined,
      notes: parsed.data.notes || undefined,
      readiness_status: parsed.data.readinessStatus,
      inspection_due_at: inspectionDueAt,
      service_due_at: serviceDueAt,
      blocked_reason: parsed.data.blockedReason || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "resource.create",
      entity_type: "BookableResource",
      entity_id: resource.id,
      user_id: context.userId,
      details: {
        site_id: resource.site_id,
        name: resource.name,
        resource_type: resource.resource_type,
        capacity: resource.capacity,
        readiness_status: resource.readiness_status,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Resource created");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error && error.message === "INVALID_DATE") {
      statusRedirect("error", "Compliance due date is invalid");
    }
    log.error({ error: String(error) }, "Failed to create resource");
    statusRedirect("error", "Failed to create resource");
  }
}

export async function createResourceBookingAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeResourceMutation();
  const parsed = createBookingSchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    resourceId: formData.get("resourceId")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    contactName: formData.get("contactName")?.toString() ?? "",
    contactEmail: formData.get("contactEmail")?.toString() ?? "",
    startsAt: formData.get("startsAt")?.toString() ?? "",
    endsAt: formData.get("endsAt")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid booking input");
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    statusRedirect("error", "Booking start/end date is invalid");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/resources",
    method: "POST",
  });

  try {
    const booking = await createResourceBooking(context.companyId, {
      site_id: parsed.data.siteId,
      resource_id: parsed.data.resourceId,
      title: parsed.data.title,
      contact_name: parsed.data.contactName || undefined,
      contact_email: parsed.data.contactEmail || undefined,
      booked_by_user_id: context.userId,
      starts_at: startsAt,
      ends_at: endsAt,
      notes: parsed.data.notes || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "resource.booking.create",
      entity_type: "ResourceBooking",
      entity_id: booking.id,
      user_id: context.userId,
      details: {
        site_id: booking.site_id,
        resource_id: booking.resource_id,
        starts_at: booking.starts_at.toISOString(),
        ends_at: booking.ends_at.toISOString(),
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Resource booking created");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to create resource booking");
    statusRedirect("error", "Failed to create booking (resource may already be booked)");
  }
}

export async function cancelResourceBookingAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeResourceMutation();
  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid booking reference");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/resources",
    method: "POST",
  });

  try {
    const booking = await cancelResourceBooking(context.companyId, parsed.data.bookingId);

    await createAuditLog(context.companyId, {
      action: "resource.booking.cancel",
      entity_type: "ResourceBooking",
      entity_id: booking.id,
      user_id: context.userId,
      details: {
        status: booking.status,
        cancelled_at: booking.cancelled_at?.toISOString() ?? null,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Booking cancelled");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to cancel booking");
    statusRedirect("error", "Failed to cancel booking");
  }
}

export async function updateResourceComplianceAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeResourceMutation();
  const parsed = updateComplianceSchema.safeParse({
    resourceId: formData.get("resourceId")?.toString() ?? "",
    readinessStatus: formData.get("readinessStatus")?.toString() ?? "READY",
    inspectionDueAt: formData.get("inspectionDueAt")?.toString() ?? "",
    serviceDueAt: formData.get("serviceDueAt")?.toString() ?? "",
    blockedReason: formData.get("blockedReason")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid compliance input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/resources",
    method: "POST",
  });

  try {
    const inspectionDueAt = parseOptionalDateTime(parsed.data.inspectionDueAt);
    const serviceDueAt = parseOptionalDateTime(parsed.data.serviceDueAt);
    const resource = await updateResourceCompliance(context.companyId, {
      resource_id: parsed.data.resourceId,
      readiness_status: parsed.data.readinessStatus,
      inspection_due_at: inspectionDueAt,
      service_due_at: serviceDueAt,
      blocked_reason: parsed.data.blockedReason || null,
      last_compliance_check_at: new Date(),
    });

    await createAuditLog(context.companyId, {
      action: "resource.compliance.update",
      entity_type: "BookableResource",
      entity_id: resource.id,
      user_id: context.userId,
      details: {
        site_id: resource.site_id,
        readiness_status: resource.readiness_status,
        inspection_due_at: resource.inspection_due_at?.toISOString() ?? null,
        service_due_at: resource.service_due_at?.toISOString() ?? null,
        blocked_reason: resource.blocked_reason ?? null,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Resource compliance updated");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error && error.message === "INVALID_DATE") {
      statusRedirect("error", "Compliance due date is invalid");
    }
    log.error({ error: String(error) }, "Failed to update resource compliance");
    statusRedirect("error", "Failed to update resource compliance");
  }
}

export async function recordResourceInspectionAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeResourceMutation();
  const parsed = recordInspectionSchema.safeParse({
    resourceId: formData.get("resourceId")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
    status: formData.get("status")?.toString() ?? "PASS",
    inspectedAt: formData.get("inspectedAt")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid inspection input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/resources",
    method: "POST",
  });

  try {
    const inspectedAt = parseOptionalDateTime(parsed.data.inspectedAt) ?? new Date();
    const inspection = await recordResourceInspection(context.companyId, {
      resource_id: parsed.data.resourceId,
      site_id: parsed.data.siteId,
      status: parsed.data.status,
      inspected_at: inspectedAt,
      inspected_by_user_id: context.userId,
      notes: parsed.data.notes || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "resource.inspection.record",
      entity_type: "ResourceInspectionRecord",
      entity_id: inspection.id,
      user_id: context.userId,
      details: {
        site_id: inspection.site_id,
        resource_id: inspection.resource_id,
        status: inspection.status,
        inspected_at: inspection.inspected_at.toISOString(),
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Resource inspection recorded");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (error instanceof Error && error.message === "INVALID_DATE") {
      statusRedirect("error", "Inspection date is invalid");
    }
    log.error({ error: String(error) }, "Failed to record resource inspection");
    statusRedirect("error", "Failed to record resource inspection");
  }
}
