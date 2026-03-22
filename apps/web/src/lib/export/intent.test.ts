import { describe, expect, it } from "vitest";
import {
  buildExportFilename,
  describeExportLifecycle,
  describeExportRequest,
  validateGeneratedExportContent,
} from "./intent";

describe("export intent helpers", () => {
  it("builds a readable request summary and filename", () => {
    const parameters = {
      siteId: "site-1",
      dateFrom: "2026-03-20T00:00:00.000Z",
      dateTo: "2026-03-21T00:00:00.000Z",
    };

    const summary = describeExportRequest({
      exportType: "SIGN_IN_CSV",
      parameters,
      siteName: "Central Yard",
    });
    const filename = buildExportFilename({
      exportType: "SIGN_IN_CSV",
      parameters,
      siteName: "Central Yard",
      jobId: "job-123",
    });

    expect(summary.plainText).toContain("Sign-In CSV");
    expect(summary.plainText).toContain("Site: Central Yard");
    expect(filename).toContain("sign-ins");
    expect(filename).toContain("central-yard");
    expect(filename).toContain("2026-03-20-to-2026-03-21");
    expect(filename).toContain("job-123");
  });

  it("describes delayed queued jobs clearly", () => {
    const now = new Date("2026-03-22T12:00:00.000Z");
    const lifecycle = describeExportLifecycle(
      {
        status: "QUEUED",
        queued_at: new Date("2026-03-22T11:40:00.000Z"),
        run_at: new Date("2026-03-22T12:05:00.000Z"),
        started_at: null,
        completed_at: null,
        attempts: 2,
        error_message: null,
      },
      now,
    );

    expect(lifecycle.headline).toBe("Queued");
    expect(lifecycle.detail).toContain("Queued 20m ago");
    expect(lifecycle.detail).toContain("retry scheduled in 5m");
    expect(lifecycle.isDelayed).toBe(true);
  });

  it("validates generated sign-in csv content against requested filters", () => {
    const csv = [
      "id,site_id,site_name,visitor_name,visitor_phone,visitor_email,employer_name,visitor_type,sign_in_ts,sign_out_ts,notes",
      "row-1,site-1,Central Yard,Alex,+6400000000,alex@example.com,ACME,CONTRACTOR,2026-03-20T12:00:00.000Z,,,",
    ].join("\n");

    const summary = validateGeneratedExportContent({
      exportType: "SIGN_IN_CSV",
      content: csv,
      companyId: "company-1",
      parameters: {
        siteId: "site-1",
        dateFrom: "2026-03-20T00:00:00.000Z",
        dateTo: "2026-03-21T00:00:00.000Z",
      },
      siteName: "Central Yard",
    });

    expect(summary.rowCount).toBe(1);
    expect(summary.resultSummary).toContain("CSV validated");
    expect(summary.contentHash).toHaveLength(64);
  });

  it("rejects csv content that drifts from the requested site", () => {
    const csv = [
      "id,site_id,site_name,visitor_name,visitor_phone,visitor_email,employer_name,visitor_type,sign_in_ts,sign_out_ts,notes",
      "row-1,site-2,Wrong Site,Alex,+6400000000,alex@example.com,ACME,CONTRACTOR,2026-03-20T12:00:00.000Z,,,",
    ].join("\n");

    expect(() =>
      validateGeneratedExportContent({
        exportType: "SIGN_IN_CSV",
        content: csv,
        companyId: "company-1",
        parameters: { siteId: "site-1" },
        siteName: "Central Yard",
      }),
    ).toThrow(/unexpected site/i);
  });
});
