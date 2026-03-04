import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository/site.repository";
import {
  listSiteEmergencyContacts,
  listSiteEmergencyProcedures,
  listEmergencyDrills,
  findActiveRollCallEvent,
  listRollCallAttendances,
  listRollCallEvents,
} from "@/lib/repository/emergency.repository";
import {
  createEmergencyContactAction,
  createEmergencyDrillAction,
  createEmergencyProcedureAction,
  deactivateEmergencyContactAction,
  deactivateEmergencyProcedureAction,
  startRollCallEventAction,
  updateRollCallAttendanceAction,
  markAllRollCallAttendancesAction,
  closeRollCallEventAction,
} from "./actions";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

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

  try {
    await assertCompanyFeatureEnabled(context.companyId, "ROLLCALL_V2", siteId);
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Emergency Setup</h1>
              <p className="mt-1 text-gray-600">
                {site.name}: manage roll-call features for this site.
              </p>
            </div>
            <Link
              href={`/admin/sites/${siteId}`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Back to Site
            </Link>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold text-amber-900">
              Feature not enabled for this site plan
            </h2>
            <p className="mt-1 text-sm text-amber-800">
              Emergency roll-call is disabled by entitlements (CONTROL_ID:
              PLAN-ENTITLEMENT-001).
            </p>
          </div>
        </div>
      );
    }

    throw error;
  }

  const [contacts, procedures, drills, activeRollCall, rollCallEvents] = await Promise.all([
    listSiteEmergencyContacts(context.companyId, siteId),
    listSiteEmergencyProcedures(context.companyId, siteId),
    listEmergencyDrills(context.companyId, siteId),
    findActiveRollCallEvent(context.companyId, siteId),
    listRollCallEvents(context.companyId, siteId),
  ]);
  const activeAttendances = activeRollCall
    ? await listRollCallAttendances(context.companyId, activeRollCall.id)
    : [];
  const closedRollCallEvents = rollCallEvents.filter((event) => event.status === "CLOSED");

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
              className="input"
            />
            <input
              name="role"
              placeholder="Role (e.g. Site Manager)"
              className="input"
            />
            <input
              name="phone"
              placeholder="Phone"
              required
              className="input"
            />
            <input
              name="email"
              placeholder="Email (optional)"
              className="input"
            />
            <input
              name="priority"
              type="number"
              min={0}
              max={100}
              defaultValue={0}
              className="input"
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
              className="input"
            />
            <textarea
              name="instructions"
              placeholder="Procedure instructions"
              rows={4}
              required
              className="input"
            />
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={200}
              defaultValue={0}
              className="input"
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

      <section className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Evacuation Roll Call</h2>
        <p className="mt-1 text-sm text-gray-600">
          Start a live roll call snapshot, mark attendance, then close and export evidence.
        </p>

        {!activeRollCall ? (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-700">
              No active roll call for this site.
            </p>
            <form
              action={async () => {
                "use server";
                await startRollCallEventAction(siteId);
              }}
              className="mt-3"
            >
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Start Evacuation Roll Call
              </button>
            </form>
          </div>
        ) : (
          <div className="mt-4 space-y-4 rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Active event started {activeRollCall.started_at.toLocaleString("en-NZ")}
                </p>
                <p className="text-xs text-amber-800">
                  Total: {activeRollCall.total_people} | Accounted: {activeRollCall.accounted_count} | Missing: {activeRollCall.missing_count}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`/api/rollcall/${activeRollCall.id}/export`}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Export Active CSV
                </a>
                <a
                  href={`/api/rollcall/${activeRollCall.id}/evidence`}
                  className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                >
                  Export Incident Evidence (JSON)
                </a>
              </div>
            </div>

            <form
              action={async () => {
                "use server";
                await markAllRollCallAttendancesAction(siteId, activeRollCall.id);
              }}
            >
              <button
                type="submit"
                className="min-h-[40px] rounded-md border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Mark All Accounted
              </button>
            </form>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-amber-200">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                      Visitor
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                      Status
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em] text-amber-900">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200 bg-white">
                  {activeAttendances.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-3 text-sm text-gray-500"
                      >
                        No people were on-site when this roll call started.
                      </td>
                    </tr>
                  ) : (
                    activeAttendances.map((attendance) => {
                      const nextStatus =
                        attendance.status === "ACCOUNTED" ? "MISSING" : "ACCOUNTED";
                      return (
                        <tr key={attendance.id}>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {attendance.visitor_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">
                            {attendance.visitor_type}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                attendance.status === "ACCOUNTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {attendance.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <form
                              action={async () => {
                                "use server";
                                await updateRollCallAttendanceAction(
                                  siteId,
                                  activeRollCall.id,
                                  attendance.id,
                                  nextStatus,
                                );
                              }}
                            >
                              <button
                                type="submit"
                                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Mark {nextStatus === "ACCOUNTED" ? "Accounted" : "Missing"}
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

            <form
              action={async (formData) => {
                "use server";
                await closeRollCallEventAction(siteId, null, formData);
              }}
              className="space-y-2"
            >
              <input type="hidden" name="eventId" value={activeRollCall.id} />
              <label className="block text-sm text-amber-900">
                Close notes (optional)
                <textarea
                  name="notes"
                  rows={2}
                  className="input mt-1"
                  placeholder="Summary of missing people, escalation, and follow-up."
                />
              </label>
              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Close Roll Call
              </button>
            </form>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
            Closed Roll Calls
          </h3>
          {closedRollCallEvents.length === 0 ? (
            <p className="py-3 text-sm text-gray-500">No closed roll calls yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Closed
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Export
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {closedRollCallEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {event.started_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {event.closed_at
                        ? event.closed_at.toLocaleString("en-NZ")
                        : "Open"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      Total {event.total_people} | Accounted {event.accounted_count} | Missing {event.missing_count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <a
                          href={`/api/rollcall/${event.id}/export`}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          CSV
                        </a>
                        <a
                          href={`/api/rollcall/${event.id}/evidence`}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Evidence JSON
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Emergency Drill Register</h2>
        <p className="mt-1 text-sm text-gray-600">
          Record emergency plan tests and outcomes for compliance evidence.
        </p>

        <form
          action={async (formData) => {
            "use server";
            await createEmergencyDrillAction(siteId, null, formData);
          }}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <label className="text-sm text-gray-700">
            Drill Type
            <select
              name="drillType"
              defaultValue="EVACUATION"
              className="input mt-1"
            >
              <option value="EVACUATION">Evacuation</option>
              <option value="FIRE">Fire</option>
              <option value="EARTHQUAKE">Earthquake</option>
              <option value="MEDICAL">Medical</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label className="text-sm text-gray-700">
            Conducted At
            <input
              name="conductedAt"
              type="datetime-local"
              className="input mt-1"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Scenario
            <textarea
              name="scenario"
              rows={3}
              required
              className="input mt-1"
              placeholder="What was tested and under which conditions?"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Outcome Notes
            <textarea
              name="outcomeNotes"
              rows={2}
              className="input mt-1"
              placeholder="What went well, what failed"
            />
          </label>

          <label className="text-sm text-gray-700 md:col-span-2">
            Follow-up Actions
            <textarea
              name="followUpActions"
              rows={2}
              className="input mt-1"
              placeholder="Required corrective actions and owners"
            />
          </label>

          <label className="text-sm text-gray-700">
            Next Due At (optional)
            <input
              name="nextDueAt"
              type="datetime-local"
              className="input mt-1"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="legalHold"
              type="checkbox"
              value="true"
              className="h-4 w-4 rounded border-gray-300"
            />
            Apply legal hold
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Log Drill
            </button>
          </div>
        </form>

        <div className="mt-4 overflow-x-auto">
          {drills.length === 0 ? (
            <p className="py-3 text-sm text-gray-500">No drills logged yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Conducted
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Scenario
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Next Due
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {drills.map((drill) => (
                  <tr key={drill.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {drill.conducted_at.toLocaleString("en-NZ")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {drill.drill_type}
                      {drill.legal_hold ? " | Legal hold" : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{drill.scenario}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {drill.next_due_at
                        ? drill.next_due_at.toLocaleString("en-NZ")
                        : "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
