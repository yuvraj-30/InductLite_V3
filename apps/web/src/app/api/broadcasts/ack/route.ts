import { NextRequest, NextResponse } from "next/server";
import { publicDb } from "@/lib/db/public-db";
import {
  buildBroadcastAckToken,
  createCommunicationEvent,
  findBroadcastRecipientByTokenHash,
  updateBroadcastRecipientStatus,
} from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { getClientIpFromHeaders, getUserAgentFromHeaders } from "@/lib/auth/csrf";

export async function GET(request: NextRequest) {
  const broadcastId = request.nextUrl.searchParams.get("broadcast") ?? "";
  const channel = (request.nextUrl.searchParams.get("channel") ?? "").toUpperCase();
  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (!broadcastId || !channel || !token) {
    return NextResponse.json(
      { success: false, error: "Missing broadcast acknowledgement parameters" },
      { status: 400 },
    );
  }

  const broadcast = await publicDb.emergencyBroadcast.findFirst({
    where: { id: broadcastId },
    select: { id: true, company_id: true, site_id: true },
  });
  if (!broadcast) {
    return NextResponse.json(
      { success: false, error: "Broadcast not found" },
      { status: 404 },
    );
  }

  const tokenHash = buildBroadcastAckToken({
    companyId: broadcast.company_id,
    broadcastId: broadcast.id,
    channel:
      channel === "EMAIL" ||
      channel === "SMS" ||
      channel === "WEB_PUSH" ||
      channel === "TEAMS" ||
      channel === "SLACK"
        ? channel
        : "EMAIL",
    recipientSeed: token,
  });

  const recipient = await findBroadcastRecipientByTokenHash(
    broadcast.company_id,
    tokenHash,
  );
  if (!recipient || recipient.broadcast_id !== broadcast.id) {
    return NextResponse.json(
      { success: false, error: "Acknowledgement token is invalid or expired" },
      { status: 404 },
    );
  }

  if (recipient.status === "ACKNOWLEDGED") {
    return NextResponse.json({
      success: true,
      acknowledged: true,
      duplicate: true,
      message: "Acknowledgement already recorded",
    });
  }

  const now = new Date();
  await updateBroadcastRecipientStatus(broadcast.company_id, {
    recipient_id: recipient.id,
    status: "ACKNOWLEDGED",
    acknowledged_at: now,
  });

  await createCommunicationEvent(broadcast.company_id, {
    site_id: broadcast.site_id ?? undefined,
    broadcast_id: broadcast.id,
    direction: "INBOUND",
    channel: recipient.channel,
    event_type: "broadcast.acknowledged",
    payload: {
      recipient_id: recipient.id,
      acknowledged_at: now.toISOString(),
    },
    status: "acknowledged",
  });

  await createAuditLog(broadcast.company_id, {
    action: "emergency.broadcast.acknowledged",
    entity_type: "BroadcastRecipient",
    entity_id: recipient.id,
    user_id: undefined,
    details: {
      broadcast_id: broadcast.id,
      channel: recipient.channel,
      recipient_email: recipient.recipient_email,
      recipient_phone: recipient.recipient_phone,
    },
    ip_address: getClientIpFromHeaders(request.headers),
    user_agent: getUserAgentFromHeaders(request.headers),
  });

  return NextResponse.json({
    success: true,
    acknowledged: true,
    message: "Acknowledgement recorded",
  });
}
