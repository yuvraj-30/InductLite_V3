import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { geofenceEventPayloadSchema } from "@inductlite/shared";
import { POST as handleSingleGeofenceEvent } from "../route";

const replaySchema = z.object({
  events: z.array(geofenceEventPayloadSchema).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = replaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid replay payload",
      },
      { status: 400 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json(
      { success: false, error: "Missing bearer token" },
      { status: 401 },
    );
  }

  const results: Array<{
    eventId: string;
    status: number;
    success: boolean;
    duplicate?: boolean;
    action?: string;
    error?: string;
  }> = [];

  for (const event of parsed.data.events) {
    const eventRequest = new Request(request.url.replace("/replay", ""), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: authHeader,
      },
      body: JSON.stringify(event),
    });

    const response = await handleSingleGeofenceEvent(eventRequest as unknown as NextRequest);
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    results.push({
      eventId: event.eventId,
      status: response.status,
      success: response.ok && json.success === true,
      duplicate: json.duplicate === true,
      action: typeof json.action === "string" ? json.action : undefined,
      error: typeof json.error === "string" ? json.error : undefined,
    });
  }

  const failed = results.filter((result) => !result.success).length;
  return NextResponse.json({
    success: failed === 0,
    replayed: results.length,
    failed,
    results,
  });
}
