/**
 * Sitemap Repository
 *
 * Read-only public sitemap queries.
 */

import { listPublicSitemapLinks } from "@/lib/db/scoped";

export interface SitemapPublicLink {
  slug: string;
  created_at: Date;
}

export async function listActiveSitemapPublicLinks(
  limit: number = 5000,
): Promise<SitemapPublicLink[]> {
  return listPublicSitemapLinks(limit);
}
