import { formatToE164 } from "@inductlite/shared";
import type { ContractorWithDocuments } from "@/lib/repository/contractor.repository";

export type SignInRecordForCsvInput = {
  id: string;
  site_id: string;
  site?: { name?: string } | null;
  visitor_name: string;
  visitor_phone: string;
  visitor_email?: string | null;
  employer_name?: string | null;
  visitor_type: string;
  sign_in_ts: Date;
  sign_out_ts?: Date | null;
  notes?: string | null;
};

export function formatSignInRecordForCsv(record: SignInRecordForCsvInput) {
  const phone =
    formatToE164(record.visitor_phone, "NZ") ?? record.visitor_phone;

  return {
    id: record.id,
    site_id: record.site_id,
    site_name: record.site?.name ?? "",
    visitor_name: record.visitor_name,
    visitor_phone: phone,
    visitor_email: record.visitor_email ?? "",
    employer_name: record.employer_name ?? "",
    visitor_type: record.visitor_type,
    sign_in_ts: record.sign_in_ts.toISOString(),
    sign_out_ts: record.sign_out_ts ? record.sign_out_ts.toISOString() : "",
    notes: record.notes ?? "",
  };
}

export function formatContractorForCsv(contractor: ContractorWithDocuments) {
  const phone = contractor.contact_phone
    ? (formatToE164(contractor.contact_phone, "NZ") ?? contractor.contact_phone)
    : "";

  return {
    id: contractor.id,
    name: contractor.name,
    contact_name: contractor.contact_name ?? "",
    contact_email: contractor.contact_email ?? "",
    contact_phone: phone,
    trade: contractor.trade ?? "",
    is_active: contractor.is_active ? "yes" : "no",
  };
}
