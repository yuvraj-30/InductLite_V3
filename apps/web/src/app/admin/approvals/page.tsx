import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { listTemplates } from "@/lib/repository/template.repository";
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

export default async function ApprovalsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    await assertCompanyFeatureEnabled(context.companyId, "VISITOR_APPROVALS_V1");
    await assertCompanyFeatureEnabled(context.companyId, "ID_HARDENING_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Approvals & Identity</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Approval/identity workflows are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
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

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approval Queue & Identity Hardening</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure policy-based approvals, manage watchlists, and record identity verification.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Visitor Approval Policy
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await upsertApprovalPolicyAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Policy Name
            <input name="name" className="input mt-1" placeholder="Default Site Policy" required />
          </label>
          <label className="text-sm text-gray-700">
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
          <label className="md:col-span-2 text-sm text-gray-700">
            Rules JSON (optional)
            <input
              name="rulesJson"
              className="input mt-1"
              placeholder='{"requireApprovalFor":["DELIVERY"],"afterHours":true}'
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="requireWatchlist" type="checkbox" defaultChecked className="h-4 w-4" />
            Require watchlist screening
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4" />
            Active
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save Policy
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Pending Approval Queue
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Visitor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Reason
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Decision
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-sm text-gray-500">
                    No approval requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div className="font-medium">{request.visitor_name}</div>
                      <div className="text-xs text-gray-500">
                        {request.visitor_phone || request.visitor_email || "No contact"}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === request.site_id)?.name ?? "Site"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{request.status}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{request.reason}</td>
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
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
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
                              className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                            >
                              Deny
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Watchlist
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await addWatchlistEntryAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
            Full Name
            <input name="fullName" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700">
            Phone
            <input name="phone" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Email
            <input name="email" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Employer
            <input name="employerName" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Expires At
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
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
              className="min-h-[40px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Add Watchlist Entry
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Person
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Contact
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Reason
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {watchlist.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No watchlist entries configured.
                  </td>
                </tr>
              ) : (
                watchlist.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">{entry.full_name}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {entry.phone || entry.email || "N/A"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{entry.reason || "N/A"}</td>
                    <td className="px-3 py-3 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await deactivateWatchlistEntryAction(entry.id);
                        }}
                      >
                        <button
                          type="submit"
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Identity Verification Records
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createIdentityVerificationRecordAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Approval Request ID (optional)
            <input name="approvalRequestId" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Sign-In Record ID (optional)
            <input name="signInRecordId" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Method
            <select name="method" className="input mt-1" defaultValue="MANUAL_ID">
              <option value="MANUAL_ID">MANUAL_ID</option>
              <option value="DOCUMENT_SCAN">DOCUMENT_SCAN</option>
              <option value="WATCHLIST_REVIEW">WATCHLIST_REVIEW</option>
              <option value="RANDOM_CHECK">RANDOM_CHECK</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Result
            <select name="result" className="input mt-1" defaultValue="PASS">
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Evidence Pointer
            <input name="evidencePointer" className="input mt-1" placeholder="s3://bucket/file.pdf" />
          </label>
          <label className="md:col-span-3 text-sm text-gray-700">
            Notes
            <input name="notes" className="input mt-1" placeholder="Review outcome summary" />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Log Verification
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Timestamp
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Method
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {identityRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No identity verification records yet.
                  </td>
                </tr>
              ) : (
                identityRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {record.created_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === record.site_id)?.name ?? "Site"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{record.method}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{record.result}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Active Policies
        </h2>
        <ul className="mt-3 space-y-2">
          {policies.length === 0 ? (
            <li className="text-sm text-gray-500">No policies configured.</li>
          ) : (
            policies.map((policy) => (
              <li key={policy.id} className="rounded border border-gray-200 px-3 py-2 text-sm">
                <div className="font-medium text-gray-900">{policy.name}</div>
                <div className="text-xs text-gray-600">
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
