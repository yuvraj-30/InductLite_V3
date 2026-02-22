import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository/site.repository";
import {
  listSiteEmergencyContacts,
  listSiteEmergencyProcedures,
} from "@/lib/repository/emergency.repository";
import {
  createEmergencyContactAction,
  createEmergencyProcedureAction,
  deactivateEmergencyContactAction,
  deactivateEmergencyProcedureAction,
} from "./actions";

interface SiteEmergencyPageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteEmergencyPage({ params }: SiteEmergencyPageProps) {
  const { id: siteId } = await params;

  const guard = await checkSitePermissionReadOnly("site:manage", siteId);
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) notFound();

  const [contacts, procedures] = await Promise.all([
    listSiteEmergencyContacts(context.companyId, siteId),
    listSiteEmergencyProcedures(context.companyId, siteId),
  ]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Setup</h1>
          <p className="mt-1 text-gray-600">
            {site.name}: maintain emergency contacts and procedures for inductions.
          </p>
        </div>
        <Link
          href={`/admin/sites/${siteId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Site
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">Emergency Contacts</h2>

          <form
            action={async (formData) => {
              "use server";
              await createEmergencyContactAction(siteId, null, formData);
            }}
            className="mt-4 space-y-3"
          >
            <input
              name="name"
              placeholder="Name"
              required
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="role"
              placeholder="Role (e.g. Site Manager)"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="phone"
              placeholder="Phone"
              required
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="email"
              placeholder="Email (optional)"
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="priority"
              type="number"
              min={0}
              max={100}
              defaultValue={0}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Contact
            </button>
          </form>

          <ul className="mt-4 divide-y divide-gray-200">
            {contacts.length === 0 ? (
              <li className="py-3 text-sm text-gray-500">No contacts configured yet.</li>
            ) : (
              contacts.map((contact) => (
                <li key={contact.id} className="flex items-start justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                    <p className="text-xs text-gray-500">
                      {contact.role || "Role not set"} - {contact.phone}
                    </p>
                  </div>
                  <form
                    action={async () => {
                      "use server";
                      await deactivateEmergencyContactAction(siteId, contact.id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="text-lg font-semibold text-gray-900">Emergency Procedures</h2>

          <form
            action={async (formData) => {
              "use server";
              await createEmergencyProcedureAction(siteId, null, formData);
            }}
            className="mt-4 space-y-3"
          >
            <input
              name="title"
              placeholder="Procedure title"
              required
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              name="instructions"
              placeholder="Procedure instructions"
              rows={4}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={200}
              defaultValue={0}
              className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add Procedure
            </button>
          </form>

          <ol className="mt-4 divide-y divide-gray-200">
            {procedures.length === 0 ? (
              <li className="py-3 text-sm text-gray-500">No procedures configured yet.</li>
            ) : (
              procedures.map((procedure) => (
                <li key={procedure.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{procedure.title}</p>
                      <p className="mt-1 text-xs text-gray-600">{procedure.instructions}</p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deactivateEmergencyProcedureAction(siteId, procedure.id);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}
