export const INDUCTION_MEDIA_BLOCK_TYPES = ["TEXT", "PDF", "IMAGE"] as const;

export type InductionMediaBlockType = (typeof INDUCTION_MEDIA_BLOCK_TYPES)[number];

export interface InductionMediaBlock {
  id: string;
  type: InductionMediaBlockType;
  title: string;
  body: string | null;
  url: string | null;
  sortOrder: number;
}

export interface InductionMediaConfig {
  version: 1;
  requireAcknowledgement: boolean;
  acknowledgementLabel: string;
  blocks: InductionMediaBlock[];
}

const DEFAULT_ACKNOWLEDGEMENT_LABEL =
  "I have reviewed the induction material before continuing.";
const MAX_MEDIA_BLOCKS = 10;
const MAX_MEDIA_URL_CHARS = 1_200;
const MAX_MEDIA_BODY_CHARS_PER_BLOCK = 5_000;
const MAX_MEDIA_BODY_CHARS_TOTAL = 15_000;
const MAX_MEDIA_CONFIG_BYTES = 20_000;

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_MEDIA_URL_CHARS) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeType(value: unknown): InductionMediaBlockType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return INDUCTION_MEDIA_BLOCK_TYPES.includes(
    normalized as InductionMediaBlockType,
  )
    ? (normalized as InductionMediaBlockType)
    : null;
}

function inferTypeFromUrl(url: string | null): InductionMediaBlockType | null {
  if (!url) {
    return null;
  }

  const lower = url.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "PDF";
  }
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  ) {
    return "IMAGE";
  }
  return null;
}

function defaultTitleForType(type: InductionMediaBlockType): string {
  switch (type) {
    case "PDF":
      return "Induction Document";
    case "IMAGE":
      return "Induction Image";
    case "TEXT":
    default:
      return "Induction Notes";
  }
}

function normalizeMediaBlock(
  block: unknown,
  index: number,
): InductionMediaBlock | null {
  if (typeof block === "string") {
    const normalizedUrl = normalizeUrl(block);
    if (!normalizedUrl) {
      return null;
    }
    const inferredType = inferTypeFromUrl(normalizedUrl) ?? "PDF";
    return {
      id: `media-${index + 1}`,
      type: inferredType,
      title: defaultTitleForType(inferredType),
      body: null,
      url: normalizedUrl,
      sortOrder: index + 1,
    };
  }

  if (!block || typeof block !== "object") {
    return null;
  }

  const blockObject = block as Record<string, unknown>;
  const normalizedUrl = normalizeUrl(blockObject.url);
  const explicitType = normalizeType(blockObject.type);
  const inferredType =
    explicitType ?? inferTypeFromUrl(normalizedUrl) ?? (normalizedUrl ? "PDF" : "TEXT");
  const normalizedBody = normalizeString(blockObject.body, MAX_MEDIA_BODY_CHARS_PER_BLOCK);
  const normalizedTitle =
    normalizeString(blockObject.title, 120) ?? defaultTitleForType(inferredType);
  const normalizedId =
    normalizeString(blockObject.id, 80) ?? `media-${index + 1}`;
  const sortOrderRaw =
    typeof blockObject.sortOrder === "number" &&
    Number.isFinite(blockObject.sortOrder)
      ? Math.max(1, Math.trunc(blockObject.sortOrder))
      : index + 1;

  if (inferredType === "TEXT" && !normalizedBody) {
    return null;
  }

  if (inferredType !== "TEXT" && !normalizedUrl) {
    return null;
  }

  return {
    id: normalizedId,
    type: inferredType,
    title: normalizedTitle,
    body: inferredType === "TEXT" ? normalizedBody : normalizedBody,
    url: inferredType === "TEXT" ? null : normalizedUrl,
    sortOrder: sortOrderRaw,
  };
}

function applyBodyCharacterBudget(
  blocks: InductionMediaBlock[],
): InductionMediaBlock[] {
  const governedBlocks: InductionMediaBlock[] = [];
  let consumedBodyChars = 0;

  for (const block of blocks) {
    const body = block.body ?? "";
    if (!body) {
      governedBlocks.push(block);
      continue;
    }

    const remaining = MAX_MEDIA_BODY_CHARS_TOTAL - consumedBodyChars;
    if (remaining <= 0) {
      if (block.type !== "TEXT") {
        governedBlocks.push({ ...block, body: null });
      }
      continue;
    }

    if (body.length > remaining) {
      const truncatedBody = body.slice(0, remaining);
      if (block.type === "TEXT" && !truncatedBody.trim()) {
        continue;
      }
      governedBlocks.push({ ...block, body: truncatedBody });
      consumedBodyChars = MAX_MEDIA_BODY_CHARS_TOTAL;
      continue;
    }

    consumedBodyChars += body.length;
    governedBlocks.push(block);
  }

  return governedBlocks;
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function applyConfigByteBudget(config: InductionMediaConfig): InductionMediaConfig {
  const nextConfig: InductionMediaConfig = {
    ...config,
    blocks: [...config.blocks],
  };

  while (
    nextConfig.blocks.length > 0 &&
    utf8ByteLength(JSON.stringify(nextConfig)) > MAX_MEDIA_CONFIG_BYTES
  ) {
    nextConfig.blocks.pop();
  }

  if (nextConfig.blocks.length === 0) {
    nextConfig.requireAcknowledgement = false;
  }

  return nextConfig;
}

export function parseInductionMediaConfig(input: unknown): InductionMediaConfig {
  const fallback: InductionMediaConfig = {
    version: 1,
    requireAcknowledgement: false,
    acknowledgementLabel: DEFAULT_ACKNOWLEDGEMENT_LABEL,
    blocks: [],
  };

  let objectInput: Record<string, unknown> | null = null;
  let rawBlocks: unknown[] = [];

  if (Array.isArray(input)) {
    rawBlocks = input;
  } else if (input && typeof input === "object") {
    objectInput = input as Record<string, unknown>;
    if (Array.isArray(objectInput.blocks)) {
      rawBlocks = objectInput.blocks;
    }
  } else {
    return fallback;
  }

  const deduped = new Map<string, InductionMediaBlock>();
  for (const [index, rawBlock] of rawBlocks.slice(0, MAX_MEDIA_BLOCKS).entries()) {
    const normalized = normalizeMediaBlock(rawBlock, index);
    if (!normalized) {
      continue;
    }
    const dedupeKey =
      normalized.type === "TEXT"
        ? `${normalized.type}:${normalized.title}:${normalized.body ?? ""}`
        : `${normalized.type}:${normalized.url ?? ""}`;
    deduped.set(dedupeKey, normalized);
  }

  const acknowledgementLabel =
    normalizeString(objectInput?.acknowledgementLabel, 200) ??
    DEFAULT_ACKNOWLEDGEMENT_LABEL;
  const requireAcknowledgement =
    objectInput?.requireAcknowledgement === true && deduped.size > 0;
  const blocksWithBodyBudget = applyBodyCharacterBudget(
    [...deduped.values()].sort((left, right) => left.sortOrder - right.sortOrder),
  );

  return applyConfigByteBudget({
    version: 1,
    requireAcknowledgement,
    acknowledgementLabel,
    blocks: blocksWithBodyBudget,
  });
}

export function hasInductionMedia(config: InductionMediaConfig): boolean {
  return config.blocks.length > 0;
}
