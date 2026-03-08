"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createRequestLogger } from "@/lib/logger";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { queueEmailNotification } from "@/lib/repository/email.repository";
import {
  createDeliveryEvent,
  createDeliveryItem,
  transitionDeliveryItemStatus,
} from "@/lib/repository/delivery.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const createDeliverySchema = z.object({
  siteId: z.string().cuid(),
  referenceCode: z.string().max(40).optional().or(z.literal("")),
  senderName: z.string().max(120).optional().or(z.literal("")),
  carrierName: z.string().max(120).optional().or(z.literal("")),
  recipientName: z.string().min(2).max(120),
  recipientEmail: z.string().email().optional().or(z.literal("")),
  recipientPhone: z.string().max(40).optional().or(z.literal("")),
  intendedFor: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
  notifyRecipient: z.boolean().optional(),
});

const transitionDeliverySchema = z.object({
  deliveryItemId: z.string().cuid(),
  nextStatus: z.enum(["NOTIFIED", "COLLECTED", "RETURNED", "CANCELLED"]),
  note: z.string().max(500).optional().or(z.literal("")),
});

const noteDeliverySchema = z.object({
  deliveryItemId: z.string().cuid(),
  note: z.string().min(2).max(500),
});

function statusRedirect(status: "ok" | "error", message: string): never {
  const params = new URLSearchParams({
    flashStatus: status,
    flashMessage: message,
  });
  redirect(`/admin/deliveries?${params.toString()}`);
}

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

async function authorizeDeliveryMutation() {
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

export async function createDeliveryItemAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeDeliveryMutation();
  const parsed = createDeliverySchema.safeParse({
    siteId: formData.get("siteId")?.toString() ?? "",
    referenceCode: formData.get("referenceCode")?.toString() ?? "",
    senderName: formData.get("senderName")?.toString() ?? "",
    carrierName: formData.get("carrierName")?.toString() ?? "",
    recipientName: formData.get("recipientName")?.toString() ?? "",
    recipientEmail: formData.get("recipientEmail")?.toString() ?? "",
    recipientPhone: formData.get("recipientPhone")?.toString() ?? "",
    intendedFor: formData.get("intendedFor")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    notifyRecipient: formData.get("notifyRecipient") === "on",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid delivery input");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/deliveries",
    method: "POST",
  });

  try {
    const delivery = await createDeliveryItem(context.companyId, {
      site_id: parsed.data.siteId,
      reference_code: parsed.data.referenceCode || undefined,
      sender_name: parsed.data.senderName || undefined,
      carrier_name: parsed.data.carrierName || undefined,
      recipient_name: parsed.data.recipientName,
      recipient_email: parsed.data.recipientEmail || undefined,
      recipient_phone: parsed.data.recipientPhone || undefined,
      intended_for: parsed.data.intendedFor || undefined,
      notes: parsed.data.notes || undefined,
      actor_user_id: context.userId,
    });

    let notificationQueued = false;
    if (parsed.data.notifyRecipient && parsed.data.recipientEmail) {
      const subject = `Delivery arrived${delivery.reference_code ? ` (${delivery.reference_code})` : ""}`;
      const body = [
        `Kia ora ${delivery.recipient_name},`,
        "",
        "A delivery has arrived and is ready for collection.",
        `Reference: ${delivery.reference_code}`,
        delivery.carrier_name ? `Carrier: ${delivery.carrier_name}` : null,
        delivery.sender_name ? `Sender: ${delivery.sender_name}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await queueEmailNotification(context.companyId, {
        to: parsed.data.recipientEmail,
        subject,
        body,
      });
      await transitionDeliveryItemStatus(context.companyId, {
        delivery_item_id: delivery.id,
        next_status: "NOTIFIED",
        actor_user_id: context.userId,
        message: "Recipient notification queued",
      });
      notificationQueued = true;
    }

    await createAuditLog(context.companyId, {
      action: "delivery.item.create",
      entity_type: "DeliveryItem",
      entity_id: delivery.id,
      user_id: context.userId,
      details: {
        site_id: delivery.site_id,
        reference_code: delivery.reference_code,
        recipient_name: delivery.recipient_name,
        notification_queued: notificationQueued,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Delivery item logged");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to create delivery item");
    statusRedirect("error", "Failed to create delivery item");
  }
}

export async function transitionDeliveryItemAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeDeliveryMutation();
  const parsed = transitionDeliverySchema.safeParse({
    deliveryItemId: formData.get("deliveryItemId")?.toString() ?? "",
    nextStatus: formData.get("nextStatus")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid delivery update");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/deliveries",
    method: "POST",
  });

  try {
    const updated = await transitionDeliveryItemStatus(context.companyId, {
      delivery_item_id: parsed.data.deliveryItemId,
      next_status: parsed.data.nextStatus,
      actor_user_id: context.userId,
      message: parsed.data.note || undefined,
    });

    await createAuditLog(context.companyId, {
      action: "delivery.item.transition",
      entity_type: "DeliveryItem",
      entity_id: updated.id,
      user_id: context.userId,
      details: {
        status: updated.status,
        note: parsed.data.note || null,
      },
      request_id: requestId,
    });

    statusRedirect("ok", `Delivery marked ${updated.status.toLowerCase()}`);
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to transition delivery item");
    statusRedirect("error", "Failed to update delivery status");
  }
}

export async function addDeliveryNoteAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    statusRedirect("error", "Invalid request origin");
  }

  const context = await authorizeDeliveryMutation();
  const parsed = noteDeliverySchema.safeParse({
    deliveryItemId: formData.get("deliveryItemId")?.toString() ?? "",
    note: formData.get("note")?.toString() ?? "",
  });
  if (!parsed.success) {
    statusRedirect("error", parsed.error.issues[0]?.message ?? "Invalid note");
  }

  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/deliveries",
    method: "POST",
  });

  try {
    await createDeliveryEvent(context.companyId, {
      delivery_item_id: parsed.data.deliveryItemId,
      event_type: "NOTE",
      message: parsed.data.note,
      actor_user_id: context.userId,
    });

    await createAuditLog(context.companyId, {
      action: "delivery.item.note",
      entity_type: "DeliveryItem",
      entity_id: parsed.data.deliveryItemId,
      user_id: context.userId,
      details: {
        note: parsed.data.note,
      },
      request_id: requestId,
    });

    statusRedirect("ok", "Delivery note added");
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to add delivery note");
    statusRedirect("error", "Failed to add delivery note");
  }
}
