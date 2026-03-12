"use client";

/**
 * Template Header Component
 *
 * Shows template name, version, status, and action buttons.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Prisma } from "@prisma/client";
import {
  publishTemplateAction,
  archiveTemplateAction,
  createNewVersionAction,
  updateTemplateAction,
} from "../actions";
import type { TemplateWithQuestions } from "@/lib/repository";
import {
  hasInductionMedia,
  parseInductionMediaConfig,
  type InductionMediaBlock,
  type InductionMediaBlockType,
} from "@/lib/template/media-config";
import {
  getInductionLanguageChoices,
  hasInductionLanguageVariants,
  parseInductionLanguageConfig,
  type InductionLanguageQuestionOverride,
  type InductionLanguageVariant,
} from "@/lib/template/language-config";

interface Props {
  template: TemplateWithQuestions;
  canManage: boolean;
  isEditable: boolean;
}

type LanguageEditorMode = "guided" | "json";
type MediaEditorMode = "guided" | "json";

interface EditableMediaBlock {
  id: string;
  type: InductionMediaBlockType;
  title: string;
  body: string;
  url: string;
}

interface EditableLanguageQuestionOverride {
  id: string;
  questionId: string;
  questionText: string;
  optionLabelsText: string;
}

interface EditableLanguageVariant {
  id: string;
  languageCode: string;
  label: string;
  templateName: string;
  templateDescription: string;
  acknowledgementLabel: string;
  questions: EditableLanguageQuestionOverride[];
}

function createEditorId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toEditableMediaBlocks(blocks: InductionMediaBlock[]): EditableMediaBlock[] {
  return blocks.map((block) => ({
    id: block.id || createEditorId("media"),
    type: block.type,
    title: block.title,
    body: block.body ?? "",
    url: block.url ?? "",
  }));
}

function toMediaBlockPayload(blocks: EditableMediaBlock[]): Array<{
  id: string;
  type: InductionMediaBlockType;
  title: string;
  body?: string;
  url?: string;
}> {
  return blocks.map((block) => ({
    id: block.id,
    type: block.type,
    title: block.title,
    body: block.body.trim() || undefined,
    url: block.url.trim() || undefined,
  }));
}

function serializeOptionLabelsText(labels: string[] | null | undefined): string {
  if (!labels || labels.length === 0) {
    return "";
  }
  return labels.join(", ");
}

function parseOptionLabelsText(value: string): string[] | undefined {
  const parts = value
    .split(/[\n,|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return undefined;
  }

  return parts;
}

function toEditableLanguageVariants(
  variants: InductionLanguageVariant[],
): EditableLanguageVariant[] {
  return variants.map((variant) => ({
    id: createEditorId("lang"),
    languageCode: variant.languageCode,
    label: variant.label,
    templateName: variant.templateName ?? "",
    templateDescription: variant.templateDescription ?? "",
    acknowledgementLabel: variant.acknowledgementLabel ?? "",
    questions: variant.questions.map((question) => ({
      id: createEditorId("lang-q"),
      questionId: question.questionId,
      questionText: question.questionText ?? "",
      optionLabelsText: serializeOptionLabelsText(question.optionLabels),
    })),
  }));
}

function toLanguageVariantPayload(
  variants: EditableLanguageVariant[],
): Array<{
  languageCode: string;
  label: string;
  templateName?: string;
  templateDescription?: string;
  acknowledgementLabel?: string;
  questions: InductionLanguageQuestionOverride[];
}> {
  return variants.map((variant) => ({
    languageCode: variant.languageCode.trim(),
    label: variant.label.trim(),
    templateName: variant.templateName.trim() || undefined,
    templateDescription: variant.templateDescription.trim() || undefined,
    acknowledgementLabel: variant.acknowledgementLabel.trim() || undefined,
    questions: variant.questions
      .map((question) => {
        const optionLabels = parseOptionLabelsText(question.optionLabelsText);
        return {
          questionId: question.questionId.trim(),
          questionText: question.questionText.trim() || null,
          optionLabels: optionLabels ?? null,
        };
      })
      .filter((question) => question.questionId.length > 0),
  }));
}

function StatusBadge({
  isPublished,
  isArchived,
  isDefault,
}: {
  isPublished: boolean;
  isArchived: boolean;
  isDefault: boolean;
}) {
  if (isArchived) {
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]">
        Archived (Read-only)
      </span>
    );
  }
  if (isPublished) {
    return (
      <div className="flex gap-2">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          Published
        </span>
        {isDefault && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[color:var(--bg-surface-strong)] text-accent">
            Company Default
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
      Draft
    </span>
  );
}

export function TemplateHeader({ template, canManage, isEditable }: Props) {
  const initialMediaConfig = parseInductionMediaConfig(template.induction_media);
  const initialLanguageConfig = parseInductionLanguageConfig(
    template.induction_languages,
  );
  const initialLanguageChoices = getInductionLanguageChoices(initialLanguageConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [isDefault, setIsDefault] = useState(template.is_default);
  const [quizScoringEnabled, setQuizScoringEnabled] = useState(
    template.quiz_scoring_enabled,
  );
  const [quizPassThreshold, setQuizPassThreshold] = useState(
    template.quiz_pass_threshold,
  );
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(
    template.quiz_max_attempts,
  );
  const [quizCooldownMinutes, setQuizCooldownMinutes] = useState(
    template.quiz_cooldown_minutes,
  );
  const [quizRequiredForEntry, setQuizRequiredForEntry] = useState(
    template.quiz_required_for_entry,
  );
  const [mediaEnabled, setMediaEnabled] = useState(
    hasInductionMedia(initialMediaConfig),
  );
  const [mediaEditorMode, setMediaEditorMode] = useState<MediaEditorMode>("guided");
  const [mediaBlocks, setMediaBlocks] = useState<EditableMediaBlock[]>(
    () => toEditableMediaBlocks(initialMediaConfig.blocks),
  );
  const [mediaBlocksJson, setMediaBlocksJson] = useState(
    JSON.stringify(initialMediaConfig.blocks, null, 2),
  );
  const [mediaRequireAcknowledgement, setMediaRequireAcknowledgement] = useState(
    initialMediaConfig.requireAcknowledgement,
  );
  const [mediaAcknowledgementLabel, setMediaAcknowledgementLabel] = useState(
    initialMediaConfig.acknowledgementLabel,
  );
  const [languageEnabled, setLanguageEnabled] = useState(
    hasInductionLanguageVariants(initialLanguageConfig),
  );
  const [defaultLanguageCode, setDefaultLanguageCode] = useState(
    initialLanguageConfig.defaultLanguage,
  );
  const [languageEditorMode, setLanguageEditorMode] =
    useState<LanguageEditorMode>("guided");
  const [languageVariants, setLanguageVariants] = useState<
    EditableLanguageVariant[]
  >(() => toEditableLanguageVariants(initialLanguageConfig.variants));
  const [languageVariantsJson, setLanguageVariantsJson] = useState(
    JSON.stringify(initialLanguageConfig.variants, null, 2),
  );
  const router = useRouter();

  function setGuidedMediaBlocks(nextBlocks: EditableMediaBlock[]) {
    setMediaBlocks(nextBlocks);
    setMediaBlocksJson(JSON.stringify(toMediaBlockPayload(nextBlocks), null, 2));
  }

  function addMediaBlock(type: InductionMediaBlockType) {
    const nextBlock: EditableMediaBlock = {
      id: createEditorId("media"),
      type,
      title:
        type === "PDF"
          ? "Induction Document"
          : type === "IMAGE"
            ? "Induction Image"
            : "Induction Notes",
      body: "",
      url: "",
    };
    setGuidedMediaBlocks([...mediaBlocks, nextBlock]);
  }

  function updateMediaBlock(
    blockId: string,
    patch: Partial<EditableMediaBlock>,
  ) {
    setGuidedMediaBlocks(
      mediaBlocks.map((block) =>
        block.id === blockId ? { ...block, ...patch } : block,
      ),
    );
  }

  function removeMediaBlock(blockId: string) {
    setGuidedMediaBlocks(mediaBlocks.filter((block) => block.id !== blockId));
  }

  function moveMediaBlock(blockId: string, direction: "up" | "down") {
    const currentIndex = mediaBlocks.findIndex((block) => block.id === blockId);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= mediaBlocks.length) {
      return;
    }
    const reordered = [...mediaBlocks];
    const [moved] = reordered.splice(currentIndex, 1);
    if (!moved) {
      return;
    }
    reordered.splice(nextIndex, 0, moved);
    setGuidedMediaBlocks(reordered);
  }

  function setGuidedLanguageVariants(nextVariants: EditableLanguageVariant[]) {
    setLanguageVariants(nextVariants);
    setLanguageVariantsJson(
      JSON.stringify(toLanguageVariantPayload(nextVariants), null, 2),
    );
  }

  function addLanguageVariant() {
    setGuidedLanguageVariants([
      ...languageVariants,
      {
        id: createEditorId("lang"),
        languageCode: "",
        label: "",
        templateName: "",
        templateDescription: "",
        acknowledgementLabel: "",
        questions: [],
      },
    ]);
  }

  function updateLanguageVariant(
    variantId: string,
    patch: Partial<EditableLanguageVariant>,
  ) {
    setGuidedLanguageVariants(
      languageVariants.map((variant) =>
        variant.id === variantId ? { ...variant, ...patch } : variant,
      ),
    );
  }

  function removeLanguageVariant(variantId: string) {
    setGuidedLanguageVariants(
      languageVariants.filter((variant) => variant.id !== variantId),
    );
  }

  function addQuestionOverride(variantId: string) {
    const defaultQuestionId = template.questions[0]?.id ?? "";
    setGuidedLanguageVariants(
      languageVariants.map((variant) => {
        if (variant.id !== variantId) {
          return variant;
        }
        return {
          ...variant,
          questions: [
            ...variant.questions,
            {
              id: createEditorId("lang-q"),
              questionId: defaultQuestionId,
              questionText: "",
              optionLabelsText: "",
            },
          ],
        };
      }),
    );
  }

  function updateQuestionOverride(
    variantId: string,
    questionOverrideId: string,
    patch: Partial<EditableLanguageQuestionOverride>,
  ) {
    setGuidedLanguageVariants(
      languageVariants.map((variant) => {
        if (variant.id !== variantId) {
          return variant;
        }
        return {
          ...variant,
          questions: variant.questions.map((question) =>
            question.id === questionOverrideId
              ? { ...question, ...patch }
              : question,
          ),
        };
      }),
    );
  }

  function removeQuestionOverride(variantId: string, questionOverrideId: string) {
    setGuidedLanguageVariants(
      languageVariants.map((variant) => {
        if (variant.id !== variantId) {
          return variant;
        }
        return {
          ...variant,
          questions: variant.questions.filter(
            (question) => question.id !== questionOverrideId,
          ),
        };
      }),
    );
  }

  async function handlePublish() {
    if (
      !confirm(
        `Publish "${template.name}" v${template.version}? This will make it the active version.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await publishTemplateAction(template.id);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleArchive() {
    if (
      !confirm(
        `Archive "${template.name}"? This will unpublish it and make it read-only.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await archiveTemplateAction(template.id);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleNewVersion() {
    setIsLoading(true);
    setError(null);

    const result = await createNewVersionAction(template.id);

    if (result.success) {
      router.push(`/admin/templates/${result.data.templateId}`);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  async function handleSave() {
    setIsLoading(true);
    setError(null);

    let inductionMediaInput: Prisma.InputJsonValue | null = null;
    if (mediaEnabled) {
      let parsedBlocks: unknown = [];
      if (mediaEditorMode === "json") {
        const trimmedJson = mediaBlocksJson.trim();
        if (trimmedJson.length > 0) {
          try {
            parsedBlocks = JSON.parse(trimmedJson);
          } catch {
            setError("Media blocks must be valid JSON.");
            setIsLoading(false);
            return;
          }
        }
      } else {
        parsedBlocks = toMediaBlockPayload(mediaBlocks);
      }

      const normalizedMedia = parseInductionMediaConfig({
        blocks: parsedBlocks,
        requireAcknowledgement: mediaRequireAcknowledgement,
        acknowledgementLabel: mediaAcknowledgementLabel,
      });

      if (!hasInductionMedia(normalizedMedia)) {
        setError("Add at least one media block or disable media-first mode.");
        setIsLoading(false);
        return;
      }

      inductionMediaInput = normalizedMedia as unknown as Prisma.InputJsonValue;
    }

    let inductionLanguageInput: Prisma.InputJsonValue | null = null;
    if (languageEnabled) {
      let parsedVariants: unknown = [];
      if (languageEditorMode === "json") {
        const trimmedJson = languageVariantsJson.trim();
        if (trimmedJson.length > 0) {
          try {
            parsedVariants = JSON.parse(trimmedJson);
          } catch {
            setError("Language variants must be valid JSON.");
            setIsLoading(false);
            return;
          }
        }
      } else {
        parsedVariants = toLanguageVariantPayload(languageVariants);
      }

      const normalizedLanguages = parseInductionLanguageConfig({
        defaultLanguage: defaultLanguageCode,
        variants: parsedVariants,
      });

      if (!hasInductionLanguageVariants(normalizedLanguages)) {
        setError(
          "Add at least one non-default language variant or disable multi-language mode.",
        );
        setIsLoading(false);
        return;
      }

      inductionLanguageInput =
        normalizedLanguages as unknown as Prisma.InputJsonValue;
    }

    const result = await updateTemplateAction(template.id, {
      name,
      description: description || undefined,
      is_default: isDefault,
      quiz_scoring_enabled: quizScoringEnabled,
      quiz_pass_threshold: quizPassThreshold,
      quiz_max_attempts: quizMaxAttempts,
      quiz_cooldown_minutes: quizCooldownMinutes,
      quiz_required_for_entry: quizRequiredForEntry,
      induction_media: inductionMediaInput,
      induction_languages: inductionLanguageInput,
    });

    if (result.success) {
      setIsEditing(false);
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="surface-panel-strong p-6">
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-[color:var(--border-soft)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[color:var(--accent-primary)] focus:border-[color:var(--accent-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full border border-[color:var(--border-soft)] rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[color:var(--accent-primary)] focus:border-[color:var(--accent-primary)]"
            />
          </div>
          {template.site_id === null && (
            <div className="flex items-center">
              <input
                id="is-default"
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded"
              />
              <label
                htmlFor="is-default"
                className="ml-2 block text-sm text-secondary"
              >
                Set as company default template
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="btn-primary disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setName(template.name);
                setDescription(template.description || "");
                setIsDefault(template.is_default);
                setQuizScoringEnabled(template.quiz_scoring_enabled);
                setQuizPassThreshold(template.quiz_pass_threshold);
                setQuizMaxAttempts(template.quiz_max_attempts);
                setQuizCooldownMinutes(template.quiz_cooldown_minutes);
                setQuizRequiredForEntry(template.quiz_required_for_entry);
                setMediaEnabled(hasInductionMedia(initialMediaConfig));
                setMediaEditorMode("guided");
                setMediaBlocks(toEditableMediaBlocks(initialMediaConfig.blocks));
                setMediaBlocksJson(JSON.stringify(initialMediaConfig.blocks, null, 2));
                setMediaRequireAcknowledgement(
                  initialMediaConfig.requireAcknowledgement,
                );
                setMediaAcknowledgementLabel(
                  initialMediaConfig.acknowledgementLabel,
                );
                setLanguageEnabled(
                  hasInductionLanguageVariants(initialLanguageConfig),
                );
                setDefaultLanguageCode(initialLanguageConfig.defaultLanguage);
                setLanguageEditorMode("guided");
                setLanguageVariants(
                  toEditableLanguageVariants(initialLanguageConfig.variants),
                );
                setLanguageVariantsJson(
                  JSON.stringify(initialLanguageConfig.variants, null, 2),
                );
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>

          <div className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Quiz Scoring</h3>
            <div className="mt-3 flex items-center">
              <input
                id="quiz-scoring-enabled"
                type="checkbox"
                checked={quizScoringEnabled}
                onChange={(event) => setQuizScoringEnabled(event.target.checked)}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded"
              />
              <label
                htmlFor="quiz-scoring-enabled"
                className="ml-2 block text-sm text-secondary"
              >
                Enable quiz scoring (pass/fail)
              </label>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-sm text-secondary">
                Pass threshold (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={quizPassThreshold}
                  onChange={(event) =>
                    setQuizPassThreshold(Number(event.target.value || 80))
                  }
                  disabled={!quizScoringEnabled}
                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                />
              </label>
              <label className="text-sm text-secondary">
                Max attempts
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={quizMaxAttempts}
                  onChange={(event) =>
                    setQuizMaxAttempts(Number(event.target.value || 3))
                  }
                  disabled={!quizScoringEnabled}
                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                />
              </label>
              <label className="text-sm text-secondary">
                Cooldown (minutes)
                <input
                  type="number"
                  min={0}
                  max={1440}
                  value={quizCooldownMinutes}
                  onChange={(event) =>
                    setQuizCooldownMinutes(Number(event.target.value || 0))
                  }
                  disabled={!quizScoringEnabled}
                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                />
              </label>
            </div>

            <div className="mt-3 flex items-center">
              <input
                id="quiz-required-for-entry"
                type="checkbox"
                checked={quizRequiredForEntry}
                onChange={(event) => setQuizRequiredForEntry(event.target.checked)}
                disabled={!quizScoringEnabled}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded disabled:opacity-60"
              />
              <label
                htmlFor="quiz-required-for-entry"
                className="ml-2 block text-sm text-secondary"
              >
                Block site entry when quiz score is below threshold
              </label>
            </div>
          </div>

          <div className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
              Media-First Induction
            </h3>
            <div className="mt-3 flex items-center">
              <input
                id="media-enabled"
                type="checkbox"
                checked={mediaEnabled}
                onChange={(event) => setMediaEnabled(event.target.checked)}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded"
              />
              <label
                htmlFor="media-enabled"
                className="ml-2 block text-sm text-secondary"
              >
                Show media blocks before induction questions
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!mediaEnabled}
                onClick={() => {
                  if (mediaEditorMode === "json") {
                    const trimmedJson = mediaBlocksJson.trim();
                    if (trimmedJson.length > 0) {
                      try {
                        const parsedJson = JSON.parse(trimmedJson);
                        const normalized = parseInductionMediaConfig({
                          blocks: parsedJson,
                          requireAcknowledgement: mediaRequireAcknowledgement,
                          acknowledgementLabel: mediaAcknowledgementLabel,
                        });
                        setGuidedMediaBlocks(
                          toEditableMediaBlocks(normalized.blocks),
                        );
                        setError(null);
                      } catch {
                        setError("Media blocks JSON is invalid.");
                        return;
                      }
                    } else {
                      setGuidedMediaBlocks([]);
                    }
                  }
                  setMediaEditorMode("guided");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mediaEditorMode === "guided"
                    ? "bg-[color:var(--accent-primary)] text-white"
                    : "bg-[color:var(--bg-surface-strong)] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
                } disabled:opacity-60`}
              >
                Guided editor
              </button>
              <button
                type="button"
                disabled={!mediaEnabled}
                onClick={() => setMediaEditorMode("json")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mediaEditorMode === "json"
                    ? "bg-[color:var(--accent-primary)] text-white"
                    : "bg-[color:var(--bg-surface-strong)] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
                } disabled:opacity-60`}
              >
                Advanced JSON
              </button>
            </div>

            {mediaEditorMode === "guided" ? (
              <div className="mt-3 space-y-3">
                {mediaBlocks.length === 0 && (
                  <p className="rounded-md border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3 text-xs text-muted">
                    No media blocks configured yet.
                  </p>
                )}

                {mediaBlocks.map((block, blockIndex) => (
                  <div
                    key={block.id}
                    className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                        Block {blockIndex + 1}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveMediaBlock(block.id, "up")}
                          className="text-xs font-semibold text-secondary hover:text-[color:var(--text-primary)]"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMediaBlock(block.id, "down")}
                          className="text-xs font-semibold text-secondary hover:text-[color:var(--text-primary)]"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMediaBlock(block.id)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-secondary">
                        Type
                        <select
                          value={block.type}
                          onChange={(event) =>
                            updateMediaBlock(block.id, {
                              type: event.target
                                .value as EditableMediaBlock["type"],
                            })
                          }
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        >
                          <option value="TEXT">TEXT</option>
                          <option value="PDF">PDF</option>
                          <option value="IMAGE">IMAGE</option>
                        </select>
                      </label>
                      <label className="text-xs text-secondary">
                        Title
                        <input
                          type="text"
                          value={block.title}
                          onChange={(event) =>
                            updateMediaBlock(block.id, {
                              title: event.target.value,
                            })
                          }
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>

                      {block.type === "TEXT" ? (
                        <label className="text-xs text-secondary sm:col-span-2">
                          Text body
                          <textarea
                            value={block.body}
                            onChange={(event) =>
                              updateMediaBlock(block.id, {
                                body: event.target.value,
                              })
                            }
                            rows={3}
                            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                          />
                        </label>
                      ) : (
                        <label className="text-xs text-secondary sm:col-span-2">
                          Media URL
                          <input
                            type="url"
                            value={block.url}
                            onChange={(event) =>
                              updateMediaBlock(block.id, {
                                url: event.target.value,
                              })
                            }
                            placeholder="https://example.com/file.pdf"
                            className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => addMediaBlock("TEXT")}
                    disabled={!mediaEnabled}
                    className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-xs font-semibold text-accent hover:bg-[color:var(--bg-surface-strong)] disabled:opacity-60"
                  >
                    Add TEXT block
                  </button>
                  <button
                    type="button"
                    onClick={() => addMediaBlock("PDF")}
                    disabled={!mediaEnabled}
                    className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-xs font-semibold text-accent hover:bg-[color:var(--bg-surface-strong)] disabled:opacity-60"
                  >
                    Add PDF block
                  </button>
                  <button
                    type="button"
                    onClick={() => addMediaBlock("IMAGE")}
                    disabled={!mediaEnabled}
                    className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-xs font-semibold text-accent hover:bg-[color:var(--bg-surface-strong)] disabled:opacity-60"
                  >
                    Add IMAGE block
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label className="mt-3 block text-sm text-secondary">
                  Media blocks JSON
                  <textarea
                    value={mediaBlocksJson}
                    onChange={(event) => setMediaBlocksJson(event.target.value)}
                    rows={8}
                    disabled={!mediaEnabled}
                    className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm font-mono disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                    placeholder='[{"type":"PDF","title":"Site Rules","url":"https://example.com/rules.pdf"},{"type":"TEXT","title":"Daily briefing","body":"Read this before entering."}]'
                  />
                </label>
                <p className="mt-1 text-xs text-muted">
                  Supported block types:
                  <code className="mx-1 rounded bg-[color:var(--bg-surface-strong)] px-1">TEXT</code>,
                  <code className="mx-1 rounded bg-[color:var(--bg-surface-strong)] px-1">PDF</code>,
                  <code className="mx-1 rounded bg-[color:var(--bg-surface-strong)] px-1">IMAGE</code>.
                </p>
              </>
            )}

            <div className="mt-3 flex items-center">
              <input
                id="media-ack-required"
                type="checkbox"
                checked={mediaRequireAcknowledgement}
                onChange={(event) =>
                  setMediaRequireAcknowledgement(event.target.checked)
                }
                disabled={!mediaEnabled}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded disabled:opacity-60"
              />
              <label
                htmlFor="media-ack-required"
                className="ml-2 block text-sm text-secondary"
              >
                Require acknowledgement before continuing
              </label>
            </div>

            <label className="mt-3 block text-sm text-secondary">
              Acknowledgement label
              <input
                type="text"
                value={mediaAcknowledgementLabel}
                onChange={(event) =>
                  setMediaAcknowledgementLabel(event.target.value)
                }
                maxLength={200}
                disabled={!mediaEnabled}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                placeholder="I have reviewed the induction material before continuing."
              />
            </label>
          </div>

          <div className="rounded-lg border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-4">
            <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
              Multi-Language Packs
            </h3>
            <div className="mt-3 flex items-center">
              <input
                id="language-enabled"
                type="checkbox"
                checked={languageEnabled}
                onChange={(event) => setLanguageEnabled(event.target.checked)}
                className="h-4 w-4 text-accent focus:ring-[color:var(--accent-primary)] border-[color:var(--border-soft)] rounded"
              />
              <label
                htmlFor="language-enabled"
                className="ml-2 block text-sm text-secondary"
              >
                Enable language variants in public sign-in flow
              </label>
            </div>

            <label className="mt-3 block text-sm text-secondary">
              Default language code
              <input
                type="text"
                value={defaultLanguageCode}
                onChange={(event) => setDefaultLanguageCode(event.target.value)}
                maxLength={20}
                disabled={!languageEnabled}
                className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                placeholder="en"
              />
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!languageEnabled}
                onClick={() => {
                  if (languageEditorMode === "json") {
                    const trimmedJson = languageVariantsJson.trim();
                    if (trimmedJson.length > 0) {
                      try {
                        const parsedJson = JSON.parse(trimmedJson);
                        const normalized = parseInductionLanguageConfig({
                          defaultLanguage: defaultLanguageCode,
                          variants: parsedJson,
                        });
                        setGuidedLanguageVariants(
                          toEditableLanguageVariants(normalized.variants),
                        );
                        setError(null);
                      } catch {
                        setError("Language variants JSON is invalid.");
                        return;
                      }
                    } else {
                      setGuidedLanguageVariants([]);
                    }
                  }
                  setLanguageEditorMode("guided");
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  languageEditorMode === "guided"
                    ? "bg-[color:var(--accent-primary)] text-white"
                    : "bg-[color:var(--bg-surface-strong)] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
                } disabled:opacity-60`}
              >
                Guided editor
              </button>
              <button
                type="button"
                disabled={!languageEnabled}
                onClick={() => setLanguageEditorMode("json")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  languageEditorMode === "json"
                    ? "bg-[color:var(--accent-primary)] text-white"
                    : "bg-[color:var(--bg-surface-strong)] text-secondary hover:bg-[color:var(--bg-surface-strong)]"
                } disabled:opacity-60`}
              >
                Advanced JSON
              </button>
            </div>

            {languageEditorMode === "guided" ? (
              <div className="mt-3 space-y-3">
                {languageVariants.length === 0 && (
                  <p className="rounded-md border border-dashed border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3 text-xs text-muted">
                    No language variants configured yet. Add a variant to start.
                  </p>
                )}

                {languageVariants.map((variant, variantIndex) => (
                  <div
                    key={variant.id}
                    className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                        Variant {variantIndex + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeLanguageVariant(variant.id)}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs text-secondary">
                        Language code
                        <input
                          type="text"
                          value={variant.languageCode}
                          onChange={(event) =>
                            updateLanguageVariant(variant.id, {
                              languageCode: event.target.value,
                            })
                          }
                          placeholder="mi"
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-secondary">
                        Label
                        <input
                          type="text"
                          value={variant.label}
                          onChange={(event) =>
                            updateLanguageVariant(variant.id, {
                              label: event.target.value,
                            })
                          }
                          placeholder="Te Reo Maori"
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-secondary sm:col-span-2">
                        Template title override
                        <input
                          type="text"
                          value={variant.templateName}
                          onChange={(event) =>
                            updateLanguageVariant(variant.id, {
                              templateName: event.target.value,
                            })
                          }
                          placeholder="Localized template title"
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-secondary sm:col-span-2">
                        Template description override
                        <textarea
                          value={variant.templateDescription}
                          onChange={(event) =>
                            updateLanguageVariant(variant.id, {
                              templateDescription: event.target.value,
                            })
                          }
                          rows={2}
                          placeholder="Localized template description"
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>
                      <label className="text-xs text-secondary sm:col-span-2">
                        Media acknowledgement label override
                        <input
                          type="text"
                          value={variant.acknowledgementLabel}
                          onChange={(event) =>
                            updateLanguageVariant(variant.id, {
                              acknowledgementLabel: event.target.value,
                            })
                          }
                          placeholder="Localized acknowledgement label"
                          className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                        />
                      </label>
                    </div>

                    <div className="mt-3 rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-secondary">
                          Question overrides
                        </p>
                        <button
                          type="button"
                          onClick={() => addQuestionOverride(variant.id)}
                          className="text-xs font-semibold text-accent hover:text-accent"
                        >
                          Add question override
                        </button>
                      </div>

                      {variant.questions.length === 0 && (
                        <p className="text-xs text-muted">
                          No question overrides yet.
                        </p>
                      )}

                      <div className="space-y-2">
                        {variant.questions.map((questionOverride) => (
                          <div
                            key={questionOverride.id}
                            className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)] p-2"
                          >
                            <div className="grid gap-2 sm:grid-cols-2">
                              <label className="text-xs text-secondary">
                                Question
                                <select
                                  value={questionOverride.questionId}
                                  onChange={(event) =>
                                    updateQuestionOverride(
                                      variant.id,
                                      questionOverride.id,
                                      { questionId: event.target.value },
                                    )
                                  }
                                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                                >
                                  <option value="">Select question</option>
                                  {template.questions.map((question) => (
                                    <option key={question.id} value={question.id}>
                                      {question.display_order}. {question.question_text}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-secondary">
                                Option labels
                                <input
                                  type="text"
                                  value={questionOverride.optionLabelsText}
                                  onChange={(event) =>
                                    updateQuestionOverride(
                                      variant.id,
                                      questionOverride.id,
                                      {
                                        optionLabelsText: event.target.value,
                                      },
                                    )
                                  }
                                  placeholder="Comma separated labels"
                                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                                />
                              </label>
                              <label className="text-xs text-secondary sm:col-span-2">
                                Question text override
                                <input
                                  type="text"
                                  value={questionOverride.questionText}
                                  onChange={(event) =>
                                    updateQuestionOverride(
                                      variant.id,
                                      questionOverride.id,
                                      { questionText: event.target.value },
                                    )
                                  }
                                  placeholder="Localized question text"
                                  className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-2 py-1.5 text-sm"
                                />
                              </label>
                            </div>
                            <div className="mt-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  removeQuestionOverride(
                                    variant.id,
                                    questionOverride.id,
                                  )
                                }
                                className="text-xs font-semibold text-red-600 hover:text-red-700"
                              >
                                Remove override
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addLanguageVariant}
                  disabled={!languageEnabled}
                  className="rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] px-3 py-2 text-xs font-semibold text-accent hover:bg-[color:var(--bg-surface-strong)] disabled:opacity-60"
                >
                  Add language variant
                </button>
              </div>
            ) : (
              <>
                <label className="mt-3 block text-sm text-secondary">
                  Language variants JSON
                  <textarea
                    value={languageVariantsJson}
                    onChange={(event) =>
                      setLanguageVariantsJson(event.target.value)
                    }
                    rows={9}
                    disabled={!languageEnabled}
                    className="mt-1 block w-full rounded-md border border-[color:var(--border-soft)] px-3 py-2 text-sm font-mono disabled:bg-[color:var(--bg-surface-strong)] disabled:text-muted"
                    placeholder='[{"languageCode":"mi","label":"Te Reo Maori","templateName":"Whakauru Pae","acknowledgementLabel":"Kua panui ahau i nga rauemi.","questions":[{"questionId":"c123...","questionText":"Kei te mau koe i te PPE tika?"}]}]'
                  />
                </label>
                <p className="mt-1 text-xs text-muted">
                  Advanced mode accepts raw variant JSON and is best for bulk edits.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
                  {template.name}
                </h1>
                <span className="text-muted">v{template.version}</span>
              </div>
              {template.description && (
                <p className="mt-1 text-secondary">{template.description}</p>
              )}
              <div className="mt-3">
                <StatusBadge
                  isPublished={template.is_published}
                  isArchived={template.is_archived}
                  isDefault={template.is_default}
                />
              </div>
              <p className="mt-3 text-sm text-secondary">
                Quiz scoring:{" "}
                {template.quiz_scoring_enabled
                  ? `enabled (${template.quiz_pass_threshold}% pass, ${template.quiz_max_attempts} attempts, ${template.quiz_cooldown_minutes} min cooldown)`
                  : "disabled"}
              </p>
              <p className="mt-2 text-sm text-secondary">
                Media-first induction:{" "}
                {hasInductionMedia(initialMediaConfig)
                  ? `enabled (${initialMediaConfig.blocks.length} block${initialMediaConfig.blocks.length === 1 ? "" : "s"}${initialMediaConfig.requireAcknowledgement ? ", acknowledgement required" : ""})`
                  : "disabled"}
              </p>
              <p className="mt-2 text-sm text-secondary">
                Multi-language packs:{" "}
                {hasInductionLanguageVariants(initialLanguageConfig)
                  ? `enabled (${initialLanguageChoices.length} languages, default ${initialLanguageConfig.defaultLanguage})`
                  : "disabled"}
              </p>
            </div>

            {canManage && (
              <div className="flex gap-2">
                {isEditable && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary min-h-[36px] px-3 py-2 text-sm"
                    >
                      Edit Details
                    </button>
                    {template.questions.length > 0 && (
                      <button
                        onClick={handlePublish}
                        disabled={isLoading}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        {isLoading ? "Publishing..." : "Publish"}
                      </button>
                    )}
                  </>
                )}
                {template.is_published && !template.is_archived && (
                  <>
                    <button
                      onClick={handleNewVersion}
                      disabled={isLoading}
                      className="px-3 py-2 text-sm bg-[color:var(--accent-primary)] text-white rounded-md hover:brightness-95 disabled:opacity-50"
                    >
                      {isLoading ? "Creating..." : "New Version"}
                    </button>
                    <button
                      onClick={handleArchive}
                      disabled={isLoading}
                      className="px-3 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    >
                      {isLoading ? "Archiving..." : "Archive"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}


