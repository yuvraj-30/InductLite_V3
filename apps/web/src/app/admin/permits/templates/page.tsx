import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import {
  listPermitTemplates,
  listPermitConditions,
} from "@/lib/repository/permit.repository";
import {
  createPermitTemplateAction,
  createPermitConditionAction,
} from "../actions";

export const metadata = {
  title: "Permit Templates | InductLite",
};

export default async function PermitTemplatesPage() {
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
          <h1 className="text-2xl font-bold text-gray-900">Permit Templates</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Permit workflows are not enabled for this plan (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const [sites, templates] = await Promise.all([
    findAllSites(context.companyId),
    listPermitTemplates(context.companyId),
  ]);

  const templateConditions = await Promise.all(
    templates.map(async (template) => ({
      template,
      conditions: await listPermitConditions(context.companyId, template.id),
    })),
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permit Template Builder</h1>
          <p className="mt-1 text-sm text-gray-600">
            Define hot work/confined space/excavation permit templates and condition sets.
          </p>
        </div>
        <Link
          href="/admin/permits"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Permits
        </Link>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          New Template
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
            <input name="permitType" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700">
            Template Name
            <input name="name" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700">
            Description
            <input name="description" className="input mt-1" />
          </label>
          <label className="col-span-full flex items-center gap-2 text-sm text-gray-700">
            <input name="requiredForSignIn" type="checkbox" className="h-4 w-4" />
            Require active permit for sign-in
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
          Add Condition
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
            <input name="title" className="input mt-1" required />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            Details
            <input name="details" className="input mt-1" />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input name="isRequired" type="checkbox" defaultChecked className="h-4 w-4" />
            Required
          </label>
          <label className="text-sm text-gray-700">
            Sort Order
            <input name="sortOrder" type="number" min={0} defaultValue={0} className="input mt-1" />
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

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Existing Templates
        </h2>
        <div className="mt-3 space-y-3">
          {templateConditions.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet.</p>
          ) : (
            templateConditions.map(({ template, conditions }) => (
              <article key={template.id} className="rounded-md border border-gray-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">
                    {template.name} <span className="text-xs text-gray-500">({template.permit_type})</span>
                  </h3>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                    {template.is_required_for_signin ? "Sign-in required" : "Optional"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{template.description || "No description"}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {conditions.length === 0 ? (
                    <li>No conditions yet.</li>
                  ) : (
                    conditions.map((condition) => (
                      <li key={condition.id}>
                        [{condition.stage}] {condition.title}
                        {!condition.is_required ? " (optional)" : ""}
                      </li>
                    ))
                  )}
                </ul>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
