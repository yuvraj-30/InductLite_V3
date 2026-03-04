import { scopedDb } from "@/lib/db/scoped-db";
import type { Prisma } from "@prisma/client";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { createAuditLog } from "@/lib/repository/audit.repository";

const DEFAULT_PROVIDER_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_MESSAGES_PER_COMPANY_PER_MONTH = 0;
const SMS_CONTROL_ID_DISABLED = "SMS-GUARDRAIL-001";
const SMS_CONTROL_ID_QUOTA = "SMS-GUARDRAIL-002";
const SMS_CONTROL_ID_PROVIDER = "SMS-GUARDRAIL-003";

export interface SendSmsInput {
  companyId: string;
  siteId?: string;
  toE164: string;
  message: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendSmsResult {
  status: "SENT" | "DISABLED" | "DENIED" | "FAILED";
  controlId?: string;
  reason?: string;
  providerMessageId?: string;
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function getMonthlyWindow(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { from, to };
}

function maskToLast4(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length <= 4) {
    return digits;
  }
  return digits.slice(-4);
}

async function countSentSmsForCurrentMonth(
  companyId: string,
  now: Date,
): Promise<number> {
  const db = scopedDb(companyId);
  const window = getMonthlyWindow(now);

  return db.auditLog.count({
    where: {
      company_id: companyId,
      action: "sms.sent",
      created_at: {
        gte: window.from,
        lt: window.to,
      },
    },
  });
}

function getFetchTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

async function deliverWithWebhookProvider(input: SendSmsInput): Promise<{
  ok: boolean;
  messageId?: string;
  reason?: string;
}> {
  const webhookUrl = process.env.SMS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return {
      ok: false,
      reason: "SMS_WEBHOOK_URL is not configured",
    };
  }

  const authToken = process.env.SMS_WEBHOOK_AUTH_TOKEN?.trim();
  const timeoutMs = parsePositiveInt(
    process.env.SMS_PROVIDER_TIMEOUT_MS,
    DEFAULT_PROVIDER_TIMEOUT_MS,
  );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: input.toE164,
        message: input.message,
        companyId: input.companyId,
        siteId: input.siteId ?? null,
        requestId: input.requestId ?? null,
        metadata: input.metadata ?? {},
      }),
      signal: getFetchTimeoutSignal(timeoutMs),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: `Provider returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json().catch(() => null)) as
      | { messageId?: string; id?: string }
      | null;

    return {
      ok: true,
      messageId: body?.messageId ?? body?.id,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown provider error",
    };
  }
}

async function deliverSms(input: SendSmsInput): Promise<{
  ok: boolean;
  messageId?: string;
  reason?: string;
  provider: string;
}> {
  const provider = (process.env.SMS_PROVIDER ?? "webhook")
    .trim()
    .toLowerCase();

  if (provider === "mock") {
    return {
      ok: true,
      messageId: `mock-${Date.now()}`,
      provider: "mock",
    };
  }

  if (provider !== "webhook") {
    return {
      ok: false,
      reason: `Unsupported SMS provider: ${provider}`,
      provider,
    };
  }

  const result = await deliverWithWebhookProvider(input);
  return {
    ...result,
    provider: "webhook",
  };
}

export async function sendSmsWithQuota(
  input: SendSmsInput,
): Promise<SendSmsResult> {
  const now = new Date();
  const smsEnabled = parseBoolean(process.env.SMS_ENABLED);
  if (!smsEnabled) {
    return {
      status: "DISABLED",
      controlId: SMS_CONTROL_ID_DISABLED,
      reason: "SMS is disabled by guardrail",
    };
  }

  try {
    await assertCompanyFeatureEnabled(
      input.companyId,
      "SMS_WORKFLOWS",
      input.siteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        status: "DENIED",
        controlId: error.controlId,
        reason: "SMS workflows are disabled by plan entitlement",
      };
    }
    throw error;
  }

  const monthlyCap = parsePositiveInt(
    process.env.MAX_MESSAGES_PER_COMPANY_PER_MONTH,
    DEFAULT_MAX_MESSAGES_PER_COMPANY_PER_MONTH,
  );
  if (monthlyCap <= 0) {
    return {
      status: "DENIED",
      controlId: SMS_CONTROL_ID_QUOTA,
      reason: "Monthly SMS cap is zero",
    };
  }

  const sentCount = await countSentSmsForCurrentMonth(input.companyId, now);
  if (sentCount >= monthlyCap) {
    await createAuditLog(input.companyId, {
      action: "sms.denied",
      entity_type: "SmsMessage",
      user_id: undefined,
      details: {
        reason: "monthly_quota_exceeded",
        cap: monthlyCap,
        sent: sentCount,
        to_last4: maskToLast4(input.toE164),
      },
      request_id: input.requestId,
    });

    return {
      status: "DENIED",
      controlId: SMS_CONTROL_ID_QUOTA,
      reason: `Monthly SMS quota exceeded (${sentCount}/${monthlyCap})`,
    };
  }

  if (input.message.trim().length === 0) {
    return {
      status: "FAILED",
      controlId: SMS_CONTROL_ID_PROVIDER,
      reason: "SMS message content is empty",
    };
  }

  const delivery = await deliverSms(input);
  const metadataJson = input.metadata
    ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
    : null;

  if (!delivery.ok) {
    await createAuditLog(input.companyId, {
      action: "sms.failed",
      entity_type: "SmsMessage",
      user_id: undefined,
      details: {
        provider: delivery.provider,
        reason: delivery.reason ?? "provider_error",
        to_last4: maskToLast4(input.toE164),
        message_length: input.message.length,
      },
      request_id: input.requestId,
    });

    return {
      status: "FAILED",
      controlId: SMS_CONTROL_ID_PROVIDER,
      reason: delivery.reason ?? "SMS provider failed",
    };
  }

  await createAuditLog(input.companyId, {
    action: "sms.sent",
    entity_type: "SmsMessage",
    user_id: undefined,
    details: {
      provider: delivery.provider,
      provider_message_id: delivery.messageId ?? null,
      to_last4: maskToLast4(input.toE164),
      message_length: input.message.length,
      site_id: input.siteId ?? null,
      metadata: metadataJson,
    },
    request_id: input.requestId,
  });

  return {
    status: "SENT",
    providerMessageId: delivery.messageId,
  };
}
