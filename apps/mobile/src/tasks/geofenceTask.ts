import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { createEventId } from "../utils/id";
import { loadMobileSettings } from "../storage/mobileSettings";
import { parseEnrollmentTokenPayload } from "../services/enrollmentToken";
import {
  enqueueGeofenceEvent,
  flushQueuedGeofenceEvents,
} from "../services/eventQueue";
import type { GeofenceEventPayload } from "../services/mobileApi";
import { GEOFENCE_TASK_NAME } from "../services/geofenceRuntime";

if (!TaskManager.isTaskDefined(GEOFENCE_TASK_NAME)) {
  TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    if (error) {
      return;
    }

    const settings = await loadMobileSettings();
    if (!settings.enrollmentToken.trim() || !settings.apiBaseUrl.trim()) {
      return;
    }

    const payload = parseEnrollmentTokenPayload(settings.enrollmentToken);
    if (!payload) {
      return;
    }

    const geofenceData = data as
      | {
          eventType: Location.GeofencingEventType;
          region: Location.LocationRegion;
        }
      | undefined;

    if (!geofenceData) {
      return;
    }

    const eventType =
      geofenceData.eventType === Location.GeofencingEventType.Enter
        ? "ENTRY"
        : "EXIT";

    const event: GeofenceEventPayload = {
      eventId: createEventId("geo"),
      eventType,
      occurredAt: new Date().toISOString(),
      latitude: geofenceData.region.latitude,
      longitude: geofenceData.region.longitude,
      endpoint: payload.endpoint,
    };

    await enqueueGeofenceEvent(event);
    await flushQueuedGeofenceEvents({
      apiBaseUrl: settings.apiBaseUrl,
      enrollmentToken: settings.enrollmentToken,
    });
  });
}
