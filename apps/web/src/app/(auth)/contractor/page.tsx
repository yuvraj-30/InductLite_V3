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
        <Alert variant="error" className="mb-6">
          The link is invalid or has expired. Request a new one below.
        </Alert>
      )}
      <MagicLinkForm />
    </div>
  );
}
