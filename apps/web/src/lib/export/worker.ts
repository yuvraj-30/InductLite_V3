import { prisma } from "@/lib/db/prisma";
import { formatSignInRecordForCsv, formatContractorForCsv } from "./formatters";

function escapeCsv(cell: string): string {
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export async function generateSignInCsvForCompany(
  companyId: string,
): Promise<string> {
  const records = await prisma.signInRecord.findMany({
    where: { company_id: companyId },
    include: { site: { select: { name: true } } },
  });

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

  return lines.join("\n");
}

export async function generateContractorCsvForCompany(
  companyId: string,
): Promise<string> {
  const contractors = await prisma.contractor.findMany({
    where: { company_id: companyId },
    include: { documents: true },
  });

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

  return lines.join("\n");
}
