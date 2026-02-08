"use client";

/**
 * Success Screen Component
 *
 * Displays after successful sign-in with:
 * - Confirmation message
 * - Sign-out link for later use
 * - QR code option for sign-out link
 */

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
      alert("Sign-out link copied to clipboard!");
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = signOutUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      alert("Sign-out link copied!");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Success header */}
      <div className="bg-green-600 text-white px-6 py-8 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">
          ✓
        </div>
        <h2 className="text-2xl font-bold">Signed In Successfully</h2>
        <p className="text-green-50 mt-2">Welcome to {result.siteName}</p>
      </div>

      {/* Details */}
      <div className="px-6 py-6 space-y-4">
        <div className="bg-gray-50 rounded-lg p-4">
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

        {/* Sign-out instructions */}
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            📱 Sign Out When Leaving
          </h3>
          <p className="text-sm text-blue-700 mb-3">
            When you leave the site, use the link below to sign out. This link
            expires at <strong>{expiryTime}</strong>.
          </p>

          <div className="flex flex-col gap-2">
            <button
              onClick={copySignOutLink}
              className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              📋 Copy Sign-Out Link
            </button>

            <a
              href={signOutUrl}
              className="w-full py-2 px-4 bg-white text-blue-600 font-medium rounded-lg border border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
            >
              Sign Out Now
            </a>
          </div>
        </div>

        {/* Safety reminder */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-1">
            ⚠️ Safety Reminder
          </h3>
          <ul className="text-sm text-yellow-700 list-disc list-inside space-y-1">
            <li>Wear required PPE at all times</li>
            <li>Report any hazards to site management</li>
            <li>Follow all site safety procedures</li>
            <li>Sign out when leaving the site</li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t text-center">
        <p className="text-sm text-gray-500">
          Need help? Contact site reception.
        </p>
      </div>
    </div>
  );
}
