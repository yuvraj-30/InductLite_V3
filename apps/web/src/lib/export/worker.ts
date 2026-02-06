import { scopedDb } from "@/lib/db/scoped-db";
import { formatSignInRecordForCsv, formatContractorForCsv } from "./formatters";
import { GUARDRAILS } from "@/lib/guardrails";

function escapeCsv(cell: string): string {
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export async function generateSignInCsvForCompany(
  companyId: string,
): Promise<string> {
  const db = scopedDb(companyId);
  const records = await db.signInRecord.findMany({
    where: { company_id: companyId },
    include: { site: { select: { name: true } } },
    orderBy: { sign_in_ts: "desc" },
    take: GUARDRAILS.MAX_EXPORT_ROWS + 1,
  });

  if (records.length > GUARDRAILS.MAX_EXPORT_ROWS) {
    throw new Error("Export exceeds MAX_EXPORT_ROWS guardrail");
  }

  const rows: Array<Record<string, string>> = records.map(
    formatSignInRecordForCsv,
  );
  if (rows.length === 0) return "";

  const firstRow = rows[0];
  if (!firstRow) return "";
  const headers = Object.keys(firstRow);

  const lines = [headers.join(",")];
  for (const row of rows) {
    const cols = headers.map((h) =>
      escapeCsv(String(row[h as keyof typeof row] ?? "")),
    );
    lines.push(cols.join(","));
  }

  const csv = lines.join("\n");
  if (Buffer.byteLength(csv) > GUARDRAILS.MAX_EXPORT_BYTES) {
    throw new Error("Export exceeds MAX_EXPORT_BYTES guardrail");
  }

  return csv;
}

export async function generateContractorCsvForCompany(
  companyId: string,
): Promise<string> {
  const db = scopedDb(companyId);
  const contractors = await db.contractor.findMany({
    where: { company_id: companyId },
    include: { documents: true },
    orderBy: { name: "asc" },
    take: GUARDRAILS.MAX_EXPORT_ROWS + 1,
  });

  if (contractors.length > GUARDRAILS.MAX_EXPORT_ROWS) {
    throw new Error("Export exceeds MAX_EXPORT_ROWS guardrail");
  }

  const rows: Array<Record<string, string>> = contractors.map(
    formatContractorForCsv,
  );
  if (rows.length === 0) return "";

  const firstRow = rows[0];
  if (!firstRow) return "";
  const headers = Object.keys(firstRow);

  const lines = [headers.join(",")];
  for (const row of rows) {
    const cols = headers.map((h) =>
      escapeCsv(String(row[h as keyof typeof row] ?? "")),
    );
    lines.push(cols.join(","));
  }

  const csv = lines.join("\n");
  if (Buffer.byteLength(csv) > GUARDRAILS.MAX_EXPORT_BYTES) {
    throw new Error("Export exceeds MAX_EXPORT_BYTES guardrail");
  }

  return csv;
}
