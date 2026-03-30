"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { CopyButton } from "@/components/ui/copy-button";

interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
  competencyStatus?: "CLEAR" | "EXPIRING" | "BLOCKED";
  competencyBlockedReason?: string | null;
  competencyRequirementCount?: number;
  competencyMissingCount?: number;
  competencyExpiringCount?: number;
}

interface SuccessScreenProps {
  slug: string;
  result: SignInResult;
}

interface BadgeQrProps {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
}

type BadgePrintProfile = "A4" | "THERMAL";
const BADGE_PRINT_INK_COLOR = "#171924";
const BADGE_PRINT_SURFACE_COLOR = "#ffffff";

export function SuccessScreen({ slug, result }: SuccessScreenProps) {
  const [BadgeQrComponent, setBadgeQrComponent] =
    useState<ComponentType<BadgeQrProps> | null>(null);
  const [isRecordingBadgePrint, setIsRecordingBadgePrint] = useState(false);
  const [badgePrintProfile, setBadgePrintProfile] =
    useState<BadgePrintProfile>("A4");

  useEffect(() => {
    if (BadgeQrComponent) return;

    let cancelled = false;
    void import("qrcode.react").then((mod) => {
      if (!cancelled) {
        setBadgeQrComponent(() => mod.QRCodeSVG as ComponentType<BadgeQrProps>);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [BadgeQrComponent]);

  const signOutPath = `/sign-out?token=${encodeURIComponent(result.signOutToken)}&slug=${encodeURIComponent(slug)}`;
  const signOutUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${signOutPath}`
      : signOutPath;

  const badgePayload = useMemo(
    () =>
      JSON.stringify({
        v: 1,
        type: "visitor_badge",
        signInRecordId: result.signInRecordId,
        siteSlug: slug,
        siteName: result.siteName,
        issuedAt: result.signInTime.toISOString(),
      }),
    [result.signInRecordId, result.signInTime, result.siteName, slug],
  );

  const formattedTime = result.signInTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const expiryTime = result.signOutTokenExpiresAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const badgeQrSize = badgePrintProfile === "THERMAL" ? 92 : 108;
  const clearanceTone =
    result.competencyStatus === "EXPIRING"
      ? "border-amber-400/40 bg-amber-500/12 text-amber-950 dark:text-amber-100"
      : "border-emerald-400/35 bg-emerald-500/12 text-emerald-950 dark:text-emerald-100";

  const printBadge = async () => {
    window.print();
    if (isRecordingBadgePrint) {
      return;
    }

    setIsRecordingBadgePrint(true);
    try {
      const { submitBadgePrintAudit } = await import("../actions");
      await submitBadgePrintAudit({
        slug,
        signInRecordId: result.signInRecordId,
      });
    } finally {
      setIsRecordingBadgePrint(false);
    }
  };

  return (
    <div className="surface-panel-strong overflow-hidden">
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-cyan-500 px-6 py-8 text-center text-white">
        <div className="mb-4 inline-flex rounded-full border border-white/30 bg-white/12 px-4 py-1 text-sm font-semibold uppercase tracking-[0.12em]">
          Active on site
        </div>
        <h2 className="kinetic-title text-3xl font-black">Cleared for Site</h2>
        <p className="mt-2 text-emerald-50">
          Your sign-in is complete and site management can now see you as on site at {result.siteName}.
        </p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="rounded-xl border border-surface-soft bg-surface-soft p-4">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted">Name</p>
              <p className="font-semibold text-[color:var(--text-primary)]">
                {result.visitorName}
              </p>
            </div>
            <div>
              <p className="text-muted">Signed in at</p>
              <p className="font-semibold text-[color:var(--text-primary)]">{formattedTime}</p>
            </div>
            <div>
              <p className="text-muted">Status</p>
              <p className="font-semibold text-[color:var(--accent-success)]">Active on site</p>
            </div>
          </div>
        </div>

        {result.competencyStatus ? (
          <div className={`rounded-xl border p-4 ${clearanceTone}`}>
            <h3 className="font-semibold">Clearance check</h3>
            <p className="mt-2 text-sm">
              {result.competencyStatus === "EXPIRING"
                ? "You are cleared for this visit, but one or more competency items are approaching expiry."
                : "Required site competency checks were satisfied for this visit."}
            </p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] opacity-75">Requirements</p>
                <p className="mt-1 font-semibold">{result.competencyRequirementCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] opacity-75">Missing</p>
                <p className="mt-1 font-semibold">{result.competencyMissingCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.08em] opacity-75">Expiring</p>
                <p className="mt-1 font-semibold">{result.competencyExpiringCount ?? 0}</p>
              </div>
            </div>
            {result.competencyBlockedReason ? (
              <p className="mt-3 text-sm">{result.competencyBlockedReason}</p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/12 p-4">
          <h3 className="mb-2 font-semibold text-indigo-950 dark:text-indigo-100">
            Keep your sign-out link ready
          </h3>
          <p className="mb-3 text-sm text-indigo-900 dark:text-indigo-200">
            You will need this link when leaving the site. It expires at <strong>{expiryTime}</strong>.
          </p>

          <div className="flex flex-col gap-2">
            <CopyButton
              value={signOutUrl}
              label="Copy Sign-Out Link"
              copiedLabel="Sign-Out Link Copied"
              errorLabel="Copy failed"
              className="btn-primary w-full"
            />

            <a
              href={signOutUrl}
              className="btn-secondary w-full text-center font-semibold text-accent"
            >
              Sign Out Now
            </a>
          </div>
        </div>

        <div
          id="badge-print-area"
          data-print-profile={badgePrintProfile.toLowerCase()}
          className="rounded-xl border border-cyan-400/35 bg-cyan-500/10 p-4"
        >
          <h3 className="mb-2 font-semibold text-cyan-950 dark:text-cyan-100">
            Visitor Badge
          </h3>
          <p className="mb-3 text-sm text-cyan-900 dark:text-cyan-200">
            Print and display this badge while on site.
          </p>

          <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.08em] text-cyan-900 dark:text-cyan-100">
            Print Profile
            <select
              value={badgePrintProfile}
              onChange={(event) =>
                setBadgePrintProfile(event.target.value as BadgePrintProfile)
              }
              className="mt-1 block w-full rounded-md border border-cyan-300/50 bg-[color:var(--bg-surface)] px-2 py-1 text-sm text-[color:var(--text-primary)]"
            >
              <option value="A4">A4 badge sheet</option>
              <option value="THERMAL">Thermal label (62mm)</option>
            </select>
          </label>

          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="text-sm text-cyan-950 dark:text-cyan-100">
              <p>
                <strong>Name:</strong> {result.visitorName}
              </p>
              <p>
                <strong>Site:</strong> {result.siteName}
              </p>
              <p>
                <strong>Badge ID:</strong> {result.signInRecordId.slice(0, 8).toUpperCase()}
              </p>
            </div>

            <div className="rounded-lg border border-cyan-300/40 bg-[color:var(--bg-surface)] p-2">
              {BadgeQrComponent ? (
                <BadgeQrComponent value={badgePayload} size={badgeQrSize} level="M" />
              ) : (
                <div
                  className="flex items-center justify-center text-xs text-muted"
                  style={{ height: badgeQrSize, width: badgeQrSize }}
                >
                  Loading QR...
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              void printBadge();
            }}
            className="btn-primary w-full"
            disabled={isRecordingBadgePrint}
          >
            {isRecordingBadgePrint ? "Recording..." : "Print Badge"}
          </button>
        </div>

        <div className="rounded-xl border border-amber-400/40 bg-amber-500/12 p-4">
          <h3 className="mb-1 font-semibold text-amber-950 dark:text-amber-100">
            Safety Reminder
          </h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-amber-900 dark:text-amber-200">
            <li>Wear required PPE at all times</li>
            <li>Report hazards to site management immediately</li>
            <li>Follow all site safety procedures</li>
            <li>Sign out when leaving the site</li>
          </ul>
        </div>

        <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-4 text-sm text-secondary">
          Keep the sign-out link with you. Using it when you leave closes this visit cleanly in the site audit log.
        </div>
      </div>

      <div className="border-t border-surface-soft bg-surface-soft px-6 py-4 text-center">
        <p className="text-sm text-secondary">Need help? Contact site reception.</p>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #badge-print-area,
          #badge-print-area * {
            visibility: visible !important;
          }

          #badge-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            border: 1px solid ${BADGE_PRINT_INK_COLOR} !important;
            background: ${BADGE_PRINT_SURFACE_COLOR} !important;
            color: ${BADGE_PRINT_INK_COLOR} !important;
            box-shadow: none !important;
            margin: 0 !important;
          }

          #badge-print-area[data-print-profile="a4"] {
            width: 100% !important;
            padding: 12mm !important;
          }

          #badge-print-area[data-print-profile="thermal"] {
            width: 62mm !important;
            min-height: 34mm !important;
            padding: 4mm !important;
            border-width: 1px !important;
          }
        }
      `}</style>
    </div>
  );
}

