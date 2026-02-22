import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | InductLite",
  description: "How InductLite handles personal and site induction data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-4 text-sm text-gray-700">
        InductLite collects induction and access information to support health,
        safety, and compliance operations. We process personal data for lawful
        workplace safety purposes and retain records according to customer
        retention settings and applicable law.
      </p>
      <p className="mt-3 text-sm text-gray-700">
        Data may include contact information, sign-in details, induction answers,
        and consent evidence. Authorized company administrators can access records
        for operational and compliance use only.
      </p>
      <p className="mt-3 text-sm text-gray-700">
        For privacy requests, contact your site administrator first. For platform
        privacy questions, use your support channel with InductLite.
      </p>
      <p className="mt-6 text-xs text-gray-500">Last updated: February 21, 2026</p>
    </main>
  );
}
