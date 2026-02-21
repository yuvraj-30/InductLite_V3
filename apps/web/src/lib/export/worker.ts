import { scopedDb } from "@/lib/db/scoped-db";
import { formatSignInRecordForCsv, formatContractorForCsv } from "./formatters";
import { GUARDRAILS } from "@/lib/guardrails";
import { formatToE164 } from "@inductlite/shared";
import {
  decryptJsonValue,
  decryptNullableString,
  decryptString,
} from "@/lib/security/data-protection";

type ExportFilters = {
  siteId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

type SignInWhere = {
  company_id: string;
  site_id?: string;
  sign_in_ts?: { gte?: Date; lte?: Date };
};

function escapeCsv(cell: string): string {
  if (cell.includes('"') || cell.includes(",") || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function toCsv(rows: Array<Record<string, string>>): string {
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

function assertCsvWithinGuardrail(csv: string): void {
  if (Buffer.byteLength(csv) > GUARDRAILS.MAX_EXPORT_BYTES) {
    throw new Error("Export exceeds MAX_EXPORT_BYTES guardrail");
  }
}

function buildSignInWhere(companyId: string, filters?: ExportFilters): SignInWhere {
  const where: SignInWhere = {
    company_id: companyId,
  };

  if (filters?.siteId) {
    where.site_id = filters.siteId;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.sign_in_ts = {};
    if (filters.dateFrom) where.sign_in_ts.gte = filters.dateFrom;
    if (filters.dateTo) where.sign_in_ts.lte = filters.dateTo;
  }

  return where;
}

function normalizePhoneForExport(value: string): string {
  const decrypted = decryptString(value);
  return formatToE164(decrypted, "NZ") ?? decrypted;
}

export async function generateSignInCsvForCompany(
  companyId: string,
  filters?: ExportFilters,
): Promise<string> {
  const db = scopedDb(companyId);
  const records = await db.signInRecord.findMany({
    where: buildSignInWhere(companyId, filters),
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
  const csv = toCsv(rows);
  assertCsvWithinGuardrail(csv);
  return csv;
}

export async function generateInductionCsvForCompany(
  companyId: string,
  filters?: ExportFilters,
): Promise<string> {
  const db = scopedDb(companyId);
  const records = await db.signInRecord.findMany({
    where: buildSignInWhere(companyId, filters),
    include: {
      site: { select: { name: true } },
      induction_response: {
        select: {
          completed_at: true,
          template_version: true,
          answers: true,
        },
      },
    },
    orderBy: { sign_in_ts: "desc" },
    take: GUARDRAILS.MAX_EXPORT_ROWS + 1,
  });

  if (records.length > GUARDRAILS.MAX_EXPORT_ROWS) {
    throw new Error("Export exceeds MAX_EXPORT_ROWS guardrail");
  }

  const rows = records.map((record) => {
    const answers = decryptJsonValue<unknown[]>(
      record.induction_response?.answers ?? [],
    );
    const visitorPhone = normalizePhoneForExport(record.visitor_phone);
    const visitorEmail = decryptNullableString(record.visitor_email);

    return {
      sign_in_record_id: record.id,
      site_name: record.site.name,
      visitor_name: record.visitor_name,
      visitor_phone: visitorPhone,
      visitor_email: visitorEmail ?? "",
      visitor_type: record.visitor_type,
      sign_in_ts: record.sign_in_ts.toISOString(),
      induction_completed_at: record.induction_response?.completed_at
        ? record.induction_response.completed_at.toISOString()
        : "",
      template_version: record.induction_response
        ? String(record.induction_response.template_version)
        : "",
      answers_json: JSON.stringify(answers),
    };
  });

  const csv = toCsv(rows);
  assertCsvWithinGuardrail(csv);
  return csv;
}

export async function generateSignedAcknowledgementsCsvForCompany(
  companyId: string,
  filters?: ExportFilters,
): Promise<string> {
  const db = scopedDb(companyId);
  const records = await db.signInRecord.findMany({
    where: buildSignInWhere(companyId, filters),
    include: {
      site: { select: { name: true } },
      induction_response: {
        select: {
          completed_at: true,
          signature_url: true,
        },
      },
    },
    orderBy: { sign_in_ts: "desc" },
    take: GUARDRAILS.MAX_EXPORT_ROWS + 1,
  });

  if (records.length > GUARDRAILS.MAX_EXPORT_ROWS) {
    throw new Error("Export exceeds MAX_EXPORT_ROWS guardrail");
  }

  const rows = records.map((record) => {
    const visitorPhone = normalizePhoneForExport(record.visitor_phone);
    const signatureCaptured =
      Boolean(record.induction_response?.signature_url) ||
      Boolean(record.hasAcceptedTerms);

    return {
      sign_in_record_id: record.id,
      site_name: record.site.name,
      visitor_name: record.visitor_name,
      visitor_phone: visitorPhone,
      sign_in_ts: record.sign_in_ts.toISOString(),
      terms_accepted: record.hasAcceptedTerms ? "yes" : "no",
      terms_accepted_at: record.termsAcceptedAt
        ? record.termsAcceptedAt.toISOString()
        : "",
      induction_completed_at: record.induction_response?.completed_at
        ? record.induction_response.completed_at.toISOString()
        : "",
      signature_captured: signatureCaptured ? "yes" : "no",
    };
  });

  const csv = toCsv(rows);
  assertCsvWithinGuardrail(csv);
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
  const csv = toCsv(rows);
  assertCsvWithinGuardrail(csv);
  return csv;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]): string {
  const printableLines = lines.slice(0, 40);
  const textOps: string[] = ["BT", "/F1 11 Tf", "50 790 Td"];

  printableLines.forEach((line, index) => {
    if (index > 0) textOps.push("0 -18 Td");
    textOps.push(`(${escapePdfText(line)}) Tj`);
  });
  textOps.push("ET");

  const stream = textOps.join("\n");
  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    const offset = offsets[i] ?? 0;
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export async function generateSitePackPdfForCompany(
  companyId: string,
  filters?: ExportFilters,
): Promise<string> {
  const db = scopedDb(companyId);
  const records = await db.signInRecord.findMany({
    where: buildSignInWhere(companyId, filters),
    include: { site: { select: { name: true } } },
    orderBy: { sign_in_ts: "desc" },
    take: 200,
  });

  const lines: string[] = [
    "InductLite Site Audit Pack",
    `Generated: ${new Date().toLocaleString("en-NZ")}`,
    `Company ID: ${companyId}`,
    `Records: ${records.length}`,
    "------------------------------------------",
  ];

  records.forEach((record, index) => {
    const signOutStatus = record.sign_out_ts ? "Signed out" : "On site";
    lines.push(
      `${index + 1}. ${record.visitor_name} | ${record.site.name} | ${record.sign_in_ts.toLocaleString("en-NZ")} | ${signOutStatus}`,
    );
  });

  if (records.length === 0) {
    lines.push("No sign-in records found for the selected filters.");
  }

  return buildSimplePdf(lines);
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = buildCrc32Table();

function crc32(buffer: Buffer): number {
  let crc = 0 ^ -1;
  for (const b of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ b) & 0xff]!;
  }
  return (crc ^ -1) >>> 0;
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
    dosTime: (hours << 11) | (minutes << 5) | seconds,
  };
}

type ZipFileInput = {
  fileName: string;
  data: Buffer;
};

function buildZipArchive(files: ZipFileInput[]): Buffer {
  const now = toDosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const fileNameBuffer = Buffer.from(file.fileName, "utf8");
    const fileData = file.data;
    const crc = crc32(fileData);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.dosTime, 10);
    localHeader.writeUInt16LE(now.dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(fileData.length, 18);
    localHeader.writeUInt32LE(fileData.length, 22);
    localHeader.writeUInt16LE(fileNameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, fileNameBuffer, fileData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.dosTime, 12);
    centralHeader.writeUInt16LE(now.dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(fileData.length, 20);
    centralHeader.writeUInt32LE(fileData.length, 24);
    centralHeader.writeUInt16LE(fileNameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, fileNameBuffer);
    offset += localHeader.length + fileNameBuffer.length + fileData.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(files.length, 8);
  endRecord.writeUInt16LE(files.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

export async function generateComplianceZipForCompany(
  companyId: string,
  filters?: ExportFilters,
): Promise<Buffer> {
  const [summaryPdf, signInCsv, inductionCsv, acknowledgementsCsv] =
    await Promise.all([
      generateSitePackPdfForCompany(companyId, filters),
      generateSignInCsvForCompany(companyId, filters),
      generateInductionCsvForCompany(companyId, filters),
      generateSignedAcknowledgementsCsvForCompany(companyId, filters),
    ]);

  const files: ZipFileInput[] = [
    {
      fileName: "summary.pdf",
      data: Buffer.from(summaryPdf, "utf8"),
    },
    {
      fileName: "sign-ins.csv",
      data: Buffer.from(signInCsv, "utf8"),
    },
    {
      fileName: "induction-details.csv",
      data: Buffer.from(inductionCsv, "utf8"),
    },
    {
      fileName: "signed-acknowledgements.csv",
      data: Buffer.from(acknowledgementsCsv, "utf8"),
    },
  ];

  const zip = buildZipArchive(files);
  if (zip.byteLength > GUARDRAILS.MAX_EXPORT_BYTES) {
    throw new Error("Export exceeds MAX_EXPORT_BYTES guardrail");
  }
  return zip;
}
