import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { findAllSites } from "@/lib/repository/site.repository";
import { listCommunicationEvents } from "@/lib/repository/communication.repository";
import { runSafetyCopilotAction } from "./actions";

export const metadata = {
  title: "Safety Copilot | InductLite",
};

function parsePayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export default async function SafetyCopilotPage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  if (!isFeatureEnabled("POLICY_SIMULATOR_V1")) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Safety Copilot</h1>
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Safety copilot is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001).
        </p>
      </div>
    );
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "POLICY_SIMULATOR_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return (
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">Safety Copilot</h1>
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Safety copilot is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001).
          </p>
        </div>
      );
    }
    throw error;
  }

  const [sites, events] = await Promise.all([
    findAllSites(context.companyId),
    listCommunicationEvents(context.companyId, {
      event_type: "ai.copilot.run",
      limit: 40,
    }),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Safety Copilot</h1>
        <p className="mt-1 text-sm text-gray-600">
          AI-assisted permit/safety guidance grounded in tenant-scoped operational signals.
        </p>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Run Copilot
        </h2>
        <form
          action={async (formData) => {
            "use server";
            await runSafetyCopilotAction(null, formData);
          }}
          className="mt-3 grid gap-3"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-gray-700">
              Site scope
              <select name="siteId" className="input mt-1">
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-sm text-gray-700">
            Prompt
            <textarea
              name="prompt"
              required
              minLength={8}
              className="input mt-1 min-h-[140px]"
              placeholder="Example: Which controls should I prioritize this week to reduce sign-in risk at our high-volume sites?"
            />
          </label>
          <div>
            <button
              type="submit"
              className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Run Safety Copilot
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Recent Copilot Runs
        </h2>
        <div className="mt-3 space-y-3">
          {events.length === 0 ? (
            <p className="text-sm text-gray-500">No safety copilot runs yet.</p>
          ) : (
            events.map((event) => {
              const payload = parsePayload(event.payload);
              const summary =
                typeof payload.summary === "string"
                  ? payload.summary
                  : "No summary available.";
              const recommendations = Array.isArray(payload.recommendations)
                ? payload.recommendations
                : [];
              const prompt =
                typeof payload.prompt === "string" ? payload.prompt : "";

              return (
                <article key={event.id} className="rounded border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                      {event.created_at.toLocaleString("en-NZ")}
                    </p>
                    <span className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700">
                      {event.status ?? "COMPLETED"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    <span className="font-semibold">Prompt:</span> {prompt}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{summary}</p>
                  {recommendations.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
                      {recommendations.map((item, index) => {
                        const row =
                          item && typeof item === "object" && !Array.isArray(item)
                            ? (item as Record<string, unknown>)
                            : {};
                        return (
                          <li key={`${event.id}-${index}`}>
                            <span className="font-semibold">
                              {typeof row.title === "string" ? row.title : "Recommendation"}
                            </span>
                            {typeof row.reason === "string" ? `: ${row.reason}` : ""}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
