export interface InductionLanguageQuestionOverride {
  questionId: string;
  questionText: string | null;
  optionLabels: string[] | null;
}

export interface InductionLanguageVariant {
  languageCode: string;
  label: string;
  templateName: string | null;
  templateDescription: string | null;
  acknowledgementLabel: string | null;
  questions: InductionLanguageQuestionOverride[];
}

export interface InductionLanguageConfig {
  version: 1;
  defaultLanguage: string;
  variants: InductionLanguageVariant[];
}

export interface InductionLanguageChoice {
  code: string;
  label: string;
}

const DEFAULT_LANGUAGE_CODE = "en";
const MAX_LANGUAGE_VARIANTS = 10;
const MAX_QUESTION_OVERRIDES = 200;
const MAX_OPTION_LABELS = 20;
const LANGUAGE_CODE_REGEX = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

const KNOWN_LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  mi: "Te Reo Maori",
  zh: "Chinese",
  "zh-cn": "Chinese (Simplified)",
  "zh-hant": "Chinese (Traditional)",
  hi: "Hindi",
  fil: "Filipino",
  tl: "Tagalog",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ar: "Arabic",
};

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

export function normalizeLanguageCode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/_/g, "-").toLowerCase();
  if (!normalized || !LANGUAGE_CODE_REGEX.test(normalized)) {
    return null;
  }

  return normalized;
}

function defaultLanguageLabel(languageCode: string): string {
  return KNOWN_LANGUAGE_LABELS[languageCode] ?? languageCode.toUpperCase();
}

function normalizeOptionLabels(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const labels = value
    .slice(0, MAX_OPTION_LABELS)
    .map((entry) => normalizeString(entry, 200))
    .filter((entry): entry is string => entry !== null);

  return labels.length > 0 ? labels : null;
}

function normalizeQuestionOverride(
  value: unknown,
): InductionLanguageQuestionOverride | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const objectValue = value as Record<string, unknown>;
  const questionId = normalizeString(objectValue.questionId, 80);
  if (!questionId) {
    return null;
  }

  const questionText = normalizeString(objectValue.questionText, 500);
  const optionLabels = normalizeOptionLabels(
    objectValue.optionLabels ?? objectValue.options,
  );

  if (!questionText && !optionLabels) {
    return null;
  }

  return {
    questionId,
    questionText,
    optionLabels,
  };
}

function normalizeLanguageVariant(
  value: unknown,
): InductionLanguageVariant | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const objectValue = value as Record<string, unknown>;
  const languageCode = normalizeLanguageCode(
    objectValue.languageCode ?? objectValue.code,
  );
  if (!languageCode) {
    return null;
  }

  const label =
    normalizeString(objectValue.label, 80) ?? defaultLanguageLabel(languageCode);
  const templateName = normalizeString(objectValue.templateName, 120);
  const templateDescription = normalizeString(objectValue.templateDescription, 500);
  const acknowledgementLabel = normalizeString(
    objectValue.acknowledgementLabel,
    200,
  );
  const rawQuestions = Array.isArray(objectValue.questions)
    ? objectValue.questions
    : Array.isArray(objectValue.questionOverrides)
      ? objectValue.questionOverrides
      : [];

  const dedupedQuestions = new Map<string, InductionLanguageQuestionOverride>();
  for (const rawQuestion of rawQuestions.slice(0, MAX_QUESTION_OVERRIDES)) {
    const normalized = normalizeQuestionOverride(rawQuestion);
    if (!normalized) {
      continue;
    }
    dedupedQuestions.set(normalized.questionId, normalized);
  }

  const hasContent =
    templateName !== null ||
    templateDescription !== null ||
    acknowledgementLabel !== null ||
    dedupedQuestions.size > 0;

  if (!hasContent) {
    return null;
  }

  return {
    languageCode,
    label,
    templateName,
    templateDescription,
    acknowledgementLabel,
    questions: [...dedupedQuestions.values()],
  };
}

export function parseInductionLanguageConfig(
  input: unknown,
): InductionLanguageConfig {
  const fallback: InductionLanguageConfig = {
    version: 1,
    defaultLanguage: DEFAULT_LANGUAGE_CODE,
    variants: [],
  };

  let objectInput: Record<string, unknown> | null = null;
  let rawVariants: unknown[] = [];

  if (Array.isArray(input)) {
    rawVariants = input;
  } else if (input && typeof input === "object") {
    objectInput = input as Record<string, unknown>;
    if (Array.isArray(objectInput.variants)) {
      rawVariants = objectInput.variants;
    }
  } else {
    return fallback;
  }

  const defaultLanguage =
    normalizeLanguageCode(objectInput?.defaultLanguage) ?? DEFAULT_LANGUAGE_CODE;

  const dedupedVariants = new Map<string, InductionLanguageVariant>();
  for (const rawVariant of rawVariants.slice(0, MAX_LANGUAGE_VARIANTS)) {
    const normalized = normalizeLanguageVariant(rawVariant);
    if (!normalized) {
      continue;
    }
    if (!dedupedVariants.has(normalized.languageCode)) {
      dedupedVariants.set(normalized.languageCode, normalized);
    }
  }

  return {
    version: 1,
    defaultLanguage,
    variants: [...dedupedVariants.values()],
  };
}

export function getInductionLanguageChoices(
  config: InductionLanguageConfig,
): InductionLanguageChoice[] {
  const choices: InductionLanguageChoice[] = [];
  const seen = new Set<string>();

  const defaultVariant = config.variants.find(
    (variant) => variant.languageCode === config.defaultLanguage,
  );
  choices.push({
    code: config.defaultLanguage,
    label: defaultVariant?.label ?? defaultLanguageLabel(config.defaultLanguage),
  });
  seen.add(config.defaultLanguage);

  for (const variant of config.variants) {
    if (seen.has(variant.languageCode)) {
      continue;
    }
    seen.add(variant.languageCode);
    choices.push({
      code: variant.languageCode,
      label: variant.label,
    });
  }

  return choices;
}

export function resolveInductionLanguageSelection(
  config: InductionLanguageConfig,
  requestedLanguageCode: unknown,
): string {
  const requested = normalizeLanguageCode(requestedLanguageCode);
  if (!requested) {
    return config.defaultLanguage;
  }

  const isKnownLanguage = getInductionLanguageChoices(config).some(
    (choice) => choice.code === requested,
  );
  return isKnownLanguage ? requested : config.defaultLanguage;
}

export function getInductionLanguageVariant(
  config: InductionLanguageConfig,
  languageCode: unknown,
): InductionLanguageVariant | null {
  const normalizedCode = normalizeLanguageCode(languageCode);
  if (!normalizedCode) {
    return null;
  }

  return (
    config.variants.find((variant) => variant.languageCode === normalizedCode) ??
    null
  );
}

export function hasInductionLanguageVariants(
  config: InductionLanguageConfig,
): boolean {
  return getInductionLanguageChoices(config).length > 1;
}
