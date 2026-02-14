import type { APIRequestContext } from "@playwright/test";
import { getTestRouteHeaders } from "./test-route-auth";

export type SeedPublicSiteResult = {
  success: boolean;
  slug?: string;
  siteId?: string;
  publicLinkId?: string;
  templateId?: string;
  questionId?: string;
  clearedRateLimit?: boolean;
  error?: string;
};

export async function seedPublicSite(
  request: APIRequestContext,
  opts?: { slugPrefix?: string },
): Promise<{ ok: boolean; body: SeedPublicSiteResult | null }> {
  try {
    const res = await request.post(`/api/test/seed-public-site`, {
      data: opts ?? {},
      headers: getTestRouteHeaders(),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok(), body };
  } catch (err) {
    return { ok: false, body: { success: false, error: String(err) } };
  }
}

export async function deletePublicSite(
  request: APIRequestContext,
  slug: string,
): Promise<{
  ok: boolean;
  body: { success?: boolean; deleted?: boolean; error?: string } | null;
}> {
  try {
    const res = await request.delete(
      `/api/test/seed-public-site?slug=${encodeURIComponent(slug)}`,
      { headers: getTestRouteHeaders() },
    );
    const body = await res.json().catch(() => null);
    return { ok: res.ok(), body };
  } catch (err) {
    return { ok: false, body: { error: String(err) } };
  }
}
