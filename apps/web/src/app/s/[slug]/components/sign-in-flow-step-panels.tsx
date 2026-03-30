"use client";

interface LanguageChoice {
  code: string;
  label: string;
}

interface MediaBlock {
  id: string;
  title: string;
  type: "TEXT" | "PDF" | "IMAGE";
  body?: string | null;
  url?: string | null;
}

interface LanguageSelectionPanelProps {
  enabled: boolean;
  selectedLanguageCode: string;
  languageChoices: LanguageChoice[];
  onLanguageChange: (code: string) => void;
}

interface InductionTemplatePanelProps {
  title: string;
  description?: string | null;
}

interface InductionMediaPanelProps {
  enabled: boolean;
  mediaBlocks: MediaBlock[];
  acknowledgementRequired: boolean;
  mediaAcknowledged: boolean;
  acknowledgementLabel: string;
  acknowledgementError?: string;
  onAcknowledgementChange: (checked: boolean) => void;
}

export function LanguageSelectionPanel({
  enabled,
  selectedLanguageCode,
  languageChoices,
  onLanguageChange,
}: LanguageSelectionPanelProps) {
  if (!enabled) {
    return null;
  }

  return (
    <section className="mb-5 rounded-xl border border-cyan-400/35 bg-cyan-500/12 p-4">
      <h3 className="text-base font-semibold text-cyan-950 dark:text-cyan-100">
        Language
      </h3>
      <p className="mt-1 text-xs text-cyan-900 dark:text-cyan-200">
        Choose your preferred language for induction content.
      </p>
      <label className="mt-3 block text-sm text-cyan-950 dark:text-cyan-100">
        Induction language
        <select
          value={selectedLanguageCode}
          onChange={(event) => onLanguageChange(event.target.value)}
          className="input mt-1 text-base"
        >
          {languageChoices.map((choice) => (
            <option key={choice.code} value={choice.code}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function InductionTemplatePanel({
  title,
  description,
}: InductionTemplatePanelProps) {
  return (
    <section className="mb-5 rounded-xl border border-surface-soft bg-surface-soft p-4">
      <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-1 text-sm text-secondary">{description}</p>
      ) : null}
    </section>
  );
}

export function InductionMediaPanel({
  enabled,
  mediaBlocks,
  acknowledgementRequired,
  mediaAcknowledged,
  acknowledgementLabel,
  acknowledgementError,
  onAcknowledgementChange,
}: InductionMediaPanelProps) {
  if (!enabled || mediaBlocks.length === 0) {
    return null;
  }

  return (
    <section className="mt-6 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
      <h3 className="text-base font-semibold text-indigo-950 dark:text-indigo-100">
        Induction material
      </h3>
      <p className="mt-1 text-xs text-indigo-900 dark:text-indigo-200">
        Review the content below before confirming your induction.
      </p>

      <div className="mt-3 space-y-3">
        {mediaBlocks.map((block) => (
          <article
            key={block.id}
            className="rounded-lg border border-indigo-300/35 bg-surface-strong p-3 shadow-soft"
          >
            <p className="text-sm font-semibold text-[color:var(--text-primary)]">
              {block.title}
            </p>

            {block.type === "TEXT" && block.body ? (
              <p className="mt-2 text-sm leading-relaxed text-secondary">
                {block.body}
              </p>
            ) : null}

            {block.type === "PDF" && block.url ? (
              <div className="mt-2 space-y-2">
                <iframe
                  src={block.url}
                  title={block.title}
                  className="h-64 w-full rounded-md border border-[color:var(--border-soft)] bg-[color:var(--bg-surface)]"
                />
                <a
                  href={block.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Open PDF in new tab
                </a>
              </div>
            ) : null}

            {block.type === "IMAGE" && block.url ? (
              <div className="mt-2 space-y-2">
                <img
                  src={block.url}
                  alt={block.title}
                  className="max-h-80 w-full rounded-md border border-[color:var(--border-soft)] object-contain bg-[color:var(--bg-surface)]"
                  loading="lazy"
                />
                <a
                  href={block.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[40px] items-center rounded-md border border-indigo-300 bg-[color:var(--bg-surface)] px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-50"
                >
                  Open image
                </a>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {acknowledgementRequired ? (
        <div className="mt-4 rounded-lg border border-indigo-300/35 bg-surface-soft p-3">
          <label className="flex items-start gap-2 text-sm text-indigo-950">
            <input
              type="checkbox"
              checked={mediaAcknowledged}
              onChange={(event) => onAcknowledgementChange(event.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>{acknowledgementLabel}</span>
          </label>
          {acknowledgementError ? (
            <p className="mt-1 text-xs text-red-700">{acknowledgementError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
