function safeFilename(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function exportObjectKey(companyId: string, jobId: string): string {
  return `exports/${companyId}/${jobId}.csv`;
}

export function contractorDocumentPrefix(
  companyId: string,
  contractorId: string,
): string {
  return `contractors/${companyId}/${contractorId}/`;
}

export function contractorDocumentKey(input: {
  companyId: string;
  contractorId: string;
  documentId: string;
  filename: string;
}): string {
  const clean = safeFilename(input.filename) || "document";
  return `${contractorDocumentPrefix(input.companyId, input.contractorId)}${input.documentId}-${clean}`;
}

export function isContractorDocumentKeyForTenant(
  key: string,
  companyId: string,
  contractorId: string,
): boolean {
  if (!key || key.includes("..") || key.includes("\\")) return false;

  const prefix = contractorDocumentPrefix(companyId, contractorId);
  if (!key.startsWith(prefix)) return false;

  const objectName = key.slice(prefix.length);
  if (!objectName || objectName.includes("/")) return false;

  return true;
}
