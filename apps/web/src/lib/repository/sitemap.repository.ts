/**
 * Sitemap Repository
 *
 * Read-only public sitemap queries.
 */

import { publicDb } from "@/lib/db/public-db";

export interface SitemapPublicLink {
  slug: string;
  created_at: Date;
}

export async function listActiveSitemapPublicLinks(
  limit: number = 5000,
): Promise<SitemapPublicLink[]> {
  // eslint-disable-next-line security-guardrails/require-company-id -- public sitemap intentionally lists active public slugs
  return publicDb.sitePublicLink.findMany({
    where: { is_active: true },
    select: { slug: true, created_at: true },
    take: limit,
    orderBy: { created_at: "desc" },
  });
}
