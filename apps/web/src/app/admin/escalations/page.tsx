import { redirect } from "next/navigation";
import { checkAuthReadOnly } from "@/lib/auth";
import {
  findAllSites,
  listSignInEscalations,
  type SignInEscalationRecord,
} from "@/lib/repository";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  approveSignInEscalationAction,
  denySignInEscalationAction,
} from "./actions";

export const metadata = {
  title: "Sign-In Escalations | InductLite",
};

function formatDateTime(value: Date): string {
  return value.toLocaleString("en-NZ", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PendingEscalationCard({
  escalation,
  siteName,
}: {
  escalation: SignInEscalationRecord;
  siteName: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            {escalation.visitor_name}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {siteName} | {escalation.visitor_type}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Submitted {formatDateTime(escalation.submitted_at)}
          </p>
          <p className="mt-2 text-xs text-gray-600">
            Ref: <span className="font-mono">{escalation.id.slice(0, 8)}</span>
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
          Pending Review
        </span>
      </div>

      <div className="mt-3 rounded-md border border-red-100 bg-red-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
          Triggered Red Flags
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
          {escalation.red_flag_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-gray-600">
        Notifications queued: {escalation.notifications_queued}/
        {escalation.notification_targets}
      </p>

      <form className="mt-3 space-y-3">
        <input type="hidden" name="escalationId" value={escalation.id} />
        <label className="block text-sm text-gray-700">
          Decision notes (optional)
          <textarea
            name="reviewNotes"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Record why this escalation is approved or denied"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            formAction={async (formData) => {
              "use server";
              await approveSignInEscalationAction(formData);
            }}
            className="min-h-[40px] rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Approve and Sign In
          </button>
          <button
            type="submit"
            formAction={async (formData) => {
              "use server";
              await denySignInEscalationAction(formData);
            }}
            className="min-h-[40px] rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Deny Entry
          </button>
        </div>
      </form>
    </div>
  );
}

export default async function SignInEscalationsPage() {
  const auth = await checkAuthReadOnly();
  if (!auth.success) {
    if (auth.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  if (auth.user.role !== "ADMIN" && auth.user.role !== "SITE_MANAGER") {
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const [sites, escalations] = await Promise.all([
    findAllSites(context.companyId),
    listSignInEscalations(context.companyId, { limit: 100 }),
  ]);

  const siteNames = new Map(sites.map((site) => [site.id, site.name]));
  const pending = escalations.filter((escalation) => escalation.status === "PENDING");
  const resolved = escalations.filter((escalation) => escalation.status !== "PENDING");

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sign-In Escalations</h1>
        <p className="mt-1 text-gray-600">
          Review blocked red-flag inductions and decide whether to approve entry.
        </p>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Pending</h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {pending.length} pending
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
            No pending escalations.
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((escalation) => (
              <PendingEscalationCard
                key={escalation.id}
                escalation={escalation}
                siteName={siteNames.get(escalation.site_id) ?? "Unknown site"}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Recent Decisions</h2>
        {resolved.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-600">
            No resolved escalations yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Visitor
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Decision
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Reviewed
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {resolved.map((escalation) => (
                  <tr key={escalation.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {escalation.visitor_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {siteNames.get(escalation.site_id) ?? "Unknown site"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          escalation.status === "APPROVED"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {escalation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {escalation.reviewed_at
                        ? formatDateTime(escalation.reviewed_at)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {escalation.review_notes || "-"}
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
