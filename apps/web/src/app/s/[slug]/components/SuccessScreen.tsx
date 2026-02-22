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
    <div className="overflow-hidden rounded-lg bg-white shadow-lg">
      <div className="bg-green-600 px-6 py-8 text-center text-white">
        <div className="mb-4 text-5xl" aria-hidden="true">
          OK
        </div>
        <h2 className="text-2xl font-bold">Signed In Successfully</h2>
        <p className="mt-2 text-green-50">Welcome to {result.siteName}</p>
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium text-gray-900">{result.visitorName}</p>
            </div>
            <div>
              <p className="text-gray-500">Signed in at</p>
              <p className="font-medium text-gray-900">{formattedTime}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h3 className="mb-2 font-medium text-blue-900">Sign Out When Leaving</h3>
          <p className="mb-3 text-sm text-blue-700">
            Use the link below to sign out when you leave site. This link expires at{" "}
            <strong>{expiryTime}</strong>.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={copySignOutLink}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Copy Sign-Out Link
            </button>

            <a
              href={signOutUrl}
              className="w-full rounded-lg border border-blue-300 bg-white px-4 py-2 text-center font-medium text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign Out Now
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <h3 className="mb-1 font-medium text-yellow-900">Safety Reminder</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-yellow-700">
            <li>Wear required PPE at all times</li>
            <li>Report hazards to site management immediately</li>
            <li>Follow all site safety procedures</li>
            <li>Sign out when leaving the site</li>
          </ul>
        </div>
      </div>

      <div className="border-t bg-gray-50 px-6 py-4 text-center">
        <p className="text-sm text-gray-500">Need help? Contact site reception.</p>
      </div>
    </div>
  );
}
