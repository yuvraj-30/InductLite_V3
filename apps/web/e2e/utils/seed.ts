import type { APIRequestContext } from "@playwright/test";
import { getTestRouteHeaders } from "./test-route-auth";

export type SeedPublicSiteResult = {
  success: boolean;
  slug?: string;
  siteId?: string;
  publicLinkId?: string;
  templateId?: string;
  questionId?: string;
  redFlagQuestionId?: string;
  skipLogicSourceQuestionId?: string;
  includeMediaQuizFlow?: boolean;
  includeGeofenceOverrideFlow?: boolean;
  includeSkipLogicFlow?: boolean;
  geofenceOverrideCode?: string;
  clearedRateLimit?: boolean;
  error?: string;
};

export async function seedPublicSite(
  request: APIRequestContext,
  opts?: {
    slugPrefix?: string;
    includeRedFlagQuestion?: boolean;
    includeLanguageVariants?: boolean;
    includeMediaQuizFlow?: boolean;
    includeGeofenceOverrideFlow?: boolean;
    includeSkipLogicFlow?: boolean;
    companySlug?: string;
  },
): Promise<{
  ok: boolean;
  status: number | null;
  body: SeedPublicSiteResult | null;
  rawText?: string;
}> {
  try {
    const res = await request.post(`/api/test/seed-public-site`, {
      data: opts ?? {},
      headers: getTestRouteHeaders(),
    });
    const status = res.status();
    const rawText = await res.text();
    const body = (() => {
      try {
        return rawText ? (JSON.parse(rawText) as SeedPublicSiteResult) : null;
      } catch {
        return null;
      }
    })();
    return { ok: res.ok(), status, body, rawText };
  } catch (err) {
    return {
      ok: false,
      status: null,
      body: { success: false, error: String(err) },
      rawText: String(err),
    };
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
