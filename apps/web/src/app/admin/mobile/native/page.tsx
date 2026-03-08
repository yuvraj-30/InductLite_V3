import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermissionReadOnly } from "@/lib/auth";

function readValue(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "Not configured";
}

export const metadata = {
  title: "Native Mobile Runtime | InductLite",
};

export default async function MobileNativeRuntimePage() {
  const guard = await checkPermissionReadOnly("site:manage");
  if (!guard.success) {
    if (guard.code === "UNAUTHENTICATED") redirect("/login");
    redirect("/unauthorized");
  }

  const iosStoreUrl = readValue(process.env.MOBILE_IOS_APPSTORE_URL);
  const androidStoreUrl = readValue(process.env.MOBILE_ANDROID_PLAY_URL);
  const iosMinVersion = readValue(process.env.MOBILE_IOS_MIN_VERSION);
  const androidMinVersion = readValue(process.env.MOBILE_ANDROID_MIN_VERSION);
  const wrapperRuntime = readValue(process.env.MOBILE_WRAPPER_RUNTIME);
  const releaseChannel = readValue(process.env.MOBILE_RELEASE_CHANNEL);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Native iOS/Android Runtime</h1>
          <p className="mt-1 text-sm text-gray-600">
            Operational controls for app-store distribution and wrapper channel readiness.
          </p>
        </div>
        <Link
          href="/admin/mobile"
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Mobile Ops
        </Link>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Distribution Metadata
        </h2>
        <dl className="mt-3 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">iOS App Store URL</dt>
            <dd className="mt-1 break-all">{iosStoreUrl}</dd>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">Android Play URL</dt>
            <dd className="mt-1 break-all">{androidStoreUrl}</dd>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">iOS Min Supported Version</dt>
            <dd className="mt-1">{iosMinVersion}</dd>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">Android Min Supported Version</dt>
            <dd className="mt-1">{androidMinVersion}</dd>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">Wrapper Runtime</dt>
            <dd className="mt-1">{wrapperRuntime}</dd>
          </div>
          <div className="rounded border border-gray-200 p-3">
            <dt className="font-semibold text-gray-900">Release Channel</dt>
            <dd className="mt-1">{releaseChannel}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-700">
          Device Runtime Requirements
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Use secure enrollment token issuance from `/api/mobile/enrollment-token`.</li>
          <li>Send heartbeat every 5-15 minutes to `/api/mobile/heartbeat`.</li>
          <li>Replay delayed geofence events via `/api/mobile/geofence-events/replay`.</li>
          <li>Track runtime tag per device: platform + app version + OS + channel.</li>
          <li>Keep stale-device diagnostics monitored in Mobile Operations.</li>
        </ul>
      </section>
    </div>
  );
}
