import { getSiteForSignIn } from "../actions";
import { SignInFlow } from "../components/SignInFlow";
import { notFound } from "next/navigation";
import { PublicShell } from "@/components/ui/public-shell";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function KioskPage({ params }: Props) {
  const { slug } = await params;
  const result = await getSiteForSignIn(slug);

  if (!result.success || "notFound" in result.data) {
    notFound();
  }

  const { site, template } = result.data;

  return (
    <PublicShell
      brand="InductLite"
      subtitle={`${site.name} | Shared-device sign-in kiosk`}
    >
      <div className="mb-6 text-center">
        <span className="inline-flex items-center rounded-full border border-cyan-400/35 bg-cyan-500/15 px-3 py-1 text-sm font-medium text-cyan-950 dark:text-cyan-100">
          Kiosk Mode Active
        </span>
      </div>
      <SignInFlow slug={slug} site={site} template={template} isKiosk={true} />
    </PublicShell>
  );
}
