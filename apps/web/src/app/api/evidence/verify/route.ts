import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  computeEvidenceHashRoot,
  verifyEvidenceSignature,
} from "@/lib/repository/evidence.repository";

const verificationSchema = z.object({
  companyId: z.string().min(6).max(64),
  hashRoot: z.string().regex(/^[a-f0-9]{64}$/i, "hashRoot must be a SHA-256 hex string"),
  signature: z.string().regex(/^[a-f0-9]{64}$/i, "signature must be a SHA-256 hex string"),
  artifactHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/i)).optional(),
});

function parseArtifactHashes(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function runVerification(input: {
  companyId: string;
  hashRoot: string;
  signature: string;
  artifactHashes?: string[];
}) {
  const normalizedRoot = input.hashRoot.trim().toLowerCase();
  const normalizedSignature = input.signature.trim().toLowerCase();
  const signatureValid = verifyEvidenceSignature(
    input.companyId,
    normalizedRoot,
    normalizedSignature,
  );

  let rootValid = true;
  if (input.artifactHashes && input.artifactHashes.length > 0) {
    rootValid =
      computeEvidenceHashRoot(input.artifactHashes.map((value) => value.toLowerCase())) ===
      normalizedRoot;
  }

  return {
    verified: signatureValid && rootValid,
    signatureValid,
    hashRootMatchesArtifacts: rootValid,
  };
}

export async function GET(request: NextRequest) {
  const parsed = verificationSchema.safeParse({
    companyId: request.nextUrl.searchParams.get("companyId") ?? "",
    hashRoot: request.nextUrl.searchParams.get("hashRoot") ?? "",
    signature: request.nextUrl.searchParams.get("signature") ?? "",
    artifactHashes: parseArtifactHashes(request.nextUrl.searchParams.get("artifactHashes")),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid verification request",
      },
      { status: 400 },
    );
  }

  const result = runVerification(parsed.data);
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const parsed = verificationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Invalid verification request",
      },
      { status: 400 },
    );
  }

  const result = runVerification(parsed.data);
  return NextResponse.json({ success: true, ...result });
}
