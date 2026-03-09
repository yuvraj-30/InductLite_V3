import { redirect } from "next/navigation";

interface LegacySignOutPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export default async function LegacySignOutPage({
  searchParams,
}: LegacySignOutPageProps) {
  const params = await searchParams;
  const targetParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeParamValue(value);
    if (!normalized) continue;
    targetParams.set(key, normalized);
  }

  const query = targetParams.toString();
  redirect(query ? `/sign-out?${query}` : "/sign-out");
}
