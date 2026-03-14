import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(maxLength).optional(),
  );

const optionalUrlString = (maxLength: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().trim().url().max(maxLength).optional(),
  );

const optionalIsoDateTimeString = () =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().datetime({ offset: true }).optional(),
  );

const optionalCuidString = () =>
  z.preprocess(emptyStringToUndefined, z.string().cuid().optional());

export const mobileVisitorTypeSchema = z.enum([
  "CONTRACTOR",
  "VISITOR",
  "EMPLOYEE",
  "DELIVERY",
]);

export type MobileVisitorType = z.infer<typeof mobileVisitorTypeSchema>;

export const geofenceEventTypeSchema = z.enum(["ENTRY", "EXIT"]);

export type GeofenceEventType = z.infer<typeof geofenceEventTypeSchema>;

export const geofenceEventPayloadSchema = z.object({
  eventId: z.string().trim().min(8).max(120),
  eventType: geofenceEventTypeSchema,
  occurredAt: optionalIsoDateTimeString(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().min(0).max(10_000).optional(),
  signInRecordId: optionalCuidString(),
  endpoint: optionalUrlString(2000),
});

export type GeofenceEventPayload = z.infer<typeof geofenceEventPayloadSchema>;

export const heartbeatPayloadSchema = z.object({
  endpoint: optionalUrlString(2000),
  platform: optionalTrimmedString(40),
  appVersion: optionalTrimmedString(30),
  osVersion: optionalTrimmedString(30),
  wrapperChannel: optionalTrimmedString(40),
});

export type HeartbeatPayload = z.infer<typeof heartbeatPayloadSchema>;

export const mobileEnrollmentTokenPayloadSchema = z.object({
  version: z.literal(1),
  companyId: z.string().trim().min(1).max(200),
  siteId: z.string().trim().min(1).max(200),
  endpoint: z.string().trim().url().max(2000),
  deviceId: z.string().trim().min(1).max(200),
  runtime: z.string().trim().min(1).max(120),
  tokenVersion: z.number().int().min(1),
  nonce: z.string().trim().min(1).max(64),
  visitorName: z.string().trim().min(1).max(200),
  visitorPhone: z.string().trim().min(1).max(30),
  visitorEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .max(320)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  employerName: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  visitorType: mobileVisitorTypeSchema,
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
});

export type MobileEnrollmentTokenPayload = z.infer<
  typeof mobileEnrollmentTokenPayloadSchema
>;
