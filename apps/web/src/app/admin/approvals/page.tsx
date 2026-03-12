import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { listTemplates } from "@/lib/repository/template.repository";
import { PageWarningState } from "@/components/ui/page-state";
import {
  listIdentityVerificationRecords,
  listVisitorApprovalPolicies,
  listVisitorApprovalRequests,
  listVisitorWatchlistEntries,
} from "@/lib/repository/visitor-approval.repository";
import {
  addWatchlistEntryAction,
  createIdentityVerificationRecordAction,
  decideVisitorApprovalRequestAction,
  deactivateWatchlistEntryAction,
  upsertApprovalPolicyAction,
} from "./actions";

export const metadata = {
  title: "Approvals | InductLite",
};

function approvalStatusChipClass(status: string): string {
  if (status === "APPROVED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (status === "DENIED") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
}

function identityResultChipClass(result: string): string {
  if (result === "PASS") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  if (result === "FAIL") {
    return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
  }
  return "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100";
}

export default async function ApprovalsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("ID_HARDENING_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Approvals & Identity
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Configure policy-based approvals, manage watchlists, and record identity verification.
          </p>
        </div>
        <PageWarningState
          title="Approval/identity workflows are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "VISITOR_APPROVALS_V1");
    await assertCompanyFeatureEnabled(context.companyId, "ID_HARDENING_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Approvals & Identity
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Configure policy-based approvals, manage watchlists, and record identity verification.
            </p>
          </div>
          <PageWarningState
            title="Approval/identity workflows are not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, templatesPage, policies, requests, watchlist, identityRecords] =
    await Promise.all([
      findAllSites(context.companyId),
      listTemplates(context.companyId, {}, { page: 1, pageSize: 100 }),
      listVisitorApprovalPolicies(context.companyId),
      listVisitorApprovalRequests(context.companyId),
      listVisitorWatchlistEntries(context.companyId),
      listIdentityVerificationRecords(context.companyId),
    ]);

  const templates = templatesPage.items;
  const nowTs = Date.now();

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Approval Queue & Identity Hardening
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Configure policy-based approvals, manage watchlists, and record identity verification.
        </p>
      </div>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Visitor Approval Policy
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await upsertApprovalPolicyAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
            Site
            <select name="siteId" className="input mt-1" required>
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Template (optional)
            <select name="templateId" className="input mt-1">
              <option value="">All templates</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Policy Name
            <input name="name" className="input mt-1" placeholder="Default Site Policy" required />
          </label>
          <label className="text-sm text-secondary">
            Random Check %
            <input
              name="randomCheckPercentage"
              type="number"
              min={0}
              max={100}
              defaultValue={10}
              className="input mt-1"
            />
          </label>
          <label className="md:col-span-2 text-sm text-secondary">
            Rules JSON (optional)
            <input
              name="rulesJson"
              className="input mt-1"
              placeholder='{"requireApprovalFor":["DELIVERY"],"afterHours":true}'
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input name="requireWatchlist" type="checkbox" defaultChecked className="h-4 w-4" />
            Require watchlist screening
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
            Active
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Save Policy
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Pending Approval Queue
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Visitor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Reason
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  SLA
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Decision
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-sm text-muted">
                    No approval requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      <div className="font-medium">{request.visitor_name}</div>
                      <div className="text-xs text-muted">
                        {request.visitor_phone || request.visitor_email || "No contact"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === request.site_id)?.name ?? "Site"}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${approvalStatusChipClass(request.status)}`}
                      >
                        {request.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{request.reason}</td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {(() => {
                        const queuedMinutes = Math.max(
                          0,
                          Math.floor((nowTs - request.requested_at.getTime()) / 60000),
                        );
                        const badgeClass =
                          queuedMinutes > 30
                            ? "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100"
                            : queuedMinutes > 15
                              ? "border-amber-400/45 bg-amber-500/15 text-amber-900 dark:text-amber-100"
                              : "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
                        return (
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
                            {queuedMinutes}m
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {request.status === "PENDING" ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <form
                            action={async (formData) => {
                              "use server";
                              await decideVisitorApprovalRequestAction(null, formData);
                            }}
                          >
                            <input type="hidden" name="approvalRequestId" value={request.id} />
                            <input type="hidden" name="status" value="APPROVED" />
                            <button
                              type="submit"
                              className="rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-2 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
                            >
                              Approve
                            </button>
                          </form>
                          <form
                            action={async (formData) => {
                              "use server";
                              await decideVisitorApprovalRequestAction(null, formData);
                            }}
                          >
                            <input type="hidden" name="approvalRequestId" value={request.id} />
                            <input type="hidden" name="status" value="DENIED" />
                            <button
                              type="submit"
                              className="rounded-lg border border-red-500/45 bg-red-500/12 px-2 py-1 text-xs font-semibold text-red-950 hover:bg-red-500/20 dark:text-red-100"
                            >
                              Deny
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Watchlist
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await addWatchlistEntryAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
            Full Name
            <input name="fullName" className="input mt-1" required />
          </label>
          <label className="text-sm text-secondary">
            Phone
            <input name="phone" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Email
            <input name="email" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Employer
            <input name="employerName" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Expires At
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-3 text-sm text-secondary">
            Reason
            <input
              name="reason"
              className="input mt-1"
              placeholder="Critical incident history / documentation concern"
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Add Watchlist Entry
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Person
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Contact
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Reason
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {watchlist.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                    No watchlist entries configured.
                  </td>
                </tr>
              ) : (
                watchlist.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">{entry.full_name}</td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {entry.phone || entry.email || "N/A"}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{entry.reason || "N/A"}</td>
                    <td className="px-3 py-3 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deactivateWatchlistEntryAction(entry.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="btn-secondary min-h-[30px] px-2 py-1 text-xs"
                        >
                          Deactivate
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Identity Verification Records
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createIdentityVerificationRecordAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
            Site
            <select name="siteId" className="input mt-1" required>
              <option value="">Select site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Approval Request ID (optional)
            <input name="approvalRequestId" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Sign-In Record ID (optional)
            <input name="signInRecordId" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Method
            <select name="method" className="input mt-1" defaultValue="MANUAL_ID">
              <option value="MANUAL_ID">MANUAL_ID</option>
              <option value="DOCUMENT_SCAN">DOCUMENT_SCAN</option>
              <option value="WATCHLIST_REVIEW">WATCHLIST_REVIEW</option>
              <option value="RANDOM_CHECK">RANDOM_CHECK</option>
            </select>
          </label>
          <label className="text-sm text-secondary">
            Result
            <select name="result" className="input mt-1" defaultValue="PASS">
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            </select>
          </label>
          <label className="text-sm text-secondary">
            Evidence Pointer
            <input name="evidencePointer" className="input mt-1" placeholder="s3://bucket/file.pdf" />
          </label>
          <label className="md:col-span-3 text-sm text-secondary">
            Notes
            <input name="notes" className="input mt-1" placeholder="Review outcome summary" />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Log Verification
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Method
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {identityRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                    No identity verification records yet.
                  </td>
                </tr>
              ) : (
                identityRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {record.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === record.site_id)?.name ?? "Site"}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{record.method}</td>
                    <td className="px-3 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${identityResultChipClass(record.result)}`}
                      >
                        {record.result}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Active Policies
        </h2>
        <ul className="mt-3 space-y-2">
          {policies.length === 0 ? (
            <li className="text-sm text-muted">No policies configured.</li>
          ) : (
            policies.map((policy) => (
              <li
                key={policy.id}
                className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-sm"
              >
                <div className="font-medium text-[color:var(--text-primary)]">{policy.name}</div>
                <div className="text-xs text-secondary">
                  Site: {sites.find((site) => site.id === policy.site_id)?.name ?? "Site"} |
                  Random checks: {policy.random_check_percentage}% |
                  Watchlist required: {policy.require_watchlist_screening ? "Yes" : "No"}
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
