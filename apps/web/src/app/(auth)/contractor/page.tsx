import { MagicLinkForm } from "./magic-link-form";
import { Alert } from "@/components/ui/alert";

export const metadata = {
  title: "Contractor Access | InductLite",
};

export default async function ContractorLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const status = Array.isArray(params?.status)
    ? params.status[0]
    : params?.status;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Contractor access
      </h2>
      {status === "invalid" && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <Alert variant="error">
            The link is invalid or has expired.
          </Alert>
          <p className="mt-3 text-sm text-red-900">
            Request a new magic link below using your site link and email address.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-800">
            <li>Magic links expire after 15 minutes.</li>
            <li>
              If the email does not arrive within 60 seconds, check spam and retry.
            </li>
          </ul>
          <a
            href="#magic-link-form"
            className="mt-3 inline-flex min-h-[40px] items-center rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Request New Link
          </a>
        </div>
      )}
      <MagicLinkForm formId="magic-link-form" />
    </div>
  );
}
