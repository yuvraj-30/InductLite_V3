import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkSitePermissionReadOnly } from "@/lib/auth";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { findSiteById } from "@/lib/repository/site.repository";
import { parseAccessControlConfig } from "@/lib/access-control/config";
import { getEffectiveEntitlements } from "@/lib/plans";
import { SiteAccessSettingsForm } from "./site-access-settings-form";

interface SiteAccessControlPageProps {
  params: Promise<{ id: string }>;
}

export const metadata = {
  title: "Site Access Control | InductLite",
};

export default async function SiteAccessControlPage({
  params,
}: SiteAccessControlPageProps) {
  const { id: siteId } = await params;

  const guard = await checkSitePermissionReadOnly("site:manage", siteId);
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const context = await requireAuthenticatedContextReadOnly();
  const site = await findSiteById(context.companyId, siteId);
  if (!site) {
    notFound();
  }

  const [entitlements] = await Promise.all([
    getEffectiveEntitlements(context.companyId, siteId),
  ]);
  const config = parseAccessControlConfig(site.access_control);
  const canEnableGeofence = entitlements.features.GEOFENCE_ENFORCEMENT;
  const canEnableHardware = entitlements.features.HARDWARE_ACCESS;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Access Control</h1>
          <p className="mt-1 text-gray-600">
            {site.name}: configure geofence enforcement and hardware access
            integration.
          </p>
        </div>
        <Link
          href={`/admin/sites/${siteId}`}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
        >
          Back to Site
        </Link>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          className={`rounded-lg border p-3 text-sm ${canEnableGeofence ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <p className="font-semibold">Geofence Enforcement Add-On</p>
          <p className="mt-1">
            {canEnableGeofence
              ? "Enabled for this site plan."
              : "Not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)."}
          </p>
        </div>
        <div
          className={`rounded-lg border p-3 text-sm ${canEnableHardware ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <p className="font-semibold">Hardware Access Add-On</p>
          <p className="mt-1">
            {canEnableHardware
              ? "Enabled for this site plan."
              : "Not enabled for this site plan (CONTROL_ID: PLAN-ENTITLEMENT-001)."}
          </p>
        </div>
      </div>

      <SiteAccessSettingsForm
        siteId={siteId}
        initialGeofenceMode={config.geofence.mode}
        initialGeofenceAllowMissingLocation={config.geofence.allowMissingLocation}
        hasGeofenceOverrideCode={Boolean(config.geofence.overrideCodeHash)}
        initialHardwareEnabled={config.hardware.enabled}
        initialHardwareProvider={config.hardware.provider ?? ""}
        initialHardwareEndpointUrl={config.hardware.endpointUrl ?? ""}
        hasHardwareAuthToken={Boolean(config.hardware.authToken)}
        canEnableGeofence={canEnableGeofence}
        canEnableHardware={canEnableHardware}
        updatedAt={
          config.hardware.updatedAt ?? config.geofence.updatedAt ?? null
        }
      />
    </div>
  );
}
