import AsyncStorage from "@react-native-async-storage/async-storage";
import { geofenceEventPayloadSchema } from "@inductlite/shared";
import {
  type GeofenceEventPayload,
  replayGeofenceEvents,
  sendGeofenceEvent,
} from "./mobileApi";

const QUEUE_KEY = "inductlite.mobile.geofenceQueue.v1";
const MAX_QUEUE_ITEMS = 200;
const REPLAY_BATCH_SIZE = 20;

export async function loadGeofenceQueue(): Promise<GeofenceEventPayload[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      const normalized = geofenceEventPayloadSchema.safeParse(row);
      return normalized.success ? [normalized.data] : [];
    });
  } catch {
    return [];
  }
}

async function saveGeofenceQueue(events: GeofenceEventPayload[]): Promise<void> {
  const trimmed = events.slice(-MAX_QUEUE_ITEMS);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
}

export async function enqueueGeofenceEvent(event: GeofenceEventPayload): Promise<number> {
  const queue = await loadGeofenceQueue();
  queue.push(event);
  await saveGeofenceQueue(queue);
  return queue.length;
}

export async function clearGeofenceQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export interface FlushQueueResult {
  attempted: number;
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
}

export async function flushQueuedGeofenceEvents(input: {
  apiBaseUrl: string;
  enrollmentToken: string;
}): Promise<FlushQueueResult> {
  const queue = await loadGeofenceQueue();
  if (queue.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      remaining: 0,
    };
  }

  const batch = queue.slice(0, REPLAY_BATCH_SIZE);
  const remaining = queue.slice(batch.length);

  const result =
    batch.length === 1
      ? await sendGeofenceEvent(input.apiBaseUrl, input.enrollmentToken, batch[0])
      : await replayGeofenceEvents(input.apiBaseUrl, input.enrollmentToken, batch);

  if (!result.ok) {
    return {
      attempted: batch.length,
      sent: 0,
      failed: batch.length,
      remaining: queue.length,
      error: result.error ?? "Replay request failed",
    };
  }

  if (batch.length === 1) {
    await saveGeofenceQueue(remaining);
    return {
      attempted: 1,
      sent: 1,
      failed: 0,
      remaining: remaining.length,
    };
  }

  const failedIds = new Set<string>();
  const responseRows =
    result.data && typeof result.data === "object" && Array.isArray((result.data as { results?: unknown[] }).results)
      ? ((result.data as { results: unknown[] }).results as Array<Record<string, unknown>>)
      : [];

  for (const row of responseRows) {
    const success = row.success === true;
    const eventId = typeof row.eventId === "string" ? row.eventId : null;
    if (!success && eventId) {
      failedIds.add(eventId);
    }
  }

  const failedRows = batch.filter((event) => failedIds.has(event.eventId));
  await saveGeofenceQueue([...failedRows, ...remaining]);

  return {
    attempted: batch.length,
    sent: batch.length - failedRows.length,
    failed: failedRows.length,
    remaining: failedRows.length + remaining.length,
  };
}
