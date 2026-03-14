/**
 * Deprecated compatibility barrel.
 *
 * Shared type ownership now lives in cross-app contract modules under
 * `packages/shared/src/contracts`. Web-only runtime types stay in `apps/web`.
 */

export type {
  GeofenceEventPayload,
  GeofenceEventType,
  HeartbeatPayload,
  MobileEnrollmentTokenPayload,
  MobileVisitorType,
} from "./contracts/mobile";
