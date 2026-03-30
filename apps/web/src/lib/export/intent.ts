import { createHash } from "node:crypto";
import type { ExportStatus, ExportType } from "@prisma/client";

export const SIGN_IN_CSV_HEADERS = [
  "id",
  "site_id",
  "site_name",
  "visitor_name",
  "visitor_phone",
  "visitor_email",
  "employer_name",
  "visitor_type",
  "sign_in_ts",
  "sign_out_ts",
  "notes",
] as const;

export const INDUCTION_CSV_HEADERS = [
  "sign_in_record_id",
  "site_name",
  "visitor_name",
  "visitor_phone",
  "visitor_email",
  "visitor_type",
  "sign_in_ts",
  "induction_completed_at",
  "template_version",
  "answers_json",
] as const;

export const SIGNED_ACKNOWLEDGEMENTS_CSV_HEADERS = [
  "sign_in_record_id",
  "site_name",
  "visitor_name",
  "visitor_phone",
  "sign_in_ts",
  "terms_accepted",
  "terms_accepted_at",
  "induction_completed_at",
  "signature_captured",
] as const;

export const CONTRACTOR_CSV_HEADERS = [
  "id",
  "name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "trade",
  "is_active",
] as const;

export type SupportedExportType = ExportType | "CONTRACTOR_CSV";

const EXPORT_LABELS: Record<SupportedExportType, string> = {
  SIGN_IN_CSV: "Sign-In CSV",
  INDUCTION_CSV: "Induction CSV",
  SITE_PACK_PDF: "Site Audit Pack PDF",
  COMPLIANCE_ZIP: "Compliance Pack ZIP",
  CONTRACTOR_CSV: "Contractor CSV",
};

const EXPORT_FILE_BASE_NAMES: Record<SupportedExportType, string> = {
  SIGN_IN_CSV: "sign-ins",
  INDUCTION_CSV: "induction-details",
  SITE_PACK_PDF: "site-audit-pack",
  COMPLIANCE_ZIP: "compliance-pack",
  CONTRACTOR_CSV: "contractors",
};

const EXPORT_FILE_EXTENSIONS: Record<SupportedExportType, string> = {
  SIGN_IN_CSV: "csv",
  INDUCTION_CSV: "csv",
  SITE_PACK_PDF: "pdf",
  COMPLIANCE_ZIP: "zip",
  CONTRACTOR_CSV: "csv",
};

export type ParsedExportRequest = {
  siteId?: string;
  contractorIds: string[];
  dateFrom?: Date;
  dateTo?: Date;
};

export type ExportJobForLifecycle = {
  status: ExportStatus;
  queued_at: Date;
  run_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  attempts: number;
  error_message: string | null;
};

export type ExportLifecycleDescription = {
  headline: string;
  detail: string;
  isDelayed: boolean;
};

export type ExportRequestSummary = {
  title: string;
  siteLabel: string;
  rangeLabel: string;
  contractorLabel: string | null;
  filters: string[];
  plainText: string;
};

export type ExportValidationSummary = {
  contentHash: string;
  rowCount: number | null;
  resultSummary: string;
};

function coerceDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function toDateToken(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toDisplayDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

function sanitizeFilenameSegment(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  return normalized || fallback;
}

function formatRelativeDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  if (totalMinutes < 1) {
    const seconds = Math.max(1, Math.floor(ms / 1000));
    return `${seconds}s`;
  }

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getTimestampRangeLabel(
  request: ParsedExportRequest,
  fallback = "All available dates",
): string {
  if (request.dateFrom && request.dateTo) {
    return `${toDisplayDate(request.dateFrom)} -> ${toDisplayDate(request.dateTo)}`;
  }
  if (request.dateFrom) {
    return `From ${toDisplayDate(request.dateFrom)}`;
  }
  if (request.dateTo) {
    return `Until ${toDisplayDate(request.dateTo)}`;
  }
  return fallback;
}

function parseCsv(csv: string): string[][] {
  if (!csv.length) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];

    if (inQuotes) {
      if (char === '"') {
        if (csv[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((candidate) => candidate.length > 1 || candidate[0] !== "");
}

function assertHeaders(
  actualHeaders: string[],
  expectedHeaders: readonly string[],
  exportType: SupportedExportType,
): void {
  if (
    actualHeaders.length !== expectedHeaders.length ||
    actualHeaders.some((header, index) => header !== expectedHeaders[index])
  ) {
    throw new Error(
      `${exportType} headers do not match the expected export contract`,
    );
  }
}

function validateTimestamp(
  value: string,
  fieldName: string,
  exportType: SupportedExportType,
): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${exportType} contains an invalid ${fieldName} value`);
  }
  return parsed;
}

function ensureTimestampInRange(
  timestamp: Date,
  request: ParsedExportRequest,
  exportType: SupportedExportType,
): void {
  if (request.dateFrom && timestamp < request.dateFrom) {
    throw new Error(`${exportType} contains rows earlier than the requested range`);
  }

  if (request.dateTo && timestamp > request.dateTo) {
    throw new Error(`${exportType} contains rows later than the requested range`);
  }
}

export function parseExportRequestParameters(
  parameters: unknown,
): ParsedExportRequest {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    return { contractorIds: [] };
  }

  const source = parameters as Record<string, unknown>;
  return {
    siteId:
      typeof source.siteId === "string" && source.siteId.trim()
        ? source.siteId
        : undefined,
    contractorIds: Array.isArray(source.contractorIds)
      ? source.contractorIds.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0,
        )
      : [],
    dateFrom: coerceDate(source.dateFrom),
    dateTo: coerceDate(source.dateTo),
  };
}

export function describeExportRequest(input: {
  exportType: SupportedExportType;
  parameters: unknown;
  siteName?: string | null;
}): ExportRequestSummary {
  const request = parseExportRequestParameters(input.parameters);
  const title = EXPORT_LABELS[input.exportType];
  const siteLabel = request.siteId
    ? input.siteName?.trim() || request.siteId
    : "All sites";
  const rangeLabel = getTimestampRangeLabel(request);
  const contractorLabel =
    request.contractorIds.length > 0
      ? `${request.contractorIds.length} contractor filter(s)`
      : null;

  const filters = [`Site: ${siteLabel}`, `Range: ${rangeLabel}`];
  if (contractorLabel) {
    filters.push(`Contractors: ${contractorLabel}`);
  }

  return {
    title,
    siteLabel,
    rangeLabel,
    contractorLabel,
    filters,
    plainText: `${title} | ${filters.join(" | ")}`,
  };
}

export function buildExportFilename(input: {
  exportType: SupportedExportType;
  parameters: unknown;
  siteName?: string | null;
  jobId: string;
}): string {
  const request = parseExportRequestParameters(input.parameters);
  const siteToken = sanitizeFilenameSegment(
    input.siteName?.trim() || request.siteId || "all-sites",
    "all-sites",
  );
  const rangeToken = request.dateFrom && request.dateTo
    ? `${toDateToken(request.dateFrom)}-to-${toDateToken(request.dateTo)}`
    : request.dateFrom
      ? `from-${toDateToken(request.dateFrom)}`
      : request.dateTo
        ? `until-${toDateToken(request.dateTo)}`
        : "all-dates";

  const contractorToken =
    request.contractorIds.length > 0
      ? `contractors-${request.contractorIds.length}`
      : null;

  const parts = [
    EXPORT_FILE_BASE_NAMES[input.exportType],
    siteToken,
    rangeToken,
    contractorToken,
    sanitizeFilenameSegment(input.jobId, "job"),
  ].filter(Boolean);

  return `${parts.join("--")}.${EXPORT_FILE_EXTENSIONS[input.exportType]}`;
}

export function describeExportLifecycle(
  job: ExportJobForLifecycle,
  now: Date = new Date(),
): ExportLifecycleDescription {
  if (job.status === "SUCCEEDED") {
    const completedAt = job.completed_at ?? job.queued_at;
    return {
      headline: "Ready to download",
      detail: `Completed ${formatRelativeDuration(now.getTime() - completedAt.getTime())} ago`,
      isDelayed: false,
    };
  }

  if (job.status === "FAILED") {
    return {
      headline: "Export failed",
      detail:
        job.error_message?.trim() ||
        `Failed after ${Math.max(job.attempts, 1)} attempt(s)`,
      isDelayed: true,
    };
  }

  if (job.status === "RUNNING") {
    const startedAt = job.started_at ?? job.queued_at;
    return {
      headline: "Processing",
      detail: `Started ${formatRelativeDuration(now.getTime() - startedAt.getTime())} ago`,
      isDelayed: false,
    };
  }

  const queuedForMs = now.getTime() - job.queued_at.getTime();
  const retryInMs = job.run_at.getTime() - now.getTime();
  const detail =
    retryInMs > 0
      ? `Queued ${formatRelativeDuration(queuedForMs)} ago; retry scheduled in ${formatRelativeDuration(retryInMs)}`
      : `Queued ${formatRelativeDuration(queuedForMs)} ago`;

  return {
    headline: "Queued",
    detail,
    isDelayed: queuedForMs >= 10 * 60 * 1000,
  };
}

export function validateGeneratedExportContent(input: {
  exportType: SupportedExportType;
  content: string | Buffer;
  companyId: string;
  parameters: unknown;
  siteName?: string | null;
}): ExportValidationSummary {
  const request = parseExportRequestParameters(input.parameters);
  const requestSummary = describeExportRequest({
    exportType: input.exportType,
    parameters: input.parameters,
    siteName: input.siteName,
  }).plainText;
  const contentBuffer = Buffer.isBuffer(input.content)
    ? input.content
    : Buffer.from(input.content, "utf8");
  const contentHash = createHash("sha256").update(contentBuffer).digest("hex");

  if (input.exportType === "SITE_PACK_PDF") {
    const pdfText = contentBuffer.toString("utf8");
    if (!pdfText.includes("InductLite Site Audit Pack")) {
      throw new Error("SITE_PACK_PDF is missing the expected pack heading");
    }
    if (!pdfText.includes(`Company ID: ${input.companyId}`)) {
      throw new Error("SITE_PACK_PDF is missing the expected company summary");
    }
    if (!pdfText.includes(`Site: ${input.siteName?.trim() || request.siteId || "All sites"}`)) {
      throw new Error("SITE_PACK_PDF is missing the requested site summary");
    }
    if (!pdfText.includes(`Date range: ${getTimestampRangeLabel(request)}`)) {
      throw new Error("SITE_PACK_PDF is missing the requested date range summary");
    }

    const match = pdfText.match(/Records: (\d+)/);
    const rowCount = match ? Number(match[1]) : null;
    return {
      contentHash,
      rowCount,
      resultSummary: `${requestSummary} | PDF pack validated${rowCount !== null ? ` | Records: ${rowCount}` : ""}`,
    };
  }

  if (input.exportType === "COMPLIANCE_ZIP") {
    const zipText = contentBuffer.toString("latin1");
    const requiredEntries = [
      "summary.pdf",
      "sign-ins.csv",
      "induction-details.csv",
      "signed-acknowledgements.csv",
    ];
    for (const requiredEntry of requiredEntries) {
      if (!zipText.includes(requiredEntry)) {
        throw new Error(`COMPLIANCE_ZIP is missing ${requiredEntry}`);
      }
    }
    if (!zipText.includes("InductLite Site Audit Pack")) {
      throw new Error("COMPLIANCE_ZIP is missing the embedded summary pack");
    }

    return {
      contentHash,
      rowCount: null,
      resultSummary: `${requestSummary} | ZIP bundle validated | Files: ${requiredEntries.join(", ")}`,
    };
  }

  const csvText = Buffer.isBuffer(input.content)
    ? input.content.toString("utf8")
    : input.content;
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error(`${input.exportType} generated an empty CSV payload`);
  }

  const [headers, ...dataRows] = rows;
  if (!headers) {
    throw new Error(`${input.exportType} is missing CSV headers`);
  }

  const expectedHeaders =
    input.exportType === "SIGN_IN_CSV"
      ? SIGN_IN_CSV_HEADERS
      : input.exportType === "INDUCTION_CSV"
        ? INDUCTION_CSV_HEADERS
        : CONTRACTOR_CSV_HEADERS;

  assertHeaders(headers, expectedHeaders, input.exportType);

  if (
    (input.exportType === "SIGN_IN_CSV" || input.exportType === "INDUCTION_CSV") &&
    dataRows.length > 0
  ) {
    const siteNameIndex = headers.indexOf("site_name");
    const timestampIndex = headers.indexOf("sign_in_ts");
    const expectedSiteName = input.siteName?.trim();

    if (siteNameIndex < 0 || timestampIndex < 0) {
      throw new Error(`${input.exportType} is missing semantic validation columns`);
    }

    for (const row of dataRows) {
      const actualSiteName = row[siteNameIndex] ?? "";
      if (expectedSiteName && actualSiteName && actualSiteName !== expectedSiteName) {
        throw new Error(`${input.exportType} contains rows from an unexpected site`);
      }

      const timestamp = validateTimestamp(
        row[timestampIndex] ?? "",
        "sign_in_ts",
        input.exportType,
      );
      ensureTimestampInRange(timestamp, request, input.exportType);
    }
  }

  return {
    contentHash,
    rowCount: dataRows.length,
    resultSummary: `${requestSummary} | CSV validated | Rows: ${dataRows.length}`,
  };
}
