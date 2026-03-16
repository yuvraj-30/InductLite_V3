import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
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
import { InlineCopilotPanel } from "../components/inline-copilot-panel";
import { listContractors } from "@/lib/repository/contractor.repository";
import { listUsers } from "@/lib/repository/user.repository";
import {
  listPermitTemplates,
  listPermitConditions,
  listPermitRequests,
  listContractorPrequalifications,
} from "@/lib/repository/permit.repository";
import {
  createPermitTemplateAction,
  createPermitConditionAction,
  createPermitRequestAction,
  transitionPermitRequestAction,
  upsertContractorPrequalificationAction,
} from "./actions";

export const metadata = {
  title: "Permits | InductLite",
};

function permitRequestTone(status: string): StatusBadgeTone {
  if (status === "APPROVED" || status === "ACTIVE") return "success";
  if (status === "DENIED") return "danger";
  if (status === "SUSPENDED") return "warning";
  if (status === "CLOSED") return "neutral";
  return "accent";
}

function prequalificationTone(status: string): StatusBadgeTone {
  if (status === "APPROVED") return "success";
  if (status === "DENIED" || status === "EXPIRED") return "danger";
  return "warning";
}

export default async function PermitsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  if (!isFeatureEnabled("PERMITS_V1")) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Permit-to-Work
          </h1>
          <p className="mt-1 text-sm text-secondary">
            Manage permit templates, issuance lifecycle, and contractor prequalification.
          </p>
        </div>
        <PageWarningState
          title="Permit workflows are disabled by rollout flag."
          description="CONTROL_ID: FLAG-ROLLOUT-001."
        />
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PERMITS_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="space-y-6 p-3 sm:p-4">
          <div className="surface-panel-strong p-5">
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Permit-to-Work
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Manage permit templates, issuance lifecycle, and contractor prequalification.
            </p>
          </div>
          <PageWarningState
            title="Permit workflows are not enabled for this plan."
            description="CONTROL_ID: PLAN-ENTITLEMENT-001."
          />
        </div>
      );
    }
    throw error;
  }

  const [sites, templates, requests, contractorsPage, usersPage, prequals] =
    await Promise.all([
      findAllSites(context.companyId),
      listPermitTemplates(context.companyId),
      listPermitRequests(context.companyId),
      listContractors(
        context.companyId,
        { isActive: true },
        { page: 1, pageSize: 200 },
      ),
      listUsers(context.companyId, { isActive: true }, { page: 1, pageSize: 100 }),
      listContractorPrequalifications(context.companyId),
    ]);

  const contractors = contractorsPage.items;
  const users = usersPage.items;

  const templateConditions = await Promise.all(
    templates.slice(0, 10).map(async (template) => ({
      templateId: template.id,
      conditions: await listPermitConditions(context.companyId, template.id),
    })),
  );
  const conditionsByTemplate = new Map(
    templateConditions.map((entry) => [entry.templateId, entry.conditions]),
  );
  const now = new Date();
  const requestedPermitCount = requests.filter((request) => request.status === "REQUESTED").length;
  const activePermitCount = requests.filter(
    (request) => request.status === "APPROVED" || request.status === "ACTIVE",
  ).length;
  const suspendedPermitCount = requests.filter(
    (request) => request.status === "SUSPENDED",
  ).length;
  const overduePermitCount = requests.filter(
    (request) =>
      request.status !== "CLOSED" &&
      request.status !== "DENIED" &&
      request.validity_end &&
      request.validity_end.getTime() < now.getTime(),
  ).length;
  const prequalAtRiskCount = prequals.filter(
    (prequal) =>
      prequal.status !== "APPROVED" ||
      (prequal.expires_at ? prequal.expires_at.getTime() < now.getTime() : false),
  ).length;

  return (
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
          <div>
            <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
              Permit-to-Work
            </h1>
            <p className="mt-1 text-sm text-secondary">
              Keep permit decisions, validity windows, and contractor readiness in one operational queue.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-indigo-950 dark:text-indigo-100">
                  Requested
                </p>
                <p className="mt-2 text-3xl font-black text-indigo-950 dark:text-indigo-100">
                  {requestedPermitCount}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-emerald-950 dark:text-emerald-100">
                  Active
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-900 dark:text-emerald-100">
                  {activePermitCount}
                </p>
              </div>
              <div className="rounded-xl border border-red-400/35 bg-red-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-red-950 dark:text-red-100">
                  Overdue
                </p>
                <p className="mt-2 text-3xl font-black text-red-950 dark:text-red-100">
                  {overduePermitCount}
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/35 bg-amber-500/12 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-900 dark:text-amber-100">
                  Prequal risk
                </p>
                <p className="mt-2 text-3xl font-black text-amber-900 dark:text-amber-100">
                  {prequalAtRiskCount}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/admin/permits/templates"
              className="btn-secondary"
            >
              Template Builder
            </Link>
            <div className="rounded-[1.25rem] border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                Next actions
              </p>
              <ul className="mt-3 space-y-2 text-sm text-secondary">
                <li>{requestedPermitCount} permits are waiting for an approval decision.</li>
                <li>{suspendedPermitCount} permits are suspended and need a recovery or closure action.</li>
                <li>{overduePermitCount} permits have expired validity windows and should be closed or renewed.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <InlineCopilotPanel
        companyId={context.companyId}
        prompt="Where are the biggest permit and prequalification bottlenecks right now, and what should we action first?"
        title="Permit Workflow Copilot"
      />

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Create Permit Template
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitTemplateAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-secondary">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Permit Type
            <input name="permitType" className="input mt-1" placeholder="Hot work" required />
          </label>
          <label className="text-sm text-secondary">
            Template Name
            <input name="name" className="input mt-1" placeholder="Hot Work Permit" required />
          </label>
          <label className="text-sm text-secondary">
            Description
            <input
              name="description"
              className="input mt-1"
              placeholder="Scope and approval notes"
            />
          </label>
          <label className="col-span-full flex items-center gap-2 text-sm text-secondary">
            <input name="requiredForSignIn" type="checkbox" className="h-4 w-4" />
            Require active permit before sign-in for this template/site.
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="btn-primary"
            >
              Create Template
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Permit Request
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitRequestAction(null, formData);
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
            Permit Template
            <select name="permitTemplateId" className="input mt-1" required>
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Contractor (optional)
            <select name="contractorId" className="input mt-1">
              <option value="">None</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Visitor Name
            <input name="visitorName" className="input mt-1" placeholder="Worker full name" />
          </label>
          <label className="text-sm text-secondary">
            Visitor Phone
            <input name="visitorPhone" className="input mt-1" placeholder="+64..." />
          </label>
          <label className="text-sm text-secondary">
            Visitor Email
            <input name="visitorEmail" className="input mt-1" placeholder="worker@company.nz" />
          </label>
          <label className="text-sm text-secondary">
            Employer
            <input name="employerName" className="input mt-1" placeholder="Employer name" />
          </label>
          <label className="text-sm text-secondary">
            Assignee
            <select name="assigneeUserId" className="input mt-1">
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Valid From
            <input name="validityStart" type="datetime-local" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Valid To
            <input name="validityEnd" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-2 text-sm text-secondary">
            Notes
            <input name="notes" className="input mt-1" placeholder="Permit notes" />
          </label>
          <div>
            <button
              type="submit"
              className="btn-primary mt-6"
            >
              Submit Request
            </button>
          </div>
        </form>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Active Templates
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Template
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Required at Sign-In
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Conditions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                    No permit templates yet.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">{template.name}</td>
                    <td className="px-3 py-3 text-sm text-secondary">{template.permit_type}</td>
                    <td className="px-3 py-3 text-sm">
                      <StatusBadge tone={template.is_required_for_signin ? "warning" : "success"}>
                        {template.is_required_for_signin ? "Required" : "Optional"}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {(conditionsByTemplate.get(template.id) ?? []).length}
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
          Permit Lifecycle
        </h2>
        <DataTableShell className="mt-3">
          <DataTableScroll>
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHeadCell>Request</DataTableHeadCell>
                  <DataTableHeadCell>Site</DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                  <DataTableHeadCell>Validity</DataTableHeadCell>
                  <DataTableHeadCell>Next action</DataTableHeadCell>
                  <DataTableHeadCell className="text-right">Actions</DataTableHeadCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {requests.length === 0 ? (
                  <DataTableEmptyRow colSpan={6}>
                    No permit requests yet.
                  </DataTableEmptyRow>
                ) : (
                  requests.map((request) => {
                    const siteName =
                      sites.find((site) => site.id === request.site_id)?.name ?? "Site";
                    const isOverdue =
                      request.status !== "CLOSED" &&
                      request.status !== "DENIED" &&
                      request.validity_end &&
                      request.validity_end.getTime() < now.getTime();
                    const nextAction = isOverdue
                      ? "Renew or close expired permit"
                      : request.status === "REQUESTED"
                        ? "Supervisor approval required"
                        : request.status === "APPROVED"
                          ? "Activate when work starts"
                          : request.status === "SUSPENDED"
                            ? "Resolve hold point or close"
                            : request.status === "ACTIVE"
                              ? "Monitor and close at completion"
                              : "No further action";

                    return (
                      <DataTableRow key={request.id}>
                        <DataTableCell>
                          <div className="font-medium text-[color:var(--text-primary)]">
                            {request.visitor_name || request.visitor_phone || request.id.slice(0, 8)}
                          </div>
                          <div className="text-xs text-muted">
                            {request.employer_name || "No employer"} |{" "}
                            {request.notes || "No permit notes"}
                          </div>
                        </DataTableCell>
                        <DataTableCell>{siteName}</DataTableCell>
                        <DataTableCell>
                          <StatusBadge tone={isOverdue ? "danger" : permitRequestTone(request.status)}>
                            {request.status}
                          </StatusBadge>
                        </DataTableCell>
                        <DataTableCell>
                          {request.validity_end ? (
                            <div>
                              <div>{request.validity_end.toLocaleDateString("en-NZ")}</div>
                              <div className="text-xs text-muted">
                                {request.validity_end.toLocaleTimeString("en-NZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted">Open-ended</span>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <p className="text-sm text-secondary">{nextAction}</p>
                        </DataTableCell>
                        <DataTableCell className="text-right">
                          <form
                            action={async (formData) => {
                              "use server";
                              const status = formData.get("status");
                              const notes = formData.get("notes");
                              if (typeof status !== "string") return;
                              await transitionPermitRequestAction(
                                request.id,
                                status as
                                  | "DRAFT"
                                  | "REQUESTED"
                                  | "APPROVED"
                                  | "ACTIVE"
                                  | "SUSPENDED"
                                  | "CLOSED"
                                  | "DENIED",
                                typeof notes === "string" ? notes : undefined,
                              );
                            }}
                            className="ml-auto grid max-w-md gap-2"
                          >
                            <input
                              name="notes"
                              className="input min-w-[14rem]"
                              placeholder="Decision note (optional)"
                            />
                            <div className="flex flex-wrap justify-end gap-2">
                              {request.status !== "APPROVED" && request.status !== "ACTIVE" ? (
                                <button
                                  type="submit"
                                  name="status"
                                  value="APPROVED"
                                  className="rounded-lg border border-indigo-400/45 bg-indigo-500/12 px-3 py-2 text-xs font-semibold text-indigo-950 hover:bg-indigo-500/20 dark:text-indigo-100"
                                >
                                  Approve
                                </button>
                              ) : null}
                              {request.status !== "ACTIVE" && request.status !== "CLOSED" ? (
                                <button
                                  type="submit"
                                  name="status"
                                  value="ACTIVE"
                                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-100"
                                >
                                  Activate
                                </button>
                              ) : null}
                              {request.status !== "SUSPENDED" && request.status !== "CLOSED" ? (
                                <button
                                  type="submit"
                                  name="status"
                                  value="SUSPENDED"
                                  className="rounded-lg border border-amber-400/45 bg-amber-500/12 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-500/20 dark:text-amber-100"
                                >
                                  Suspend
                                </button>
                              ) : null}
                              {request.status !== "CLOSED" ? (
                                <button
                                  type="submit"
                                  name="status"
                                  value="CLOSED"
                                  className="btn-secondary min-h-[30px] px-3 py-2 text-xs"
                                >
                                  Close
                                </button>
                              ) : null}
                            </div>
                          </form>
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
          Contractor Prequalification
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await upsertContractorPrequalificationAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-secondary">
            Contractor
            <select name="contractorId" className="input mt-1" required>
              <option value="">Select contractor</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Site (optional)
            <select name="siteId" className="input mt-1">
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Status
            <select name="status" className="input mt-1" defaultValue="PENDING">
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="DENIED">DENIED</option>
            </select>
          </label>
          <label className="text-sm text-secondary">
            Score (0-100)
            <input name="score" type="number" min={0} max={100} defaultValue={70} className="input mt-1" />
          </label>
          <label className="text-sm text-secondary">
            Expires At
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Checklist JSON (optional)
            <input
              name="checklistJson"
              className="input mt-1"
              placeholder='{"licenses":true,"insurance":true}'
            />
          </label>
          <label className="text-sm text-secondary md:col-span-3">
            Evidence JSON (optional)
            <input
              name="evidenceJson"
              className="input mt-1"
              placeholder='{"docs":["cert-1.pdf","insurance-2026.pdf"]}'
            />
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Save Prequalification
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
            <thead className="bg-[color:var(--bg-surface-strong)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Contractor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-secondary">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
              {prequals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-muted">
                    No prequalification records yet.
                  </td>
                </tr>
              ) : (
                prequals.map((prequal) => (
                  <tr key={prequal.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-3 py-3 text-sm text-secondary">
                      {contractors.find((contractor) => contractor.id === prequal.contractor_id)
                        ?.name ?? prequal.contractor_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">
                      {sites.find((site) => site.id === prequal.site_id)?.name ?? "All sites"}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <StatusBadge tone={prequalificationTone(prequal.status)}>
                        {prequal.status}
                      </StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-sm text-secondary">{prequal.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-panel p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Add Permit Condition
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitConditionAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-secondary">
            Template
            <select name="permitTemplateId" className="input mt-1" required>
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-secondary">
            Stage
            <input name="stage" className="input mt-1" placeholder="pre-start" required />
          </label>
          <label className="text-sm text-secondary">
            Condition Type
            <input name="conditionType" className="input mt-1" placeholder="hold-point" required />
          </label>
          <label className="text-sm text-secondary">
            Title
            <input name="title" className="input mt-1" placeholder="Gas monitoring in place" required />
          </label>
          <label className="text-sm text-secondary md:col-span-2">
            Details
            <input name="details" className="input mt-1" placeholder="Optional context" />
          </label>
          <label className="flex items-center gap-2 text-sm text-secondary">
            <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4" />
            Required
          </label>
          <label className="text-sm text-secondary">
            Sort Order
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={1000}
              defaultValue={0}
              className="input mt-1"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="btn-primary"
            >
              Add Condition
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
