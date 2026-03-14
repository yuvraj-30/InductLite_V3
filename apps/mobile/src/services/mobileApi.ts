import type {
  GeofenceEventPayload,
  HeartbeatPayload,
} from "@inductlite/shared";

export interface MobileApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

export type {
  GeofenceEventPayload,
  GeofenceEventType,
  HeartbeatPayload,
} from "@inductlite/shared";

function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("API base URL is required");
  const parsed = new URL(trimmed);
  return parsed.toString().replace(/\/$/, "");
}

async function postJson<T>(
  input: {
    url: string;
    token: string;
    payload: unknown;
  },
): Promise<MobileApiResult<T>> {
  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${input.token.trim()}`,
      },
      body: JSON.stringify(input.payload),
    });

    const body = (await response.json().catch(() => null)) as T | null;
    const error =
      response.ok === true
        ? null
        : (body && typeof body === "object" && body !== null && "error" in body
            ? String((body as { error?: string }).error ?? "Request failed")
            : "Request failed");

    return {
      ok: response.ok,
      status: response.status,
      data: body,
      error,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendGeofenceEvent(
  apiBaseUrl: string,
  enrollmentToken: string,
  event: GeofenceEventPayload,
): Promise<MobileApiResult<{ success?: boolean; duplicate?: boolean; action?: string }>> {
  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  return postJson({
    url: `${baseUrl}/api/mobile/geofence-events`,
    token: enrollmentToken,
    payload: event,
  });
}

export async function replayGeofenceEvents(
  apiBaseUrl: string,
  enrollmentToken: string,
  events: GeofenceEventPayload[],
): Promise<
  MobileApiResult<{ success?: boolean; replayed?: number; failed?: number; results?: unknown[] }>
> {
  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  return postJson({
    url: `${baseUrl}/api/mobile/geofence-events/replay`,
    token: enrollmentToken,
    payload: { events },
  });
}

export async function sendHeartbeat(
  apiBaseUrl: string,
  enrollmentToken: string,
  payload: HeartbeatPayload,
): Promise<MobileApiResult<{ success?: boolean; lastSeenAt?: string; runtime?: string }>> {
  const baseUrl = normalizeBaseUrl(apiBaseUrl);
  return postJson({
    url: `${baseUrl}/api/mobile/heartbeat`,
    token: enrollmentToken,
    payload,
  });
}
