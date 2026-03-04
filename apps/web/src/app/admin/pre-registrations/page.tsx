import { redirect } from "next/navigation";
import Link from "next/link";
import { checkPermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import {
  findAllSites,
  findSitesByIds,
  listPreRegistrationInvites,
} from "@/lib/repository";
import { listManagedSiteIds } from "@/lib/repository/site-manager.repository";
import { CreateInviteForm } from "./create-invite-form";
import { DeactivateInviteButton } from "./deactivate-invite-button";
import { BulkInviteForm } from "./bulk-invite-form";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";

export const metadata = {
  title: "Pre-Registrations | InductLite",
};

interface PreRegistrationsPageProps {
  searchParams: Promise<{
    siteId?: string;
  }>;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("en-NZ");
}

function inviteStatus(invite: {
  is_active: boolean;
  used_at: Date | null;
  expires_at: Date;
}): "Active" | "Used" | "Expired" | "Inactive" {
  if (!invite.is_active) return "Inactive";
  if (invite.used_at) return "Used";
  if (invite.expires_at.getTime() < Date.now()) return "Expired";
  return "Active";
}

function statusBadgeClass(status: ReturnType<typeof inviteStatus>): string {
  if (status === "Active") return "bg-green-100 text-green-800";
  if (status === "Used") return "bg-blue-100 text-blue-800";
  if (status === "Expired") return "bg-amber-100 text-amber-800";
  return "bg-gray-100 text-gray-700";
}

export default async function PreRegistrationsPage({
  searchParams,
}: PreRegistrationsPageProps) {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const query = await searchParams;

  const sites =
    context.role === "SITE_MANAGER"
      ? await (async () => {
          const managedSiteIds = await listManagedSiteIds(
            context.companyId,
            context.userId,
          );
          return findSitesByIds(context.companyId, managedSiteIds);
        })()
      : await findAllSites(context.companyId);

  if (sites.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Pre-Registrations</h1>
        <p className="mt-2 text-sm text-gray-600">
          No accessible sites available for pre-registration.
        </p>
      </div>
    );
  }

  const allowedSiteIds = new Set(sites.map((site) => site.id));
  const requestedSiteId =
    query.siteId && allowedSiteIds.has(query.siteId) ? query.siteId : undefined;
  const selectedSiteId = requestedSiteId ?? sites[0]!.id;
  let preregFeatureEnabled = true;
  try {
    await assertCompanyFeatureEnabled(
      context.companyId,
      "PREREG_INVITES",
      selectedSiteId,
    );
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      preregFeatureEnabled = false;
    } else {
      throw error;
    }
  }

  const invites = await listPreRegistrationInvites(
    context.companyId,
    { siteId: selectedSiteId, includeInactive: true },
    { page: 1, pageSize: 100 },
  );

  const siteNames = new Map(sites.map((site) => [site.id, site.name]));

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pre-Registrations</h1>
          <p className="mt-1 text-gray-600">
            Create invite links so visitors can arrive with prefilled details.
          </p>
        </div>
        <Link
          href="/admin/sites"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Sites
        </Link>
      </div>

      {!preregFeatureEnabled && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Pre-registration disabled for the currently selected site
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Invite creation is disabled by entitlements (CONTROL_ID:
            PLAN-ENTITLEMENT-001).
          </p>
        </section>
      )}

      <CreateInviteForm sites={sites} defaultSiteId={selectedSiteId} />
      <BulkInviteForm sites={sites} defaultSiteId={selectedSiteId} />

      <section className="mt-6 rounded-lg border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Invites</h2>
        <p className="mt-1 text-sm text-gray-600">
          Showing {invites.items.length} invite
          {invites.items.length === 1 ? "" : "s"} for{" "}
          {siteNames.get(selectedSiteId) ?? "selected site"}.
        </p>

        {invites.items.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No pre-registrations yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Visitor
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Site
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Expires
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Used
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invites.items.map((invite) => {
                  const status = inviteStatus(invite);
                  return (
                    <tr key={invite.id}>
                      <td className="px-3 py-2 text-sm text-gray-800">
                        <p className="font-medium">{invite.visitor_name}</p>
                        <p className="text-xs text-gray-500">{invite.visitor_phone}</p>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {invite.visitor_type}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {siteNames.get(invite.site_id) ?? invite.site_id}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatDateTime(invite.expires_at)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {formatDateTime(invite.used_at)}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(status)}`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {status === "Active" ? (
                          <DeactivateInviteButton
                            inviteId={invite.id}
                            siteId={invite.site_id}
                          />
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
