/**
 * Deprecated compatibility barrel.
 *
 * Shared validation ownership now lives in cross-app contract modules under
 * `packages/shared/src/contracts`. Web-only validation stays in `apps/web`.
 */

export {
  geofenceEventPayloadSchema,
  geofenceEventTypeSchema,
  heartbeatPayloadSchema,
  mobileEnrollmentTokenPayloadSchema,
  mobileVisitorTypeSchema,
} from "./contracts/mobile";
