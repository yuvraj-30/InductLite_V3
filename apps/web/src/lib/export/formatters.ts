import { formatToE164 } from "@inductlite/shared";
import type { ContractorWithDocuments } from "@/lib/repository/contractor.repository";
import {
  decryptNullableString,
  decryptString,
} from "@/lib/security/data-protection";

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
  const visitorPhone = decryptString(record.visitor_phone);
  const visitorEmail = decryptNullableString(record.visitor_email);
  const phone =
    formatToE164(visitorPhone, "NZ") ?? visitorPhone;

  return {
    id: record.id,
    site_id: record.site_id,
    site_name: record.site?.name ?? "",
    visitor_name: record.visitor_name,
    visitor_phone: phone,
    visitor_email: visitorEmail ?? "",
    employer_name: record.employer_name ?? "",
    visitor_type: record.visitor_type,
    sign_in_ts: record.sign_in_ts.toISOString(),
    sign_out_ts: record.sign_out_ts ? record.sign_out_ts.toISOString() : "",
    notes: record.notes ?? "",
  };
}

export function formatContractorForCsv(contractor: ContractorWithDocuments) {
  const contactPhone = decryptNullableString(contractor.contact_phone);
  const contactEmail = decryptNullableString(contractor.contact_email);
  const phone = contactPhone
    ? (formatToE164(contactPhone, "NZ") ?? contactPhone)
    : "";

  return {
    id: contractor.id,
    name: contractor.name,
    contact_name: contractor.contact_name ?? "",
    contact_email: contactEmail ?? "",
    contact_phone: phone,
    trade: contractor.trade ?? "",
    is_active: contractor.is_active ? "yes" : "no",
  };
}
