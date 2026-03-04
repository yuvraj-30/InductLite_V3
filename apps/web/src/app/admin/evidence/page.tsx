import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import {
  computeEvidenceHashRoot,
  listEvidenceArtifactsForManifest,
  listEvidenceManifests,
  verifyEvidenceSignature,
} from "@/lib/repository/evidence.repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { verifyEvidenceManifestAction } from "./actions";

export const metadata = {
  title: "Evidence Packs | InductLite",
};

interface EvidencePageProps {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    manifest?: string;
    signature?: string;
    root?: string;
  }>;
}

function statusBannerClass(status: string | undefined): string {
  if (status === "ok") {
    return "border-green-200 bg-green-50 text-green-800";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

export default async function EvidencePage({ searchParams }: EvidencePageProps) {
  const guard = await checkPermissionReadOnly("export:create");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const params = (await searchParams) ?? {};

  if (!isFeatureEnabled("EVIDENCE_TAMPER_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Tamper-Evident Evidence Packs</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Evidence packs are disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "EVIDENCE_TAMPER_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Tamper-Evident Evidence Packs</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Evidence packs are not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const manifests = await listEvidenceManifests(context.companyId, 100);
  const manifestRows = await Promise.all(
    manifests.map(async (manifest) => {
      const artifacts = await listEvidenceArtifactsForManifest(context.companyId, manifest.id);
      const computedRoot = computeEvidenceHashRoot(artifacts.map((artifact) => artifact.artifact_hash));
      const signatureValid = verifyEvidenceSignature(
        context.companyId,
        manifest.hash_root,
        manifest.signature,
      );
      const rootValid = computedRoot === manifest.hash_root;

      return {
        manifest,
        artifacts,
        signatureValid,
        rootValid,
      };
    }),
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tamper-Evident Evidence Packs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Verify export bundle integrity using signed manifests and artifact hashes.
          </p>
        </div>
      </div>

      {params.message ? (
        <div className={`rounded-lg border p-3 text-sm ${statusBannerClass(params.status)}`}>
          <p className="font-semibold">{params.message}</p>
          {(params.signature || params.root) && (
            <p className="mt-1 text-xs">
              Signature: {params.signature ?? "-"} | Hash root: {params.root ?? "-"}
            </p>
          )}
        </div>
      ) : null}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          External Verification API
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          External auditors can verify a manifest signature without platform access.
        </p>
        <code className="mt-3 block overflow-x-auto rounded bg-gray-900 p-3 text-xs text-green-200">
          POST /api/evidence/verify {"{"}"companyId":"...","hashRoot":"...","signature":"..."{"}"}
        </code>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Evidence Manifests
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Created
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Export Job
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Artifacts
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Verification
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {manifestRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No evidence manifests generated yet.
                  </td>
                </tr>
              ) : (
                manifestRows.map(({ manifest, artifacts, signatureValid, rootValid }) => {
                  const verified = signatureValid && rootValid;
                  return (
                    <tr key={manifest.id}>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {manifest.created_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        {manifest.export_job_id ?? "Manual/System"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700">{artifacts.length}</td>
                      <td className="px-3 py-3 text-sm text-gray-700">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            verified
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {verified ? "VALID" : "INVALID"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <form action={verifyEvidenceManifestAction}>
                          <input type="hidden" name="manifestId" value={manifest.id} />
                          <button
                            type="submit"
                            className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            Verify + Audit
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
