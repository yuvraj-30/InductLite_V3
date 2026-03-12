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
import { PageEmptyState, PageWarningState } from "@/components/ui/page-state";
import { verifyEvidenceManifestAction } from "./actions";
import { statusChipClass } from "../components/status-chip";

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
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Tamper-Evident Evidence Packs
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Verify export bundle integrity using signed manifests and artifact hashes.
          </p>
        </div>
        <PageWarningState
          title="Evidence packs are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "EVIDENCE_TAMPER_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Tamper-Evident Evidence Packs
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Verify export bundle integrity using signed manifests and artifact hashes.
            </p>
          </div>
          <PageWarningState
            title="Evidence packs are not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Tamper-Evident Evidence Packs
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Verify export bundle integrity using signed manifests and artifact hashes.
        </p>
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

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          External Verification API
        </h2>
        <p className="mt-2 text-sm text-secondary">
          External auditors can verify a manifest signature without platform access.
        </p>
        <code className="mt-3 block overflow-x-auto rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3 text-xs text-[color:var(--text-primary)]">
          POST /api/evidence/verify {"{"}"companyId":"...","hashRoot":"...","signature":"..."{"}"}
        </code>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Evidence Manifests
        </h2>
        {manifestRows.length === 0 ? (
          <div className="mt-3">
            <PageEmptyState
              title="No evidence manifests generated yet"
              description="Run an export bundle to generate a signed manifest and artifact hashes."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Created
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Export Job
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Artifacts
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Verification
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {manifestRows.map(({ manifest, artifacts, signatureValid, rootValid }) => {
                  const verified = signatureValid && rootValid;
                  return (
                    <tr
                      key={manifest.id}
                      className="hover:bg-[color:var(--bg-surface-strong)]"
                    >
                      <td className="px-3 py-3 text-sm text-secondary">
                        {manifest.created_at.toLocaleString("en-NZ")}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        {manifest.export_job_id ?? "Manual/System"}
                      </td>
                      <td className="px-3 py-3 text-sm text-secondary">{artifacts.length}</td>
                      <td className="px-3 py-3 text-sm text-secondary">
                        <span
                          className={statusChipClass(verified ? "success" : "danger")}
                        >
                          {verified ? "VALID" : "INVALID"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <form action={verifyEvidenceManifestAction}>
                          <input type="hidden" name="manifestId" value={manifest.id} />
                          <button
                            type="submit"
                            className="rounded border border-[color:var(--border-soft)] px-2 py-1 text-xs font-medium text-accent hover:bg-[color:var(--bg-surface-strong)]"
                          >
                            Verify + Audit
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
