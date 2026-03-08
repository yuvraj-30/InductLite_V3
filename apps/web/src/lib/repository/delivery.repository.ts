import { scopedDb } from "@/lib/db/scoped-db";
import type {
  DeliveryEvent,
  DeliveryEventType,
  DeliveryItem,
  DeliveryItemStatus,
} from "@prisma/client";
import { handlePrismaError, RepositoryError, requireCompanyId } from "./base";

export interface CreateDeliveryItemInput {
  site_id: string;
  reference_code?: string;
  sender_name?: string;
  carrier_name?: string;
  recipient_name: string;
  recipient_email?: string;
  recipient_phone?: string;
  intended_for?: string;
  notes?: string;
  sla_due_at?: Date | null;
  actor_user_id?: string;
}

export interface CreateDeliveryEventInput {
  delivery_item_id: string;
  event_type: DeliveryEventType;
  message?: string;
  status_from?: DeliveryItemStatus;
  status_to?: DeliveryItemStatus;
  actor_user_id?: string;
  metadata?: Record<string, unknown>;
}

export interface ListDeliveryItemsFilter {
  site_id?: string;
  status?: DeliveryItemStatus;
  limit?: number;
}

const DELIVERY_TRANSITIONS: Record<DeliveryItemStatus, DeliveryItemStatus[]> = {
  ARRIVED: ["NOTIFIED", "COLLECTED", "RETURNED", "CANCELLED"],
  NOTIFIED: ["COLLECTED", "RETURNED", "CANCELLED"],
  COLLECTED: [],
  RETURNED: [],
  CANCELLED: [],
};

interface DeliveryDbDelegate {
  deliveryItem: {
    create: (args: Record<string, unknown>) => Promise<DeliveryItem>;
    findFirst: (args: Record<string, unknown>) => Promise<DeliveryItem | null>;
    findMany: (args: Record<string, unknown>) => Promise<DeliveryItem[]>;
    updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  };
  deliveryEvent: {
    create: (args: Record<string, unknown>) => Promise<DeliveryEvent>;
    findMany: (args: Record<string, unknown>) => Promise<DeliveryEvent[]>;
  };
}

function getDeliveryDb(companyId: string): DeliveryDbDelegate {
  return scopedDb(companyId) as unknown as DeliveryDbDelegate;
}

function normalizeReferenceCode(input?: string): string {
  const trimmed = input?.trim().toUpperCase() ?? "";
  if (trimmed.length > 0) {
    return trimmed.slice(0, 40);
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DLV-${stamp}-${random}`;
}

function statusToEventType(status: DeliveryItemStatus): DeliveryEventType {
  switch (status) {
    case "ARRIVED":
      return "ARRIVED";
    case "NOTIFIED":
      return "NOTIFIED";
    case "COLLECTED":
      return "COLLECTED";
    case "RETURNED":
      return "RETURNED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "STATUS_CHANGED";
  }
}

export async function createDeliveryItem(
  companyId: string,
  input: CreateDeliveryItemInput,
): Promise<DeliveryItem> {
  requireCompanyId(companyId);
  if (!input.site_id.trim()) {
    throw new RepositoryError("site_id is required", "VALIDATION");
  }
  if (!input.recipient_name.trim()) {
    throw new RepositoryError("recipient_name is required", "VALIDATION");
  }

  const db = getDeliveryDb(companyId);
  const referenceCode = normalizeReferenceCode(input.reference_code);

  try {
    const item = await db.deliveryItem.create({
      data: {
        site_id: input.site_id.trim(),
        reference_code: referenceCode,
        sender_name: input.sender_name?.trim() || null,
        carrier_name: input.carrier_name?.trim() || null,
        recipient_name: input.recipient_name.trim(),
        recipient_email: input.recipient_email?.trim().toLowerCase() || null,
        recipient_phone: input.recipient_phone?.trim() || null,
        intended_for: input.intended_for?.trim() || null,
        notes: input.notes?.trim() || null,
        sla_due_at: input.sla_due_at ?? null,
        status: "ARRIVED",
      },
    });

    await db.deliveryEvent.create({
      data: {
        delivery_item_id: item.id,
        event_type: "ARRIVED",
        message: "Delivery item logged",
        actor_user_id: input.actor_user_id ?? null,
      },
    });

    return item;
  } catch (error) {
    handlePrismaError(error, "DeliveryItem");
  }
}

export async function createDeliveryEvent(
  companyId: string,
  input: CreateDeliveryEventInput,
): Promise<DeliveryEvent> {
  requireCompanyId(companyId);
  if (!input.delivery_item_id.trim()) {
    throw new RepositoryError("delivery_item_id is required", "VALIDATION");
  }

  const db = getDeliveryDb(companyId);
  try {
    return await db.deliveryEvent.create({
      data: {
        delivery_item_id: input.delivery_item_id,
        event_type: input.event_type,
        message: input.message?.trim() || null,
        status_from: input.status_from ?? null,
        status_to: input.status_to ?? null,
        actor_user_id: input.actor_user_id ?? null,
        metadata: input.metadata ?? null,
      },
    });
  } catch (error) {
    handlePrismaError(error, "DeliveryEvent");
  }
}

export async function listDeliveryItems(
  companyId: string,
  filter?: ListDeliveryItemsFilter,
): Promise<DeliveryItem[]> {
  requireCompanyId(companyId);
  const limit = Math.max(1, Math.min(filter?.limit ?? 200, 500));
  const db = getDeliveryDb(companyId);

  try {
    return await db.deliveryItem.findMany({
      where: {
        ...(filter?.site_id ? { site_id: filter.site_id } : {}),
        ...(filter?.status ? { status: filter.status } : {}),
      },
      orderBy: [{ arrived_at: "desc" }, { created_at: "desc" }],
      take: limit,
    });
  } catch (error) {
    handlePrismaError(error, "DeliveryItem");
  }
}

export async function listDeliveryEvents(
  companyId: string,
  deliveryItemId: string,
  limit = 100,
): Promise<DeliveryEvent[]> {
  requireCompanyId(companyId);
  if (!deliveryItemId.trim()) {
    throw new RepositoryError("deliveryItemId is required", "VALIDATION");
  }

  const db = getDeliveryDb(companyId);
  const boundedLimit = Math.max(1, Math.min(limit, 500));
  try {
    return await db.deliveryEvent.findMany({
      where: { delivery_item_id: deliveryItemId },
      orderBy: [{ created_at: "desc" }],
      take: boundedLimit,
    });
  } catch (error) {
    handlePrismaError(error, "DeliveryEvent");
  }
}

export async function findDeliveryItemById(
  companyId: string,
  deliveryItemId: string,
): Promise<DeliveryItem | null> {
  requireCompanyId(companyId);
  if (!deliveryItemId.trim()) {
    throw new RepositoryError("deliveryItemId is required", "VALIDATION");
  }

  const db = getDeliveryDb(companyId);
  try {
    return await db.deliveryItem.findFirst({
      where: { id: deliveryItemId },
    });
  } catch (error) {
    handlePrismaError(error, "DeliveryItem");
  }
}

export async function transitionDeliveryItemStatus(
  companyId: string,
  input: {
    delivery_item_id: string;
    next_status: DeliveryItemStatus;
    actor_user_id?: string;
    message?: string;
  },
): Promise<DeliveryItem> {
  requireCompanyId(companyId);
  if (!input.delivery_item_id.trim()) {
    throw new RepositoryError("delivery_item_id is required", "VALIDATION");
  }

  const db = getDeliveryDb(companyId);
  try {
    const current = await db.deliveryItem.findFirst({
      where: { id: input.delivery_item_id },
    });
    if (!current) {
      throw new RepositoryError("Delivery item not found", "NOT_FOUND");
    }

    if (current.status === input.next_status) {
      return current;
    }

    const allowed = DELIVERY_TRANSITIONS[current.status];
    if (!allowed.includes(input.next_status)) {
      throw new RepositoryError(
        `Invalid delivery status transition: ${current.status} -> ${input.next_status}`,
        "VALIDATION",
      );
    }

    const now = new Date();
    const updateData: Record<string, unknown> = {
      status: input.next_status,
    };
    if (input.next_status === "NOTIFIED") {
      updateData.notified_at = now;
    }
    if (input.next_status === "COLLECTED") {
      updateData.collected_at = now;
    }

    await db.deliveryItem.updateMany({
      where: { id: input.delivery_item_id },
      data: updateData,
    });

    const updated = await db.deliveryItem.findFirst({
      where: { id: input.delivery_item_id },
    });
    if (!updated) {
      throw new RepositoryError("Delivery item not found", "NOT_FOUND");
    }

    await db.deliveryEvent.create({
      data: {
        delivery_item_id: updated.id,
        event_type: statusToEventType(input.next_status),
        message: input.message?.trim() || null,
        status_from: current.status,
        status_to: input.next_status,
        actor_user_id: input.actor_user_id ?? null,
      },
    });

    return updated;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "DeliveryItem");
  }
}
