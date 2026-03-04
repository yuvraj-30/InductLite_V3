import { createHmac } from "crypto";
import type { CompanyInvoicePreview } from "./invoice-preview";

const DEFAULT_SYNC_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BODY_CHARS = 800;

export interface InvoiceSyncDeliveryResult {
  endpointUrl: string;
  statusCode: number;
  payloadBytes: number;
  responseBody: string | null;
  sentAt: Date;
}

export interface AccountingInvoiceSyncPayload {
  event: "billing.invoice_preview.v1";
  generatedAt: string;
  companyId: string;
  currency: "NZD";
  activeSiteCount: number;
  totals: {
    baseTotalCents: number;
    creditTotalCents: number;
    finalTotalCents: number;
  };
  sites: Array<{
    siteId: string;
    siteName: string;
    plan: "STANDARD" | "PLUS" | "PRO";
    basePriceCents: number;
    creditAppliedCents: number;
    finalPriceCents: number;
    lineItems: Array<{
      type: string;
      description: string;
      amountCents: number;
      featureKey?: string;
    }>;
  }>;
}

function truncateText(value: string): string {
  if (value.length <= MAX_RESPONSE_BODY_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_RESPONSE_BODY_CHARS)}...`;
}

function resolveEndpointUrl(rawValue: string | undefined): string {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    throw new Error("ACCOUNTING_SYNC_ENDPOINT_URL is not configured");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("ACCOUNTING_SYNC_ENDPOINT_URL is invalid");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ACCOUNTING_SYNC_ENDPOINT_URL must use HTTP or HTTPS");
  }

  return parsed.toString();
}

function computeSignature(input: {
  signingSecret: string;
  timestamp: string;
  body: string;
}): string {
  return `sha256=${createHmac("sha256", input.signingSecret)
    .update(`${input.timestamp}.${input.body}`)
    .digest("hex")}`;
}

function getFetchTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

export function buildAccountingInvoiceSyncPayload(
  preview: CompanyInvoicePreview,
): AccountingInvoiceSyncPayload {
  return {
    event: "billing.invoice_preview.v1",
    generatedAt: preview.generatedAt.toISOString(),
    companyId: preview.companyId,
    currency: preview.currency,
    activeSiteCount: preview.activeSiteCount,
    totals: {
      baseTotalCents: preview.baseTotalCents,
      creditTotalCents: preview.creditTotalCents,
      finalTotalCents: preview.finalTotalCents,
    },
    sites: preview.siteInvoices.map((site) => ({
      siteId: site.siteId,
      siteName: site.siteName,
      plan: site.plan,
      basePriceCents: site.basePriceCents,
      creditAppliedCents: site.creditAppliedCents,
      finalPriceCents: site.finalPriceCents,
      lineItems: site.lineItems.map((lineItem) => ({
        type: lineItem.type,
        description: lineItem.description,
        amountCents: lineItem.amountCents,
        featureKey: lineItem.featureKey,
      })),
    })),
  };
}

export async function syncCompanyInvoicePreviewToAccounting(input: {
  invoicePreview: CompanyInvoicePreview;
  endpointUrl?: string;
  signingSecret?: string;
  timeoutMs?: number;
}): Promise<InvoiceSyncDeliveryResult> {
  const endpointUrl = resolveEndpointUrl(
    input.endpointUrl ?? process.env.ACCOUNTING_SYNC_ENDPOINT_URL,
  );
  const payload = buildAccountingInvoiceSyncPayload(input.invoicePreview);
  const body = JSON.stringify(payload);
  const payloadBytes = new TextEncoder().encode(body).length;
  const timestamp = new Date().toISOString();
  const timeoutMs =
    typeof input.timeoutMs === "number" && Number.isFinite(input.timeoutMs)
      ? Math.max(1_000, Math.trunc(input.timeoutMs))
      : DEFAULT_SYNC_TIMEOUT_MS;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-InductLite-Event": payload.event,
    "X-InductLite-Timestamp": timestamp,
  };

  const signingSecret =
    input.signingSecret?.trim() ??
    process.env.ACCOUNTING_SYNC_SHARED_SECRET?.trim() ??
    "";
  if (signingSecret.length >= 16) {
    headers["X-InductLite-Signature"] = computeSignature({
      signingSecret,
      timestamp,
      body,
    });
  }

  const response = await fetch(endpointUrl, {
    method: "POST",
    headers,
    body,
    signal: getFetchTimeoutSignal(timeoutMs),
  });
  const responseBody = truncateText(await response.text().catch(() => ""));

  if (!response.ok) {
    throw new Error(
      `Accounting sync failed with status ${response.status}${
        responseBody ? `: ${responseBody}` : ""
      }`,
    );
  }

  return {
    endpointUrl,
    statusCode: response.status,
    payloadBytes,
    responseBody: responseBody || null,
    sentAt: new Date(),
  };
}
