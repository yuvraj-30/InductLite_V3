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
      <h2 className="kinetic-title mb-6 text-2xl font-black text-[color:var(--text-primary)]">
        Contractor access
      </h2>
      {status === "invalid" && (
        <div className="mb-6 rounded-xl border border-red-400/50 bg-red-100/70 p-4 dark:border-red-500/60 dark:bg-red-950/45">
          <Alert variant="error">
            The link is invalid or has expired.
          </Alert>
          <p className="mt-3 text-sm text-red-950 dark:text-red-100">
            Request a new magic link below using your site link and email address.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-900 dark:text-red-200">
            <li>Magic links expire after 15 minutes.</li>
            <li>
              If the email does not arrive within 60 seconds, check spam and retry.
            </li>
          </ul>
          <a
            href="#magic-link-form"
            className="btn-danger mt-3 min-h-[40px] px-3 py-2 text-sm"
          >
            Request New Link
          </a>
        </div>
      )}
      <MagicLinkForm formId="magic-link-form" />
    </div>
  );
}
