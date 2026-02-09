import { MagicLinkForm } from "./magic-link-form";

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
        <div
          className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm"
          role="alert"
        >
          The link is invalid or has expired. Request a new one below.
        </div>
      )}
      <MagicLinkForm />
    </div>
  );
}
