"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { generateRequestId } from "@/lib/auth/csrf";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createRequestLogger } from "@/lib/logger";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/lib/repository/audit.repository";
import {
  computeEvidenceHashRoot,
  findEvidenceManifestById,
  listEvidenceArtifactsForManifest,
  verifyEvidenceSignature,
} from "@/lib/repository/evidence.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";

const verifyManifestSchema = z.object({
  manifestId: z.string().cuid(),
});

function isNextRedirectError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

function buildStatusRedirect(input: {
  status: "ok" | "error";
  message: string;
  manifestId?: string;
  signatureValid?: boolean;
  rootValid?: boolean;
}) {
  const params = new URLSearchParams();
  params.set("status", input.status);
  params.set("message", input.message);
  if (input.manifestId) params.set("manifest", input.manifestId);
  if (input.signatureValid !== undefined) {
    params.set("signature", input.signatureValid ? "valid" : "invalid");
  }
  if (input.rootValid !== undefined) {
    params.set("root", input.rootValid ? "valid" : "invalid");
  }
  return `/admin/evidence?${params.toString()}`;
}

export async function verifyEvidenceManifestAction(formData: FormData): Promise<void> {
  try {
    await assertOrigin();
  } catch {
    redirect(
      buildStatusRedirect({
        status: "error",
        message: "Invalid request origin",
      }),
    );
  }

  const permission = await checkPermission("export:create");
  if (!permission.success) {
    redirect(
      buildStatusRedirect({
        status: "error",
        message: permission.error,
      }),
    );
  }

  const context = await requireAuthenticatedContextReadOnly();
  const requestId = generateRequestId();
  const log = createRequestLogger(requestId, {
    path: "/admin/evidence",
    method: "POST",
  });

  const rate = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rate.success) {
    redirect(
      buildStatusRedirect({
        status: "error",
        message: "Too many admin updates right now. Please retry in a minute.",
      }),
    );
  }

  if (!isFeatureEnabled("EVIDENCE_TAMPER_V1")) {
    redirect(
      buildStatusRedirect({
        status: "error",
        message: "Evidence verification is disabled (CONTROL_ID: FLAG-ROLLOUT-001)",
      }),
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "EVIDENCE_TAMPER_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      redirect(
        buildStatusRedirect({
          status: "error",
          message: "Evidence verification is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
        }),
      );
    }
    throw error;
  }

  const parsed = verifyManifestSchema.safeParse({
    manifestId: formData.get("manifestId")?.toString() ?? "",
  });
  if (!parsed.success) {
    redirect(
      buildStatusRedirect({
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid manifest ID",
      }),
    );
  }

  try {
    const manifest = await findEvidenceManifestById(context.companyId, parsed.data.manifestId);
    if (!manifest) {
      redirect(
        buildStatusRedirect({
          status: "error",
          message: "Evidence manifest not found",
        }),
      );
    }

    const artifacts = await listEvidenceArtifactsForManifest(context.companyId, manifest.id);
    const computedRoot = computeEvidenceHashRoot(
      artifacts.map((artifact) => artifact.artifact_hash),
    );
    const signatureValid = verifyEvidenceSignature(
      context.companyId,
      manifest.hash_root,
      manifest.signature,
    );
    const rootValid = computedRoot === manifest.hash_root;

    await createAuditLog(context.companyId, {
      action: "evidence.manifest.verify",
      entity_type: "EvidenceManifest",
      entity_id: manifest.id,
      user_id: context.userId,
      details: {
        export_job_id: manifest.export_job_id,
        artifacts_count: artifacts.length,
        signature_valid: signatureValid,
        root_valid: rootValid,
      },
      request_id: requestId,
    });

    const verified = signatureValid && rootValid;
    redirect(
      buildStatusRedirect({
        status: verified ? "ok" : "error",
        message: verified
          ? "Manifest verification passed"
          : "Manifest verification failed",
        manifestId: manifest.id,
        signatureValid,
        rootValid,
      }),
    );
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    log.error({ error: String(error) }, "Failed to verify evidence manifest");
    redirect(
      buildStatusRedirect({
        status: "error",
        message: "Failed to verify evidence manifest",
      }),
    );
  }
}
