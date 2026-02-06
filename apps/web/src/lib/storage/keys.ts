function safeFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function exportObjectKey(companyId: string, jobId: string): string {
  return `exports/${companyId}/${jobId}.csv`;
}

export function contractorDocumentKey(input: {
  companyId: string;
  contractorId: string;
  documentId: string;
  filename: string;
}): string {
  const clean = safeFilename(input.filename) || "document";
  return `contractors/${input.companyId}/${input.contractorId}/${input.documentId}-${clean}`;
}
