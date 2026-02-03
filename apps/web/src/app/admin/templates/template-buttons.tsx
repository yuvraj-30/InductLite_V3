"use client";

/**
 * Template Action Buttons
 *
 * Client components for template management actions.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishTemplateAction,
  archiveTemplateAction,
  deleteTemplateAction,
  createNewVersionAction,
} from "./actions";
// Server actions must not be imported directly in Client Components.
// Use server actions via form actions or pass as props from a Server Component.

interface ButtonProps {
  templateId: string;
  templateName: string;
}

export function PublishTemplateButton({
  templateId,
  templateName,
}: ButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handlePublish() {
    if (
      !confirm(
        `Are you sure you want to publish "${templateName}"? This will make it the active version.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await publishTemplateAction(templateId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handlePublish}
        disabled={isLoading}
        className="text-green-600 hover:text-green-900 disabled:opacity-50"
      >
        {isLoading ? "Publishing..." : "Publish"}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}

export function ArchiveTemplateButton({
  templateId,
  templateName,
}: ButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleArchive() {
    if (
      !confirm(
        `Are you sure you want to archive "${templateName}"? This will unpublish it and make it read-only.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await archiveTemplateAction(templateId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleArchive}
        disabled={isLoading}
        className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
      >
        {isLoading ? "Archiving..." : "Archive"}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}

export function DeleteTemplateButton({
  templateId,
  templateName,
}: ButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    if (
      !confirm(
        `Are you sure you want to delete "${templateName}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await deleteTemplateAction(templateId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleDelete}
        disabled={isLoading}
        className="text-red-600 hover:text-red-900 disabled:opacity-50"
      >
        {isLoading ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}

export function CreateVersionButton({ templateId, templateName }: ButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreateVersion() {
    if (
      !confirm(
        `Create a new draft version of "${templateName}"? You can edit and publish it as a new version.`,
      )
    ) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createNewVersionAction(templateId);

    if (result.success) {
      // Navigate to the new template version
      router.push(`/admin/templates/${result.data.templateId}`);
    } else {
      setError(result.error.message);
    }

    setIsLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleCreateVersion}
        disabled={isLoading}
        className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
      >
        {isLoading ? "Creating..." : "New Version"}
      </button>
      {error && (
        <div className="absolute top-full right-0 mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
