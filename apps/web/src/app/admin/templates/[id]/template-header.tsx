"use client";

/**
 * Template Header Component
 *
 * Shows template name, version, status, and action buttons.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishTemplateAction,
  archiveTemplateAction,
  createNewVersionAction,
  updateTemplateAction,
} from "../actions";
import type { TemplateWithQuestions } from "@/lib/repository";

interface Props {
  template: TemplateWithQuestions;
  canManage: boolean;
  isEditable: boolean;
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
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
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
          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || "");
  const [isDefault, setIsDefault] = useState(template.is_default);
  const router = useRouter();

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

    const result = await updateTemplateAction(template.id, {
      name,
      description: description || undefined,
      is_default: isDefault,
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
    <div className="bg-white shadow rounded-lg p-6">
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {template.site_id === null && (
            <div className="flex items-center">
              <input
                id="is-default"
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label
                htmlFor="is-default"
                className="ml-2 block text-sm text-gray-700"
              >
                Set as company default template
              </label>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setName(template.name);
                setDescription(template.description || "");
                setIsDefault(template.is_default);
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  {template.name}
                </h1>
                <span className="text-gray-500">v{template.version}</span>
              </div>
              {template.description && (
                <p className="mt-1 text-gray-600">{template.description}</p>
              )}
              <div className="mt-3">
                <StatusBadge
                  isPublished={template.is_published}
                  isArchived={template.is_archived}
                  isDefault={template.is_default}
                />
              </div>
            </div>

            {canManage && (
              <div className="flex gap-2">
                {isEditable && (
                  <>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
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
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
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
