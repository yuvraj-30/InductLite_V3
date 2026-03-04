import { NextResponse } from "next/server";
import { checkAuthReadOnly, checkSitePermissionReadOnly } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  listBroadcastRecipientsForBroadcasts,
  listCommunicationEventsForBroadcasts,
  listEmergencyBroadcastsInWindow,
} from "@/lib/repository/communication.repository";
import {
  findRollCallEventById,
  listRollCallAttendances,
} from "@/lib/repository/emergency.repository";
import { RepositoryError } from "@/lib/repository/base";

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return NextResponse.json(
      { error: guard.error },
      { status: guard.code === "FORBIDDEN" ? 403 : 401 },
    );
  }

  const context = guard.user;
  const { eventId } = await params;

  try {
    const event = await findRollCallEventById(context.companyId, eventId);
    if (!event) {
      return NextResponse.json({ error: "Roll call event not found" }, { status: 404 });
    }

    const siteGuard = await checkSitePermissionReadOnly("site:manage", event.site_id);
    if (!siteGuard.success) {
      return NextResponse.json(
        { error: siteGuard.error },
        { status: siteGuard.code === "FORBIDDEN" ? 403 : 401 },
      );
    }

    const attendances = await listRollCallAttendances(context.companyId, event.id);
    const windowEnd = event.closed_at ?? new Date();
    const broadcasts = await listEmergencyBroadcastsInWindow(context.companyId, {
      site_id: event.site_id,
      started_at_from: event.started_at,
      started_at_to: windowEnd,
      limit: 500,
    });
    const broadcastIds = broadcasts.map((broadcast) => broadcast.id);

    const [recipients, communicationEvents] = await Promise.all([
      listBroadcastRecipientsForBroadcasts(context.companyId, broadcastIds),
      listCommunicationEventsForBroadcasts(context.companyId, {
        broadcast_ids: broadcastIds,
        limit: 10000,
      }),
    ]);

    const recipientsByBroadcast = new Map<string, typeof recipients>();
    for (const recipient of recipients) {
      const current = recipientsByBroadcast.get(recipient.broadcast_id) ?? [];
      current.push(recipient);
      recipientsByBroadcast.set(recipient.broadcast_id, current);
    }

    const eventsByBroadcast = new Map<string, typeof communicationEvents>();
    for (const communicationEvent of communicationEvents) {
      const broadcastId = communicationEvent.broadcast_id;
      if (!broadcastId) continue;
      const current = eventsByBroadcast.get(broadcastId) ?? [];
      current.push(communicationEvent);
      eventsByBroadcast.set(broadcastId, current);
    }

    const payload = {
      generated_at: new Date().toISOString(),
      roll_call_event: {
        id: event.id,
        site_id: event.site_id,
        status: event.status,
        started_at: toIso(event.started_at),
        closed_at: toIso(event.closed_at),
        notes: event.notes,
        total_people: event.total_people,
        accounted_count: event.accounted_count,
        missing_count: event.missing_count,
      },
      roll_call_attendance: attendances.map((attendance) => ({
        id: attendance.id,
        sign_in_record_id: attendance.sign_in_record_id,
        visitor_name: attendance.visitor_name,
        visitor_type: attendance.visitor_type,
        status: attendance.status,
        accounted_at: toIso(attendance.accounted_at),
        accounted_by: attendance.accounted_by,
      })),
      emergency_broadcasts: broadcasts.map((broadcast) => {
        const broadcastRecipients = recipientsByBroadcast.get(broadcast.id) ?? [];
        const broadcastEvents = eventsByBroadcast.get(broadcast.id) ?? [];
        return {
          id: broadcast.id,
          site_id: broadcast.site_id,
          severity: broadcast.severity,
          message: broadcast.message,
          acknowledgement_required: broadcast.acknowledgement_required,
          started_at: toIso(broadcast.started_at),
          channels: broadcast.channels,
          recipients: broadcastRecipients.map((recipient) => ({
            id: recipient.id,
            channel: recipient.channel,
            recipient_name: recipient.recipient_name,
            recipient_email: recipient.recipient_email,
            recipient_phone: recipient.recipient_phone,
            status: recipient.status,
            retries: recipient.retries,
            acknowledged_at: toIso(recipient.acknowledged_at),
            last_attempt_at: toIso(recipient.last_attempt_at),
            error_message: recipient.error_message,
          })),
          communication_events: broadcastEvents.map((communicationEvent) => ({
            id: communicationEvent.id,
            direction: communicationEvent.direction,
            channel: communicationEvent.channel,
            event_type: communicationEvent.event_type,
            status: communicationEvent.status,
            payload: communicationEvent.payload,
            created_at: toIso(communicationEvent.created_at),
          })),
        };
      }),
    };

    const requestId = generateRequestId();
    await createAuditLog(context.companyId, {
      action: "emergency.rollcall.evidence_export",
      entity_type: "EvacuationEvent",
      entity_id: event.id,
      user_id: context.id,
      request_id: requestId,
      details: {
        site_id: event.site_id,
        broadcast_count: broadcasts.length,
        attendance_count: attendances.length,
      },
    });

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="rollcall-evidence-${event.id}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Roll call event not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to export roll call evidence pack" },
      { status: 500 },
    );
  }
}
