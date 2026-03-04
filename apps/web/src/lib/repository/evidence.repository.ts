import { createHash, createHmac, timingSafeEqual } from "crypto";
import { scopedDb } from "@/lib/db/scoped-db";
import type {
  EvidenceArtifact,
  EvidenceManifest,
  EvidenceSignatureAlgorithm,
} from "@prisma/client";
import {
  handlePrismaError,
  RepositoryError,
  requireCompanyId,
} from "./base";

export interface CreateEvidenceManifestInput {
  export_job_id?: string;
  hash_root: string;
  signer?: string;
  signature_algorithm?: EvidenceSignatureAlgorithm;
  expires_at?: Date;
}

export interface CreateEvidenceArtifactInput {
  evidence_manifest_id: string;
  artifact_path: string;
  artifact_hash: string;
  artifact_size: number;
  artifact_type: string;
}

function getEvidenceSigningSecret(): string {
  const raw =
    process.env.EVIDENCE_SIGNING_SECRET ??
    process.env.CHANNEL_INTEGRATION_SIGNING_SECRET ??
    process.env.SESSION_SECRET ??
    "";
  if (raw.length < 16) {
    throw new RepositoryError(
      "Evidence signing secret is not configured",
      "VALIDATION",
    );
  }
  return raw;
}

export function sha256Hex(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export function computeEvidenceHashRoot(artifactHashes: string[]): string {
  const normalized = artifactHashes
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .sort();
  return sha256Hex(normalized.join("|"));
}

export function signEvidenceHashRoot(
  companyId: string,
  hashRoot: string,
): string {
  const secret = getEvidenceSigningSecret();
  return createHmac("sha256", secret)
    .update(`${companyId}:${hashRoot}`)
    .digest("hex");
}

export function verifyEvidenceSignature(
  companyId: string,
  hashRoot: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signEvidenceHashRoot(companyId, hashRoot), "hex");
  const provided = Buffer.from(signature.trim().toLowerCase(), "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export async function createEvidenceManifest(
  companyId: string,
  input: CreateEvidenceManifestInput,
): Promise<EvidenceManifest> {
  requireCompanyId(companyId);
  if (!input.hash_root.trim()) {
    throw new RepositoryError("hash_root is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.evidenceManifest.create({
      data: {
        export_job_id: input.export_job_id ?? null,
        hash_root: input.hash_root.trim().toLowerCase(),
        signature: signEvidenceHashRoot(companyId, input.hash_root),
        signer: input.signer?.trim() || "system",
        signature_algorithm: input.signature_algorithm ?? "HMAC_SHA256",
        expires_at: input.expires_at ?? null,
      },
    });
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    handlePrismaError(error, "EvidenceManifest");
  }
}

export async function findEvidenceManifestById(
  companyId: string,
  manifestId: string,
): Promise<EvidenceManifest | null> {
  requireCompanyId(companyId);
  if (!manifestId.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.evidenceManifest.findFirst({
      where: { id: manifestId },
    });
  } catch (error) {
    handlePrismaError(error, "EvidenceManifest");
  }
}

export async function findEvidenceManifestByExportJobId(
  companyId: string,
  exportJobId: string,
): Promise<EvidenceManifest | null> {
  requireCompanyId(companyId);
  if (!exportJobId.trim()) return null;

  try {
    const db = scopedDb(companyId);
    return await db.evidenceManifest.findFirst({
      where: { export_job_id: exportJobId },
      orderBy: { created_at: "desc" },
    });
  } catch (error) {
    handlePrismaError(error, "EvidenceManifest");
  }
}

export async function listEvidenceManifests(
  companyId: string,
  limit: number = 100,
): Promise<EvidenceManifest[]> {
  requireCompanyId(companyId);
  const safeLimit = Math.max(1, Math.min(limit, 500));

  try {
    const db = scopedDb(companyId);
    return await db.evidenceManifest.findMany({
      orderBy: [{ created_at: "desc" }],
      take: safeLimit,
    });
  } catch (error) {
    handlePrismaError(error, "EvidenceManifest");
  }
}

export async function createEvidenceArtifact(
  companyId: string,
  input: CreateEvidenceArtifactInput,
): Promise<EvidenceArtifact> {
  requireCompanyId(companyId);
  if (!input.evidence_manifest_id.trim()) {
    throw new RepositoryError("evidence_manifest_id is required", "VALIDATION");
  }
  if (!input.artifact_path.trim()) {
    throw new RepositoryError("artifact_path is required", "VALIDATION");
  }
  if (!input.artifact_hash.trim()) {
    throw new RepositoryError("artifact_hash is required", "VALIDATION");
  }

  try {
    const db = scopedDb(companyId);
    return await db.evidenceArtifact.create({
      data: {
        evidence_manifest_id: input.evidence_manifest_id,
        artifact_path: input.artifact_path.trim(),
        artifact_hash: input.artifact_hash.trim().toLowerCase(),
        artifact_size: Math.max(0, Math.trunc(input.artifact_size)),
        artifact_type: input.artifact_type.trim(),
      },
    });
  } catch (error) {
    handlePrismaError(error, "EvidenceArtifact");
  }
}

export async function listEvidenceArtifactsForManifest(
  companyId: string,
  manifestId: string,
): Promise<EvidenceArtifact[]> {
  requireCompanyId(companyId);
  if (!manifestId.trim()) return [];

  try {
    const db = scopedDb(companyId);
    return await db.evidenceArtifact.findMany({
      where: { evidence_manifest_id: manifestId },
      orderBy: [{ created_at: "asc" }],
    });
  } catch (error) {
    handlePrismaError(error, "EvidenceArtifact");
  }
}
