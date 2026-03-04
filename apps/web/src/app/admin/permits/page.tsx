import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
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

export default async function PermitsPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PERMITS_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Permit-to-Work</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Permit workflows are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
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

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permit-to-Work</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage permit templates, issuance lifecycle, and contractor prequalification.
          </p>
        </div>
        <Link
          href="/admin/permits/templates"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Template Builder
        </Link>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Create Permit Template
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitTemplateAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Permit Type
            <input name="permitType" className="input mt-1" placeholder="Hot work" required />
          </label>
          <label className="text-sm text-gray-700">
            Template Name
            <input name="name" className="input mt-1" placeholder="Hot Work Permit" required />
          </label>
          <label className="text-sm text-gray-700">
            Description
            <input
              name="description"
              className="input mt-1"
              placeholder="Scope and approval notes"
            />
          </label>
          <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
            <input name="requiredForSignIn" type="checkbox" className="h-4 w-4" />
            Require active permit before sign-in for this template/site.
          </label>
          <div className="col-span-full">
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Create Template
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Permit Request
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitRequestAction(null, formData);
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
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Visitor Name
            <input name="visitorName" className="input mt-1" placeholder="Worker full name" />
          </label>
          <label className="text-sm text-gray-700">
            Visitor Phone
            <input name="visitorPhone" className="input mt-1" placeholder="+64..." />
          </label>
          <label className="text-sm text-gray-700">
            Visitor Email
            <input name="visitorEmail" className="input mt-1" placeholder="worker@company.nz" />
          </label>
          <label className="text-sm text-gray-700">
            Employer
            <input name="employerName" className="input mt-1" placeholder="Employer name" />
          </label>
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Valid From
            <input name="validityStart" type="datetime-local" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Valid To
            <input name="validityEnd" type="datetime-local" className="input mt-1" />
          </label>
          <label className="md:col-span-2 text-sm text-gray-700">
            Notes
            <input name="notes" className="input mt-1" placeholder="Permit notes" />
          </label>
          <div>
            <button
              type="submit"
              className="mt-6 min-h-[40px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Submit Request
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Active Templates
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Template
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Required at Sign-In
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Conditions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No permit templates yet.
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">{template.name}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{template.permit_type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {template.is_required_for_signin ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {(conditionsByTemplate.get(template.id) ?? []).length}
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
          Permit Lifecycle
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Request
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No permit requests yet.
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {request.visitor_name || request.visitor_phone || request.id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === request.site_id)?.name ?? "Site"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{request.status}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {request.status !== "APPROVED" && request.status !== "ACTIVE" && (
                          <form
                            action={async () => {
                              "use server";
                              await transitionPermitRequestAction(request.id, "APPROVED");
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Approve
                            </button>
                          </form>
                        )}
                        {request.status !== "ACTIVE" && request.status !== "CLOSED" && (
                          <form
                            action={async () => {
                              "use server";
                              await transitionPermitRequestAction(request.id, "ACTIVE");
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Activate
                            </button>
                          </form>
                        )}
                        {request.status !== "CLOSED" && (
                          <form
                            action={async () => {
                              "use server";
                              await transitionPermitRequestAction(request.id, "CLOSED");
                            }}
                          >
                            <button
                              type="submit"
                              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Close
                            </button>
                          </form>
                        )}
                      </div>
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
          Contractor Prequalification
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await upsertContractorPrequalificationAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-3"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Status
            <select name="status" className="input mt-1" defaultValue="PENDING">
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="DENIED">DENIED</option>
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Score (0-100)
            <input name="score" type="number" min={0} max={100} defaultValue={70} className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            Expires At
            <input name="expiresAt" type="datetime-local" className="input mt-1" />
          </label>
          <label className="text-sm text-gray-700 md:col-span-3">
            Checklist JSON (optional)
            <input
              name="checklistJson"
              className="input mt-1"
              placeholder='{"licenses":true,"insurance":true}'
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-3">
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
              className="min-h-[40px] rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              Save Prequalification
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Contractor
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Site
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {prequals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-sm text-gray-500">
                    No prequalification records yet.
                  </td>
                </tr>
              ) : (
                prequals.map((prequal) => (
                  <tr key={prequal.id}>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {contractors.find((contractor) => contractor.id === prequal.contractor_id)
                        ?.name ?? prequal.contractor_id.slice(0, 8)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {sites.find((site) => site.id === prequal.site_id)?.name ?? "All sites"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{prequal.status}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{prequal.score}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Add Permit Condition
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await createPermitConditionAction(null, formData);
          }}
          className="mt-3 grid gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
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
          <label className="text-sm text-gray-700">
            Stage
            <input name="stage" className="input mt-1" placeholder="pre-start" required />
          </label>
          <label className="text-sm text-gray-700">
            Condition Type
            <input name="conditionType" className="input mt-1" placeholder="hold-point" required />
          </label>
          <label className="text-sm text-gray-700">
            Title
            <input name="title" className="input mt-1" placeholder="Gas monitoring in place" required />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Details
            <input name="details" className="input mt-1" placeholder="Optional context" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4" />
            Required
          </label>
          <label className="text-sm text-gray-700">
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
              className="min-h-[40px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Add Condition
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
