"use client";

/**
 * Sign-Out Form Component
 *
 * Handles self-service sign-out with token verification.
 * Requires phone number confirmation for security.
 */

import { useState, useTransition } from "react";
import { submitSignOut } from "@/app/s/[slug]/actions";

interface SignOutFormProps {
  initialToken: string;
}

export function SignOutForm({ initialToken }: SignOutFormProps) {
  const [token] = useState(initialToken);
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ visitorName: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(
        "Invalid sign-out link. Please use the link from your sign-in confirmation.",
      );
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number");
      return;
    }

    startTransition(async () => {
      const result = await submitSignOut({
        token,
        phone: phone.trim(),
      });

      if (!result.success) {
        setError(result.error.message || "Failed to sign out");
        return;
      }

      setSuccess({ visitorName: result.data.visitorName });
    });
  };

  // Success state
  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-green-500 text-white px-6 py-8 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold">Signed Out Successfully</h1>
          <p className="text-green-100 mt-2">
            Thank you for your visit, {success.visitorName}
          </p>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="text-gray-600 mb-4">
            You have been signed out. Have a safe journey!
          </p>
          <p className="text-sm text-gray-500">You may close this page now.</p>
        </div>
      </div>
    );
  }

  // No token provided
  if (!token) {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-red-500 text-white px-6 py-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold">Invalid Link</h1>
        </div>

        <div className="px-6 py-6 text-center">
          <p className="text-gray-600 mb-4">
            This sign-out link is invalid or has expired.
          </p>
          <p className="text-sm text-gray-500">
            Please use the sign-out link you received when signing in, or
            contact site reception for assistance.
          </p>
        </div>
      </div>
    );
  }

  // Sign-out form
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-blue-600 text-white px-6 py-6 text-center">
        <h1 className="text-xl font-bold">Sign Out</h1>
        <p className="text-blue-100 text-sm mt-1">
          Confirm your phone number to sign out
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label
            htmlFor="signOutPhone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="signOutPhone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter the phone number used to sign in"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter the same phone number you used when signing in
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Signing out..." : "Confirm Sign Out"}
        </button>
      </form>

      <div className="px-6 py-4 bg-gray-50 border-t">
        <p className="text-sm text-gray-500 text-center">
          Having trouble? Contact site reception for assistance.
        </p>
      </div>
    </div>
  );
}
