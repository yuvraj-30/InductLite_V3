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
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{guard.error}</p>
        </div>
      </div>
    );
  }

  const [canManage, template] = await Promise.all([
    checkPermissionReadOnly("template:manage"),
    findTemplateWithQuestions(guard.user.companyId, id),
  ]);
  const canManageTemplates = canManage.success;

  if (!template) {
    notFound();
  }

  const isEditable = !template.is_archived && !template.is_published;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/templates"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Templates
        </Link>
      </div>

      <TemplateHeader
        template={template}
        canManage={canManageTemplates}
        isEditable={isEditable}
      />

      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Questions</h2>

        {template.questions.length === 0 && !isEditable ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <p className="text-gray-500">No questions in this template</p>
          </div>
        ) : (
          <QuestionBuilder
            templateId={template.id}
            questions={template.questions}
            isEditable={isEditable && canManageTemplates}
          />
        )}
      </div>

      {/* Template Info */}
      <div className="mt-8 border-t pt-6">
        <h3 className="text-sm font-medium text-gray-500 mb-3">
          Template Information
        </h3>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">
              {template.created_at.toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Last Updated</dt>
            <dd className="text-gray-900">
              {template.updated_at.toLocaleDateString()}
            </dd>
          </div>
          {template.published_at && (
            <div>
              <dt className="text-gray-500">Published</dt>
              <dd className="text-gray-900">
                {template.published_at.toLocaleDateString()}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Scope</dt>
            <dd className="text-gray-900">
              {template.site ? template.site.name : "Company-wide"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
