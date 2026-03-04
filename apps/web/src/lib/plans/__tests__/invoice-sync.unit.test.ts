import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAccountingInvoiceSyncPayload,
  syncCompanyInvoicePreviewToAccounting,
} from "../invoice-sync";

const basePreview = {
  companyId: "company-1",
  currency: "NZD" as const,
  generatedAt: new Date("2026-03-01T00:00:00.000Z"),
  activeSiteCount: 1,
  baseTotalCents: 10_000,
  creditTotalCents: 500,
  finalTotalCents: 9_500,
  siteInvoices: [
    {
      siteId: "site-1",
      siteName: "Main Site",
      plan: "STANDARD" as const,
      basePriceCents: 5_000,
      creditAppliedCents: 500,
      finalPriceCents: 4_500,
      lineItems: [
        {
          type: "PLAN_BASE" as const,
          description: "STANDARD base plan",
          amountCents: 5_000,
        },
      ],
    },
  ],
};

describe("invoice sync", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds sync payload from invoice preview", () => {
    const payload = buildAccountingInvoiceSyncPayload(basePreview);

    expect(payload.event).toBe("billing.invoice_preview.v1");
    expect(payload.companyId).toBe("company-1");
    expect(payload.totals.finalTotalCents).toBe(9_500);
    expect(payload.sites).toHaveLength(1);
    expect(payload.sites[0]?.siteName).toBe("Main Site");
  });

  it("posts payload with signature when shared secret is provided", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const result = await syncCompanyInvoicePreviewToAccounting({
      invoicePreview: basePreview,
      endpointUrl: "https://accounting.example.test/sync",
      signingSecret: "1234567890abcdef",
      timeoutMs: 5_000,
    });

    expect(result.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://accounting.example.test/sync",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-InductLite-Event": "billing.invoice_preview.v1",
          "X-InductLite-Signature": expect.stringMatching(/^sha256=/),
        }),
      }),
    );
  });

  it("fails when endpoint is missing", async () => {
    await expect(
      syncCompanyInvoicePreviewToAccounting({
        invoicePreview: basePreview,
        endpointUrl: "",
      }),
    ).rejects.toThrow("ACCOUNTING_SYNC_ENDPOINT_URL is not configured");
  });

  it("fails on non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("upstream error", { status: 502 }),
    );

    await expect(
      syncCompanyInvoicePreviewToAccounting({
        invoicePreview: basePreview,
        endpointUrl: "https://accounting.example.test/sync",
      }),
    ).rejects.toThrow("Accounting sync failed with status 502");
  });
});
