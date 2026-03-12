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

function escalationStatusChipClass(status: SignInEscalationRecord["status"]): string {
  if (status === "APPROVED") {
    return "border-emerald-400/35 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100";
  }
  return "border-red-500/45 bg-red-500/15 text-red-950 dark:text-red-100";
}

function PendingEscalationCard({
  escalation,
  siteName,
}: {
  escalation: SignInEscalationRecord;
  siteName: string;
}) {
  return (
    <div className="surface-panel border-amber-400/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
            {escalation.visitor_name}
          </h3>
          <p className="mt-1 text-sm text-secondary">
            {siteName} | {escalation.visitor_type}
          </p>
          <p className="mt-1 text-xs text-muted">
            Submitted {formatDateTime(escalation.submitted_at)}
          </p>
          <p className="mt-2 text-xs text-secondary">
            Ref: <span className="font-mono">{escalation.id.slice(0, 8)}</span>
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-amber-400/45 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
          Pending Review
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-red-400/40 bg-red-500/12 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-950 dark:text-red-100">
          Triggered Red Flags
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900 dark:text-red-100">
          {escalation.red_flag_questions.map((question) => (
            <li key={question}>{question}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs text-secondary">
        Notifications queued: {escalation.notifications_queued}/
        {escalation.notification_targets}
      </p>

      <form className="mt-3 space-y-3">
        <input type="hidden" name="escalationId" value={escalation.id} />
        <label className="block text-sm text-secondary">
          Decision notes (optional)
          <textarea
            name="reviewNotes"
            rows={2}
            className="input mt-1"
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
            className="rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-500/25 dark:text-emerald-100"
          >
            Approve and Sign In
          </button>
          <button
            type="submit"
            formAction={async (formData) => {
              "use server";
              await denySignInEscalationAction(formData);
            }}
            className="btn-danger"
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
    <div className="space-y-6 p-3 sm:p-4">
      <div className="surface-panel-strong p-5">
        <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
          Sign-In Escalations
        </h1>
        <p className="mt-1 text-sm text-secondary">
          Review blocked red-flag inductions and decide whether to approve entry.
        </p>
      </div>

      <section className="space-y-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Pending</h2>
          <span className="rounded-full border border-amber-400/45 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-100">
            {pending.length} pending
          </span>
        </div>

        {pending.length === 0 ? (
          <div className="surface-panel p-5 text-sm text-secondary">
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Recent Decisions</h2>
        {resolved.length === 0 ? (
          <div className="surface-panel p-5 text-sm text-secondary">
            No resolved escalations yet.
          </div>
        ) : (
          <div className="surface-panel overflow-x-auto">
            <table className="min-w-full divide-y divide-[color:var(--border-soft)]">
              <thead className="bg-[color:var(--bg-surface-strong)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Visitor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Site
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Decision
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Reviewed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-secondary">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-soft)] bg-[color:var(--bg-surface)]">
                {resolved.map((escalation) => (
                  <tr key={escalation.id} className="hover:bg-[color:var(--bg-surface-strong)]">
                    <td className="px-4 py-3 text-sm font-semibold text-[color:var(--text-primary)]">
                      {escalation.visitor_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {siteNames.get(escalation.site_id) ?? "Unknown site"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${escalationStatusChipClass(escalation.status)}`}
                      >
                        {escalation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
                      {escalation.reviewed_at
                        ? formatDateTime(escalation.reviewed_at)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary">
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
