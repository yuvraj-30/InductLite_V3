import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { PageEmptyState } from "@/components/ui/page-state";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  getCompetencySummary,
  listCompetencyRequirements,
  listWorkerCertifications,
} from "@/lib/repository/competency.repository";
import {
  createCompetencyRequirementAction,
  createWorkerCertificationAction,
} from "./actions";

export const metadata = {
  title: "Competency Matrix | InductLite",
};

interface CompetencyPageProps {
  searchParams?: Promise<{
    flashStatus?: string;
    flashMessage?: string;
  }>;
}

function bannerClass(status: string | undefined): string {
  if (status === "ok") {
    return "border-emerald-400/35 bg-emerald-500/12 text-emerald-900 dark:text-emerald-100";
  }
  return "border-amber-400/35 bg-amber-500/12 text-amber-900 dark:text-amber-100";
}

function statusClass(status: string): string {
  if (status === "CURRENT") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "EXPIRING") {
    return "border-amber-400/35 bg-amber-500/15 text-amber-900 dark:text-amber-100";
  }
  if (status === "PENDING_VERIFICATION") {
    return "border-cyan-400/35 bg-cyan-500/15 text-cyan-950 dark:text-cyan-100";
  }
  return "border-red-400/35 bg-red-500/15 text-red-950 dark:text-red-100";
}

export default async function CompetencyPage({
  searchParams,
}: CompetencyPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const context = await requireAuthenticatedContextReadOnly();
  const [sites, summary, requirements, certifications] = await Promise.all([
    findAllSites(context.companyId),
    getCompetencySummary(context.companyId),
    listCompetencyRequirements(context.companyId, { is_active: true }),
    listWorkerCertifications(context.companyId),
  ]);
  const siteNameById = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Competency Matrix
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Define site requirements, store worker certifications, and feed faster, safer clearance decisions.
            </p>
          </div>
          <Link href="/admin/risk-passport" className="text-sm font-semibold text-accent hover:underline">
            Open Risk Passport
          </Link>
        </div>
      </div>

      {params.flashMessage ? (
        <div className={`rounded-xl border p-3 text-sm ${bannerClass(params.flashStatus)}`}>
          {params.flashMessage}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Requirements</p>
          <p className="mt-2 text-3xl font-black text-[color:var(--text-primary)]">{summary.requirements}</p>
        </div>
        <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-900 dark:text-emerald-100">Current</p>
          <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">{summary.current}</p>
        </div>
        <div className="rounded-2xl border border-amber-400/35 bg-amber-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">Expiring</p>
          <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">{summary.expiring}</p>
        </div>
        <div className="rounded-2xl border border-red-400/35 bg-red-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">Blocked</p>
          <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">{summary.blocked}</p>
        </div>
        <div className="rounded-2xl border border-cyan-400/35 bg-cyan-500/12 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cyan-950 dark:text-cyan-100">Pending verify</p>
          <p className="mt-2 text-3xl font-black text-cyan-950 dark:text-cyan-100">{summary.pending_verification}</p>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Add Requirement</h2>
        <form action={createCompetencyRequirementAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">Company-wide</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Role key (optional)
            <input name="roleKey" maxLength={80} className="input mt-1" placeholder="e.g. forklift_operator" />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Requirement name
            <input name="name" maxLength={160} required className="input mt-1" placeholder="Forklift certification" />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Description
            <textarea name="description" rows={3} maxLength={2000} className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Evidence type
            <select name="evidenceType" defaultValue="CERTIFICATION" className="input mt-1">
              <option value="INDUCTION">INDUCTION</option>
              <option value="CERTIFICATION">CERTIFICATION</option>
              <option value="DOCUMENT">DOCUMENT</option>
              <option value="LMS">LMS</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Validity days (optional)
            <input name="validityDays" type="number" min={1} max={3650} className="input mt-1" />
          </label>

          <label className="flex items-center gap-2 text-sm text-secondary md:col-span-2">
            <input
              name="isBlocking"
              type="checkbox"
              value="true"
              defaultChecked
              className="h-4 w-4 rounded border-[color:var(--border-soft)]"
            />
            Block sign-in when missing or expired
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">Create Requirement</button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Record Worker Certification</h2>
        <form action={createWorkerCertificationAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm text-secondary">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">Any site / inherited</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Requirement (optional)
            <select name="requirementId" className="input mt-1">
              <option value="">General certification</option>
              {requirements.map((requirement) => (
                <option key={requirement.id} value={requirement.id}>
                  {requirement.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-secondary">
            Worker phone
            <input name="visitorPhone" maxLength={32} required className="input mt-1" placeholder="+64210000000" />
          </label>

          <label className="text-sm text-secondary">
            Worker email (optional)
            <input name="visitorEmail" type="email" className="input mt-1" />
          </label>

          <label className="text-sm text-secondary md:col-span-2">
            Worker name
            <input name="workerName" maxLength={160} required className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Employer (optional)
            <input name="employerName" maxLength={160} className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Status
            <select name="status" defaultValue="CURRENT" className="input mt-1">
              <option value="CURRENT">CURRENT</option>
              <option value="EXPIRING">EXPIRING</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
            </select>
          </label>

          <label className="text-sm text-secondary">
            Issued at (optional)
            <input name="issuedAt" type="date" className="input mt-1" />
          </label>

          <label className="text-sm text-secondary">
            Expires at (optional)
            <input name="expiresAt" type="date" className="input mt-1" />
          </label>

          <div className="md:col-span-2">
            <button type="submit" className="btn-primary">Save Certification</button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Active Requirements</h2>
        {requirements.length === 0 ? (
          <div className="mt-3">
            <PageEmptyState
              title="No requirements configured"
              description="Create site or company-wide competency requirements to make clearance rules explicit."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Requirement</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Site</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Role</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Type</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Blocking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {requirements.map((requirement) => (
                  <tr key={requirement.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {requirement.name}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {requirement.site_id ? siteNameById.get(requirement.site_id) ?? requirement.site_id : "Company-wide"}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{requirement.role_key ?? "-"}</td>
                    <td className="px-3 py-3 text-sm text-secondary">{requirement.evidence_type}</td>
                    <td className="px-3 py-3 text-sm text-secondary">{requirement.is_blocking ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Worker Certifications</h2>
        {certifications.length === 0 ? (
          <div className="mt-3">
            <PageEmptyState
              title="No certifications recorded"
              description="Add worker evidence here so repeat sign-in can move faster and clearance decisions stay explainable."
            />
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Worker</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Phone</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Requirement</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {certifications.slice(0, 200).map((certification) => (
                  <tr key={certification.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm">
                      <p className="font-semibold text-[color:var(--text-primary)]">{certification.worker_name}</p>
                      <p className="text-xs text-muted">
                        {certification.site_id ? siteNameById.get(certification.site_id) ?? certification.site_id : "All sites"} · {certification.employer_name ?? "No employer"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{certification.visitor_phone}</td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {requirements.find((requirement) => requirement.id === certification.requirement_id)?.name ?? "General"}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClass(certification.status)}`}>
                        {certification.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {certification.expires_at ? certification.expires_at.toLocaleDateString("en-NZ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
