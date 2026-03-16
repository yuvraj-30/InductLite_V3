import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { listTemplates } from "@/lib/repository/template.repository";
import { PageWarningState } from "@/components/ui/page-state";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  DataTableScroll,
  DataTableShell,
} from "@/components/ui/data-table";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
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

function approvalStatusTone(status: string): StatusBadgeTone {
  if (status === "APPROVED") return "success";
  if (status === "DENIED") return "danger";
  return "warning";
}

function identityResultTone(result: string): StatusBadgeTone {
  if (result === "PASS") return "success";
  if (result === "FAIL") return "danger";
  return "warning";
}

function queueAgeTone(minutes: number): StatusBadgeTone {
  if (minutes > 30) return "danger";
  if (minutes > 15) return "warning";
  return "success";
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
  const pendingRequests = requests.filter((request) => request.status === "PENDING");
  const watchlistPendingCount = pendingRequests.filter(
    (request) => request.watchlist_match,
  ).length;
  const randomCheckPendingCount = pendingRequests.filter(
    (request) => request.random_check_triggered,
  ).length;
  const averageQueueMinutes =
    pendingRequests.length > 0
      ? Math.round(
          pendingRequests.reduce((acc, request) => {
            return (
              acc +
              Math.max(
                0,
                Math.floor((nowTs - request.requested_at.getTime()) / 60000),
              )
            );
          }, 0) / pendingRequests.length,
        )
      : 0;
  const needsReviewIdentityCount = identityRecords.filter(
    (record) => record.result === "NEEDS_REVIEW",
  ).length;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Approval Queue & Identity Hardening
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Review blocked visitors quickly, document the decision, and keep identity
              evidence tied to the same operational record.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
                  Pending queue
                </p>
                <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
                  {pendingRequests.length}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Average wait {averageQueueMinutes}m.
                </p>
              </div>
              <div className="rounded-xl border border-red-400/35 bg-red-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
                  Watchlist / review
                </p>
                <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">
                  {watchlistPendingCount + needsReviewIdentityCount}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  {watchlistPendingCount} watchlist hits and {needsReviewIdentityCount} ID reviews.
                </p>
              </div>
              <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-950 dark:text-indigo-100">
                  Random checks
                </p>
                <p className="mt-2 text-3xl font-black text-indigo-950 dark:text-indigo-100">
                  {randomCheckPendingCount}
                </p>
                <p className="mt-1 text-xs text-secondary">
                  Visitors routed into manual verification by policy.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
              Decision cadence
            </p>
            <ul className="mt-3 space-y-3 text-sm text-secondary">
              <li className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-3">
                Approve when the visitor, site, and evidence line up and there is no open watchlist concern.
              </li>
              <li className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-3">
                Deny when the risk is confirmed or the evidence is incomplete for site policy.
              </li>
              <li className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-3">
                Leave clear decision notes so later audits explain why entry was blocked or cleared.
              </li>
            </ul>
          </div>
        </div>
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
              Pending Approval Queue
            </h2>
            <p className="mt-1 text-sm text-secondary">
              Each decision stays on the same record so the later audit trail explains who cleared or blocked entry.
            </p>
          </div>
          <StatusBadge tone={pendingRequests.length > 0 ? "warning" : "success"}>
            {pendingRequests.length > 0 ? `${pendingRequests.length} open decisions` : "Queue clear"}
          </StatusBadge>
        </div>

        <DataTableShell className="mt-4">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Visitor</DataTableHeadCell>
                  <DataTableHeadCell>Trigger</DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                  <DataTableHeadCell>Queue Age</DataTableHeadCell>
                  <DataTableHeadCell>Decision Context</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Decision</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {requests.length === 0 ? (
                  <DataTableEmptyRow colSpan={6}>
                    No approval requests yet.
                  </DataTableEmptyRow>
                ) : (
                  requests.map((request) => {
                    const queuedMinutes = Math.max(
                      0,
                      Math.floor((nowTs - request.requested_at.getTime()) / 60000),
                    );

                    return (
                      <DataTableRow key={request.id}>
                        <DataTableCell>
                          <div className="font-medium text-[color:var(--text-primary)]">
                            {request.visitor_name}
                          </div>
                          <div className="text-xs text-muted">
                            {sites.find((site) => site.id === request.site_id)?.name ?? "Site"} |{" "}
                            {request.visitor_phone || request.visitor_email || "No contact"}
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-wrap gap-2">
                            {request.watchlist_match ? (
                              <StatusBadge tone="danger">Watchlist</StatusBadge>
                            ) : null}
                            {request.random_check_triggered ? (
                              <StatusBadge tone="accent">Random check</StatusBadge>
                            ) : null}
                            {!request.watchlist_match && !request.random_check_triggered ? (
                              <StatusBadge tone="neutral">Policy review</StatusBadge>
                            ) : null}
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <StatusBadge tone={approvalStatusTone(request.status)}>
                            {request.status}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>
                          <StatusBadge tone={queueAgeTone(queuedMinutes)}>
                            {queuedMinutes}m
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>
                          <p className="text-sm text-secondary">{request.reason}</p>
                          {request.decision_notes ? (
                            <p className="mt-1 text-xs text-muted">
                              Last note: {request.decision_notes}
                            </p>
                          ) : null}
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          {request.status === "PENDING" ? (
                            <form
                              action={async (formData) => {
                                "use server";
                                await decideVisitorApprovalRequestAction(null, formData);
                              }}
                              className="ml-auto grid max-w-md gap-2"
                            >
                              <input type="hidden" name="approvalRequestId" value={request.id} />
                              <input
                                name="decisionNotes"
                                className="input min-w-[14rem]"
                                placeholder="Decision notes for the audit trail"
                              />
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="submit"
                                  name="status"
                                  value="APPROVED"
                                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
                                >
                                  Approve
                                </button>
                                <button
                                  type="submit"
                                  name="status"
                                  value="DENIED"
                                  className="rounded-lg border border-red-500/45 bg-red-500/12 px-3 py-2 text-xs font-semibold text-red-950 hover:bg-red-500/20 dark:text-red-100"
                                >
                                  Deny
                                </button>
                              </div>
                            </form>
                          ) : (
                            <span className="text-xs text-muted">Finalized</span>
                          )}
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
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

        <DataTableShell className="mt-4">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Person</DataTableHeadCell>
                  <DataTableHeadCell>Contact</DataTableHeadCell>
                  <DataTableHeadCell>Reason</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Action</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {watchlist.length === 0 ? (
                  <DataTableEmptyRow colSpan={4}>
                    No watchlist entries configured.
                  </DataTableEmptyRow>
                ) : (
                  watchlist.map((entry) => (
                    <DataTableRow key={entry.id}>
                      <DataTableCell className="font-medium text-[color:var(--text-primary)]">
                        {entry.full_name}
                      </DataTableCell>
                      <DataTableCell>{entry.phone || entry.email || "N/A"}</DataTableCell>
                      <DataTableCell>{entry.reason || "N/A"}</DataTableCell>
                      <DataTableCell className="text-right">
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
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
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

        <DataTableShell className="mt-4">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Timestamp</DataTableHeadCell>
                  <DataTableHeadCell>Site</DataTableHeadCell>
                  <DataTableHeadCell>Method</DataTableHeadCell>
                  <DataTableHeadCell>Result</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {identityRecords.length === 0 ? (
                  <DataTableEmptyRow colSpan={4}>
                    No identity verification records yet.
                  </DataTableEmptyRow>
                ) : (
                  identityRecords.map((record) => (
                    <DataTableRow key={record.id}>
                      <DataTableCell>{record.created_at.toLocaleString("en-NZ")}</DataTableCell>
                      <DataTableCell>
                        {sites.find((site) => site.id === record.site_id)?.name ?? "Site"}
                      </DataTableCell>
                      <DataTableCell>{record.method}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={identityResultTone(record.result)}>
                          {record.result}
                        </StatusBadge>
                      </DataTableCell>
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </DataTable>
          </DataTableScroll>
        </DataTableShell>
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
