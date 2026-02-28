"use client";

interface SignInResult {
  signInRecordId: string;
  signOutToken: string;
  signOutTokenExpiresAt: Date;
  visitorName: string;
  siteName: string;
  signInTime: Date;
}

interface SuccessScreenProps {
  result: SignInResult;
}

export function SuccessScreen({ result }: SuccessScreenProps) {
  const signOutUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/sign-out?token=${encodeURIComponent(result.signOutToken)}`
      : "";

  const formattedTime = result.signInTime.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const expiryTime = result.signOutTokenExpiresAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const copySignOutLink = async () => {
    try {
      await navigator.clipboard.writeText(signOutUrl);
      alert("Sign-out link copied to clipboard.");
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = signOutUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Sign-out link copied.");
    }
  };

  return (
    <div className="surface-panel-strong overflow-hidden">
      <div className="bg-gradient-to-br from-emerald-600 via-emerald-500 to-cyan-500 px-6 py-8 text-center text-white">
        <div className="mb-4 text-5xl" aria-hidden="true">
          OK
        </div>
        <h2 className="kinetic-title text-3xl font-black">Signed In Successfully</h2>
        <p className="mt-2 text-emerald-50">Welcome to {result.siteName}</p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="rounded-xl border border-white/35 bg-white/45 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
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
          </div>
        </div>

        <div className="rounded-xl border border-indigo-400/35 bg-indigo-500/12 p-4">
          <h3 className="mb-2 font-semibold text-indigo-950 dark:text-indigo-100">
            Sign Out When Leaving
          </h3>
          <p className="mb-3 text-sm text-indigo-900 dark:text-indigo-200">
            Use the link below to sign out when you leave site. This link expires at{" "}
            <strong>{expiryTime}</strong>.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={copySignOutLink}
              className="btn-primary w-full"
            >
              Copy Sign-Out Link
            </button>

            <a
              href={signOutUrl}
              className="btn-secondary w-full text-center font-semibold text-accent"
            >
              Sign Out Now
            </a>
          </div>
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
      </div>

      <div className="border-t border-white/25 bg-white/35 px-6 py-4 text-center">
        <p className="text-sm text-secondary">Need help? Contact site reception.</p>
      </div>
    </div>
  );
}
