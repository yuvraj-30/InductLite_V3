import { NextRequest, NextResponse } from "next/server";
import { geofenceEventPayloadSchema } from "@inductlite/shared";
import type { AccessDecisionStatus } from "@prisma/client";
import { guardrailDeniedResponse } from "@/lib/api";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { GUARDRAILS } from "@/lib/guardrails";
import {
  EntitlementDeniedError,
  assertCompanyFeatureEnabled,
} from "@/lib/plans";
import { parseAccessControlConfig } from "@/lib/access-control/config";
import { createAuditLog } from "@/lib/repository/audit.repository";
import { RepositoryError } from "@/lib/repository/base";
import {
  createAccessDecisionTrace,
  findAccessDecisionTraceByCorrelationId,
} from "@/lib/repository/hardware-trace.repository";
import {
  countMobileDeviceRuntimeEventsSince,
  createMobileDeviceRuntimeEvent,
  createPresenceHint,
  findActiveDeviceSubscriptionByEndpoint,
} from "@/lib/repository/mobile-ops.repository";
import { findSiteById } from "@/lib/repository/site.repository";
import {
  createSignIn,
  findSignInById,
  signOutVisitor,
} from "@/lib/repository/signin.repository";
import {
  parseBearerToken,
  verifyMobileEnrollmentToken,
} from "@/lib/mobile/enrollment-token";

export const runtime = "nodejs";

function toLast4(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length <= 4) return digits;
  return digits.slice(-4);
}

function parseOccurredAt(input: string | undefined): Date {
  if (!input) return new Date();
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function dayStartUtc(date = new Date()): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export async function POST(request: NextRequest) {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing bearer token" },
      { status: 401 },
    );
  }

  const verified = verifyMobileEnrollmentToken(token);
  if (!verified.valid) {
    return NextResponse.json(
      { success: false, error: "Invalid enrollment token" },
      { status: 401 },
    );
  }

  const enrollment = verified.payload;
  const companyId = enrollment.companyId;
  const siteId = enrollment.siteId;

  if (!isFeatureEnabled("PWA_PUSH_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Mobile geofence automation is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  if (!isFeatureEnabled("NATIVE_MOBILE_RUNTIME_V1")) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Native mobile runtime is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
      },
      { status: 403 },
    );
  }

  try {
    await assertCompanyFeatureEnabled(companyId, "MOBILE_OFFLINE_ASSIST_V1", siteId);
    await assertCompanyFeatureEnabled(companyId, "GEOFENCE_ENFORCEMENT", siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Mobile geofence automation is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = geofenceEventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid geofence event payload",
      },
      { status: 400 },
    );
  }

  if (
    parsed.data.endpoint &&
    parsed.data.endpoint.trim() !== enrollment.endpoint
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Event endpoint does not match enrollment token",
      },
      { status: 400 },
    );
  }

  const subscription = await findActiveDeviceSubscriptionByEndpoint(
    companyId,
    enrollment.endpoint,
  );
  if (!subscription) {
    return NextResponse.json(
      {
        success: false,
        error: "Enrolled device subscription is no longer active",
      },
      { status: 401 },
    );
  }
  if (subscription.site_id && subscription.site_id !== siteId) {
    return NextResponse.json(
      {
        success: false,
        error: "Device subscription is scoped to a different site",
      },
      { status: 403 },
    );
  }
  if (
    enrollment.deviceId !== subscription.id ||
    enrollment.tokenVersion !== subscription.token_version
  ) {
    await createMobileDeviceRuntimeEvent(companyId, {
      site_id: siteId,
      device_subscription_id: subscription.id,
      event_type: "GEOFENCE",
      event_status: "REJECTED",
      correlation_id: `geo:${parsed.data.eventId}`,
      runtime_tag: subscription.platform ?? null,
      reason: "token_version_mismatch",
      payload: {
        token_version: enrollment.tokenVersion,
        expected_token_version: subscription.token_version,
      },
    });

    return NextResponse.json(
      { success: false, error: "Enrollment token version is no longer valid" },
      { status: 401 },
    );
  }

  const site = await findSiteById(companyId, siteId);
  if (!site || !site.is_active) {
    return NextResponse.json(
      { success: false, error: "Site not found" },
      { status: 404 },
    );
  }

  const correlationId = `geo:${parsed.data.eventId}`;
  const existing = await findAccessDecisionTraceByCorrelationId(
    companyId,
    correlationId,
  );
  if (existing) {
    await createMobileDeviceRuntimeEvent(companyId, {
      site_id: siteId,
      device_subscription_id: subscription.id,
      event_type: "GEOFENCE",
      event_status: "DUPLICATE",
      correlation_id: correlationId,
      runtime_tag: subscription.platform ?? null,
      reason: "duplicate_event",
      payload: {
        event_id: parsed.data.eventId,
      },
    });

    return NextResponse.json({
      success: true,
      duplicate: true,
      policyMode: parseAccessControlConfig(site.access_control).geofence
        .automationMode,
      action: "DUPLICATE",
      signInRecordId: existing.sign_in_record_id,
    });
  }

  const accessControlConfig = parseAccessControlConfig(site.access_control);
  const policyMode = accessControlConfig.geofence.automationMode;
  const occurredAt = parseOccurredAt(parsed.data.occurredAt || undefined);

  const now = Date.now();
  const ageMs = now - occurredAt.getTime();
  const maxAgeMinutes = Math.max(
    5,
    Math.min(Number(process.env.MOBILE_GEOFENCE_EVENT_MAX_AGE_MINUTES ?? "1440"), 60 * 24 * 30),
  );
  const futureSkewMinutes = Math.max(
    1,
    Math.min(Number(process.env.MOBILE_GEOFENCE_EVENT_FUTURE_SKEW_MINUTES ?? "5"), 120),
  );
  if (
    ageMs > maxAgeMinutes * 60 * 1000 ||
    ageMs < -futureSkewMinutes * 60 * 1000
  ) {
    await createMobileDeviceRuntimeEvent(companyId, {
      site_id: siteId,
      device_subscription_id: subscription.id,
      event_type: "GEOFENCE",
      event_status: "REJECTED",
      correlation_id: correlationId,
      runtime_tag: subscription.platform ?? null,
      reason: "event_stale_or_future_skew",
      payload: {
        occurred_at: occurredAt.toISOString(),
        age_ms: ageMs,
        max_age_minutes: maxAgeMinutes,
      },
    });

    return NextResponse.json(
      { success: false, error: "Geofence event is outside accepted freshness window" },
      { status: 400 },
    );
  }

  const geofenceDailyCap =
    GUARDRAILS.MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY;
  if (geofenceDailyCap > 0) {
    const usedToday = await countMobileDeviceRuntimeEventsSince(companyId, {
      since: dayStartUtc(),
      event_type: "GEOFENCE",
    });

    if (usedToday >= geofenceDailyCap) {
      return NextResponse.json(
        guardrailDeniedResponse(
          "MOBILE-GEOFENCE-GUARDRAIL-001",
          `MAX_MOBILE_GEOFENCE_EVENTS_PER_COMPANY_PER_DAY=${geofenceDailyCap}`,
          "tenant",
          "Mobile geofence daily limit reached",
        ),
        { status: 429 },
      );
    }
  }

  let decisionStatus: AccessDecisionStatus = "FALLBACK";
  let reason = "geofence_automation_off";
  let fallbackMode = true;
  let action = "NOOP";
  let signInRecordId = parsed.data.signInRecordId || null;

  try {
    if (policyMode === "OFF") {
      reason = "geofence_automation_off";
      action = "NOOP";
    } else if (policyMode === "ASSIST") {
      if (parsed.data.eventType === "EXIT" && parsed.data.signInRecordId) {
        await createPresenceHint(companyId, {
          site_id: siteId,
          sign_in_record_id: parsed.data.signInRecordId,
          hint_type: "AUTO_CHECKOUT_RECOMMENDATION",
          hint_payload: {
            source: "GEOFENCE_ASSIST",
            event_id: parsed.data.eventId,
            occurred_at: occurredAt.toISOString(),
            latitude: parsed.data.latitude ?? null,
            longitude: parsed.data.longitude ?? null,
            accuracy_m: parsed.data.accuracyM ?? null,
          },
        });
        reason = "assist_checkout_hint_created";
        action = "ASSIST_HINT_CHECKOUT";
      } else {
        reason =
          parsed.data.eventType === "ENTRY"
            ? "assist_manual_checkin_required"
            : "assist_event_recorded";
        action =
          parsed.data.eventType === "ENTRY"
            ? "ASSIST_PROMPT_CHECKIN"
            : "ASSIST_EVENT_RECORDED";
      }
    } else if (parsed.data.eventType === "ENTRY") {
      if (enrollment.visitorType !== "EMPLOYEE") {
        reason = "auto_entry_requires_employee_profile";
        action = "ASSIST_PROMPT_CHECKIN";
      } else {
        const created = await createSignIn(companyId, {
          site_id: siteId,
          visitor_name: enrollment.visitorName,
          visitor_phone: enrollment.visitorPhone,
          visitor_email: enrollment.visitorEmail ?? undefined,
          employer_name: enrollment.employerName ?? undefined,
          visitor_type: enrollment.visitorType,
          notes: `Auto check-in via geofence event ${parsed.data.eventId}`,
        });
        signInRecordId = created.id;
        decisionStatus = "ALLOW";
        reason = "auto_checkin_created";
        fallbackMode = false;
        action = "AUTO_CHECKIN";
      }
    } else {
      if (!parsed.data.signInRecordId) {
        reason = "auto_checkout_signin_record_missing";
        action = "ASSIST_PROMPT_CHECKOUT";
      } else {
        const signInRecord = await findSignInById(companyId, parsed.data.signInRecordId);
        if (!signInRecord) {
          reason = "auto_checkout_signin_record_not_found";
          action = "NOOP";
        } else if (signInRecord.sign_out_ts) {
          decisionStatus = "ALLOW";
          reason = "auto_checkout_already_signed_out";
          fallbackMode = false;
          action = "NOOP_ALREADY_SIGNED_OUT";
        } else {
          const minutesSinceSignIn = Math.floor(
            Math.max(0, occurredAt.getTime() - signInRecord.sign_in_ts.getTime()) /
              60000,
          );
          const graceMinutes = accessControlConfig.geofence.autoCheckoutGraceMinutes;
          if (minutesSinceSignIn < graceMinutes) {
            await createPresenceHint(companyId, {
              site_id: siteId,
              sign_in_record_id: signInRecord.id,
              hint_type: "AUTO_CHECKOUT_GUARDRAIL_REVIEW",
              hint_payload: {
                source: "GEOFENCE_AUTO",
                event_id: parsed.data.eventId,
                minutes_since_sign_in: minutesSinceSignIn,
                grace_minutes: graceMinutes,
              },
            });
            reason = "auto_checkout_guardrail_hold";
            action = "ASSIST_HINT_CHECKOUT";
          } else {
            await signOutVisitor(companyId, signInRecord.id);
            decisionStatus = "ALLOW";
            reason = "auto_checkout_completed";
            fallbackMode = false;
            action = "AUTO_CHECKOUT";
          }
        }
      }
    }
  } catch (error) {
    if (error instanceof RepositoryError && error.code === "ALREADY_EXISTS") {
      return NextResponse.json({
        success: true,
        duplicate: true,
        policyMode,
        action: "DUPLICATE",
        signInRecordId,
      });
    }

    await createAccessDecisionTrace(companyId, {
      site_id: siteId,
      correlation_id: correlationId,
      decision_status: "ERROR",
      reason: "geofence_event_processing_failed",
      sign_in_record_id: signInRecordId ?? undefined,
      fallback_mode: true,
      request_payload: {
        event_id: parsed.data.eventId,
        event_type: parsed.data.eventType,
      },
      response_payload: {
        error: error instanceof Error ? error.message : String(error),
      },
      decided_at: new Date(),
    }).catch(() => undefined);

    await createMobileDeviceRuntimeEvent(companyId, {
      site_id: siteId,
      device_subscription_id: subscription.id,
      event_type: "GEOFENCE",
      event_status: "ERROR",
      correlation_id: correlationId,
      runtime_tag: subscription.platform ?? null,
      reason: "geofence_event_processing_failed",
      payload: {
        event_id: parsed.data.eventId,
        event_type: parsed.data.eventType,
      },
    });

    return NextResponse.json(
      { success: false, error: "Failed to process geofence event" },
      { status: 500 },
    );
  }

  await createAccessDecisionTrace(companyId, {
    site_id: siteId,
    correlation_id: correlationId,
    decision_status: decisionStatus,
    reason,
    sign_in_record_id: signInRecordId ?? undefined,
    fallback_mode: fallbackMode,
    request_payload: {
      event_id: parsed.data.eventId,
      event_type: parsed.data.eventType,
      occurred_at: occurredAt.toISOString(),
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      accuracy_m: parsed.data.accuracyM ?? null,
      endpoint: enrollment.endpoint,
    },
    response_payload: {
      action,
      policy_mode: policyMode,
    },
    decided_at: new Date(),
  });

  await createAuditLog(companyId, {
    action: "mobile.geofence_event.process",
    entity_type: "Site",
    entity_id: siteId,
    user_id: subscription.user_id ?? undefined,
    details: {
      event_id: parsed.data.eventId,
      event_type: parsed.data.eventType,
      policy_mode: policyMode,
      action,
      decision_status: decisionStatus,
      reason,
      visitor_type: enrollment.visitorType,
      visitor_phone_last4: toLast4(enrollment.visitorPhone),
      sign_in_record_id: signInRecordId,
    },
  });

  await createMobileDeviceRuntimeEvent(companyId, {
    site_id: siteId,
    device_subscription_id: subscription.id,
    event_type: "GEOFENCE",
    event_status: "ACCEPTED",
    correlation_id: correlationId,
    runtime_tag: subscription.platform ?? null,
    reason,
    payload: {
      event_id: parsed.data.eventId,
      event_type: parsed.data.eventType,
      action,
      policy_mode: policyMode,
    },
  });

  return NextResponse.json({
    success: true,
    duplicate: false,
    policyMode,
    action,
    signInRecordId,
  });
}
