"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertOrigin, checkPermission } from "@/lib/auth";
import { checkAdminMutationRateLimit } from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { requireAuthenticatedContextReadOnly } from "@/lib/tenant/context";
import { EntitlementDeniedError, assertCompanyFeatureEnabled } from "@/lib/plans";
import { listContractors } from "@/lib/repository/contractor.repository";
import { upsertContractorPrequalification } from "@/lib/repository/permit.repository";
import { createCommunicationEvent } from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";

export type PrequalificationExchangeActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

const importSchema = z.object({
  provider: z.enum(["TOTIKA", "SITEWISE"]),
  siteId: z.string().cuid().optional().or(z.literal("")),
  payloadJson: z.string().min(2).max(1_000_000),
});

interface ExternalPrequalProfile {
  externalId: string;
  contractorName: string;
  contractorEmail: string | null;
  status: string;
  score: number | null;
  expiresAt: string | null;
  checklist: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
}

function normalizeStatus(status: string): "PENDING" | "APPROVED" | "EXPIRED" | "DENIED" {
  const normalized = status.trim().toLowerCase();
  if (["approved", "pass", "passed", "current", "valid"].includes(normalized)) {
    return "APPROVED";
  }
  if (["pending", "review", "in_review", "awaiting"].includes(normalized)) {
    return "PENDING";
  }
  if (["expired", "lapsed", "outdated"].includes(normalized)) {
    return "EXPIRED";
  }
  return "DENIED";
}

function toProfileArray(value: unknown): ExternalPrequalProfile[] {
  const rows = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Array.isArray((value as { profiles?: unknown[] }).profiles)
      ? (value as { profiles: unknown[] }).profiles
      : [];

  return rows
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const record = row as Record<string, unknown>;
      const externalId = String(record.externalId ?? record.id ?? "").trim();
      const contractorName = String(
        record.contractorName ?? record.name ?? "",
      ).trim();
      if (!externalId || !contractorName) return null;
      const contractorEmail = String(
        record.contractorEmail ?? record.email ?? "",
      ).trim();
      const status = String(record.status ?? "PENDING").trim();
      const scoreRaw = Number(record.score);
      const score = Number.isFinite(scoreRaw)
        ? Math.max(0, Math.min(100, Math.trunc(scoreRaw)))
        : null;
      const expiresAt = String(record.expiresAt ?? "").trim() || null;
      const checklist =
        record.checklist && typeof record.checklist === "object" && !Array.isArray(record.checklist)
          ? (record.checklist as Record<string, unknown>)
          : null;
      const evidence =
        record.evidence && typeof record.evidence === "object" && !Array.isArray(record.evidence)
          ? (record.evidence as Record<string, unknown>)
          : null;

      return {
        externalId,
        contractorName,
        contractorEmail: contractorEmail || null,
        status,
        score,
        expiresAt,
        checklist,
        evidence,
      };
    })
    .filter((row): row is ExternalPrequalProfile => Boolean(row));
}

async function authorize(): Promise<
  | { success: true; companyId: string; userId: string }
  | { success: false; error: string }
> {
  const permission = await checkPermission("site:manage");
  if (!permission.success) {
    return { success: false, error: permission.error };
  }

  const context = await requireAuthenticatedContextReadOnly();
  const rateLimit = await checkAdminMutationRateLimit(context.companyId, context.userId);
  if (!rateLimit.success) {
    return {
      success: false,
      error: "Too many admin updates right now. Please retry in a minute.",
    };
  }

  if (!isFeatureEnabled("PERMITS_V1")) {
    return {
      success: false,
      error:
        "Prequalification exchange is disabled by rollout flag (CONTROL_ID: FLAG-ROLLOUT-001)",
    };
  }

  try {
    await assertCompanyFeatureEnabled(context.companyId, "PREQUALIFICATION_V1");
  } catch (error) {
    if (error instanceof EntitlementDeniedError) {
      return {
        success: false,
        error:
          "Prequalification exchange is not enabled for this plan (CONTROL_ID: PLAN-ENTITLEMENT-001)",
      };
    }
    throw error;
  }

  return { success: true, companyId: context.companyId, userId: context.userId };
}

export async function importPrequalificationExchangeAction(
  _prevState: PrequalificationExchangeActionResult | null,
  formData: FormData,
): Promise<PrequalificationExchangeActionResult> {
  try {
    await assertOrigin();
  } catch {
    return { success: false, error: "Invalid request origin" };
  }

  const auth = await authorize();
  if (!auth.success) return auth;

  const parsed = importSchema.safeParse({
    provider: formData.get("provider")?.toString() ?? "",
    siteId: formData.get("siteId")?.toString() ?? "",
    payloadJson: formData.get("payloadJson")?.toString() ?? "",
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid payload" };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(parsed.data.payloadJson);
  } catch {
    return { success: false, error: "Payload must be valid JSON" };
  }

  const profiles = toProfileArray(payload);
  if (profiles.length === 0) {
    return {
      success: false,
      error: "No valid prequalification profiles found in payload",
    };
  }

  const contractorsPage = await listContractors(
    auth.companyId,
    { isActive: true },
    { page: 1, pageSize: 1000 },
  );
  const contractors = contractorsPage.items;
  const byEmail = new Map(
    contractors
      .filter((contractor) => contractor.contact_email)
      .map((contractor) => [
        contractor.contact_email!.trim().toLowerCase(),
        contractor,
      ]),
  );
  const byName = new Map(
    contractors.map((contractor) => [contractor.name.trim().toLowerCase(), contractor]),
  );

  let applied = 0;
  let unmatched = 0;
  for (const profile of profiles) {
    const byEmailMatch = profile.contractorEmail
      ? byEmail.get(profile.contractorEmail.toLowerCase())
      : null;
    const matched =
      byEmailMatch ?? byName.get(profile.contractorName.toLowerCase()) ?? null;
    if (!matched) {
      unmatched += 1;
      continue;
    }

    await upsertContractorPrequalification(auth.companyId, {
      contractor_id: matched.id,
      site_id: parsed.data.siteId || undefined,
      score: profile.score ?? 0,
      status: normalizeStatus(profile.status),
      checklist: profile.checklist ?? undefined,
      evidence_refs: {
        provider: parsed.data.provider,
        external_id: profile.externalId,
        upstream_status: profile.status,
        evidence: profile.evidence ?? null,
      },
      expires_at: profile.expiresAt ? new Date(profile.expiresAt) : undefined,
      reviewed_by: auth.userId,
    });
    applied += 1;
  }

  await createCommunicationEvent(auth.companyId, {
    site_id: parsed.data.siteId || undefined,
    direction: "INBOUND",
    event_type: "prequal.exchange.import",
    status: "APPLIED",
    payload: {
      provider: parsed.data.provider,
      received: profiles.length,
      applied,
      unmatched,
    },
  });

  await createAuditLog(auth.companyId, {
    action: "prequal.exchange.import",
    entity_type: "ContractorPrequalification",
    user_id: auth.userId,
    details: {
      provider: parsed.data.provider,
      site_id: parsed.data.siteId || null,
      received: profiles.length,
      applied,
      unmatched,
    },
  });

  revalidatePath("/admin/prequalification-exchange");
  revalidatePath("/admin/permits");
  return {
    success: true,
    message: `Imported ${profiles.length} profiles (${applied} applied, ${unmatched} unmatched)`,
  };
}
