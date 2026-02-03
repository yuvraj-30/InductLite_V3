import { describe, it, expect } from "vitest";
import {
  formatSignInRecordForCsv,
  formatContractorForCsv,
} from "@/lib/export/formatters";

describe("Export formatters", () => {
  it("formats visitor phone to E.164 for sign-in records", () => {
    const record: any = {
      id: "r1",
      company_id: "c1",
      site_id: "s1",
      site: { id: "s1", name: "Site A" },
      visitor_name: "Alice",
      visitor_phone: "041234567",
      visitor_email: "alice@example.com",
      employer_name: "Acme Co",
      visitor_type: "VISITOR",
      sign_in_ts: new Date("2024-01-01T10:00:00Z"),
      sign_out_ts: null,
      notes: null,
      created_at: new Date(),
    };

    const out = formatSignInRecordForCsv(record);
    expect(out.visitor_phone).toMatch(/^\+64/);
    expect(out.sign_in_ts).toBe("2024-01-01T10:00:00.000Z");
  });

  it("formats contractor contact phone to E.164 when present", () => {
    const contractor: any = {
      id: "c1",
      company_id: "co1",
      name: "Contr",
      contact_name: "Bob",
      contact_email: "bob@example.com",
      contact_phone: "021 123 4567",
      trade: "Plumbing",
      notes: null,
      is_active: true,
      documents: [],
      created_at: new Date(),
    };

    const out = formatContractorForCsv(contractor);
    expect(out.contact_phone).toMatch(/^\+64/);
    expect(out.is_active).toBe("yes");
  });
});
