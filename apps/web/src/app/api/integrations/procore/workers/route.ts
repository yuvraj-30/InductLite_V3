import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseProcoreConnectorConfig } from "@/lib/integrations/procore/config";
import { findSiteById } from "@/lib/repository/site.repository";
import { listContractors } from "@/lib/repository/contractor.repository";
import { upsertContractorPrequalification } from "@/lib/repository/permit.repository";
import { createCommunicationEvent } from "@/lib/repository/communication.repository";
import { createAuditLog } from "@/lib/repository/audit.repository";

const profileSchema = z.object({
  externalId: z.string().trim().min(1).max(120),
  contractorName: z.string().trim().min(1).max(160),
  contractorEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  status: z.string().trim().min(1).max(40),
  score: z.coerce.number().int().min(0).max(100).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  checklist: z.record(z.string(), z.unknown()).optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

const requestSchema = z.object({
  companyId: z.string().cuid(),
  siteId: z.string().cuid(),
  provider: z.string().trim().optional().or(z.literal("")),
  profiles: z.array(profileSchema).min(1).max(500),
});

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

function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid payload",
      },
      { status: 400 },
    );
  }

  const site = await findSiteById(parsed.data.companyId, parsed.data.siteId);
  if (!site) {
    return NextResponse.json(
      { success: false, error: "Site not found" },
      { status: 404 },
    );
  }

  const config = parseProcoreConnectorConfig(site.lms_connector);
  if (!config.enabled || !config.inboundSharedSecret) {
    return NextResponse.json(
      { success: false, error: "Procore inbound connector is not enabled" },
      { status: 403 },
    );
  }

  const bearer = parseBearer(request.headers.get("authorization"));
  if (!bearer || !safeEqual(bearer, config.inboundSharedSecret)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized connector token" },
      { status: 401 },
    );
  }

  const contractorsPage = await listContractors(
    parsed.data.companyId,
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
  for (const profile of parsed.data.profiles) {
    const byEmailMatch =
      profile.contractorEmail && profile.contractorEmail.trim()
        ? byEmail.get(profile.contractorEmail.trim().toLowerCase())
        : null;
    const match = byEmailMatch ?? byName.get(profile.contractorName.trim().toLowerCase()) ?? null;
    if (!match) {
      unmatched += 1;
      continue;
    }

    await upsertContractorPrequalification(parsed.data.companyId, {
      contractor_id: match.id,
      site_id: parsed.data.siteId,
      score: profile.score ?? 0,
      status: normalizeStatus(profile.status),
      checklist: profile.checklist ?? undefined,
      evidence_refs: {
        provider: parsed.data.provider || "PROCORE",
        external_id: profile.externalId,
        upstream_status: profile.status,
        evidence: profile.evidence ?? null,
      },
      expires_at: profile.expiresAt ? new Date(profile.expiresAt) : undefined,
    });
    applied += 1;
  }

  await createCommunicationEvent(parsed.data.companyId, {
    site_id: parsed.data.siteId,
    direction: "INBOUND",
    event_type: "procore.inbound.prequalification",
    status: "APPLIED",
    payload: {
      provider: parsed.data.provider || "PROCORE",
      received: parsed.data.profiles.length,
      applied,
      unmatched,
    },
  });

  await createAuditLog(parsed.data.companyId, {
    action: "procore.inbound.apply",
    entity_type: "Site",
    entity_id: parsed.data.siteId,
    details: {
      provider: parsed.data.provider || "PROCORE",
      received: parsed.data.profiles.length,
      applied,
      unmatched,
    },
  });

  return NextResponse.json({
    success: true,
    received: parsed.data.profiles.length,
    applied,
    unmatched,
  });
}
