/**
 * Template Editor Page
 *
 * View and edit template details and questions.
 * Supports question builder for draft templates.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { checkAuthReadOnly, checkPermissionReadOnly } from "@/lib/auth";
import { findTemplateWithQuestions } from "@/lib/repository";
import { QuestionBuilder } from "./question-builder";
import { TemplateHeader } from "./template-header";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return {
    title: `Template ${id} | InductLite`,
  };
}

export default async function TemplateEditorPage({ params }: Props) {
  const { id } = await params;

  const guard = await checkAuthReadOnly();
  if (!guard.success) {
    return (
      <div className="space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Template Editor
          </h1>
          <p className="mt-1 text-sm text-secondary">
            View and update template metadata and questions.
          </p>
        </div>
        <div className="rounded-xl border border-red-400/45 bg-red-100/70 p-4 dark:bg-red-950/45">
          <p className="text-sm text-red-900 dark:text-red-200">{guard.error}</p>
        </div>
      </div>
    );
  }

  let dataLoadFailed = false;
  let canManageTemplates = false;
  let template: Awaited<ReturnType<typeof findTemplateWithQuestions>> = null;

  try {
    const [canManage, loadedTemplate] = await Promise.all([
      checkPermissionReadOnly("template:manage"),
      findTemplateWithQuestions(guard.user.companyId, id),
    ]);
    canManageTemplates = canManage.success;
    template = loadedTemplate;
  } catch (error) {
    dataLoadFailed = true;
    console.error("[template-editor] failed to load template", error);
    const canManage = await checkPermissionReadOnly("template:manage").catch(
      () => ({
        success: false,
        error: "Permission check failed",
        code: "FORBIDDEN" as const,
      }),
    );
    canManageTemplates = canManage.success;
  }

  if (dataLoadFailed) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-3 sm:p-4">
        <div className="surface-panel-strong p-5">
          <h1 className="kinetic-title text-2xl font-black text-[color:var(--text-primary)]">
            Template Editor
          </h1>
          <p className="mt-1 text-sm text-secondary">
            View and update template metadata and questions.
          </p>
        </div>
        <div>
          <Link
            href="/admin/templates"
            className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
          >
            Back to Templates
          </Link>
        </div>
        <div className="rounded-xl border border-amber-400/45 bg-amber-100/70 p-4 text-sm text-amber-900 dark:bg-amber-950/45 dark:text-amber-200">
          Template data could not be loaded. Please refresh and try again.
        </div>
      </div>
    );
  }

  if (!template) {
    notFound();
  }

  const isEditable = !template.is_archived && !template.is_published;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-3 sm:p-4">
      <div>
        <Link
          href="/admin/templates"
          className="btn-secondary min-h-[36px] px-3 py-1.5 text-xs"
        >
          Back to Templates
        </Link>
      </div>

      <TemplateHeader
        template={template}
        canManage={canManageTemplates}
        isEditable={isEditable}
      />

      <section className="surface-panel p-4">
        <h2 className="mb-4 text-lg font-semibold text-[color:var(--text-primary)]">
          Questions
        </h2>

        {template.questions.length === 0 && !isEditable ? (
          <div className="rounded-xl border border-[color:var(--border-soft)] bg-[color:var(--bg-surface-strong)] py-8 text-center">
            <p className="text-sm text-muted">No questions in this template</p>
          </div>
        ) : (
          <QuestionBuilder
            templateId={template.id}
            questions={template.questions}
            isEditable={isEditable && canManageTemplates}
          />
        )}
      </section>

      <section className="surface-panel p-4">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-secondary">
          Template Information
        </h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted">Created</dt>
            <dd className="text-[color:var(--text-primary)]">
              {template.created_at.toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Last Updated</dt>
            <dd className="text-[color:var(--text-primary)]">
              {template.updated_at.toLocaleDateString()}
            </dd>
          </div>
          {template.published_at && (
            <div>
              <dt className="text-muted">Published</dt>
              <dd className="text-[color:var(--text-primary)]">
                {template.published_at.toLocaleDateString()}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-muted">Scope</dt>
            <dd className="text-[color:var(--text-primary)]">
              {template.site ? template.site.name : "Company-wide"}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
