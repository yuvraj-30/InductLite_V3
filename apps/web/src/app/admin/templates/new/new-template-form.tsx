"use client";

/**
 * New Template Form
 *
 * Client component for creating a new template.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplateAction } from "../actions";

interface Site {
  id: string;
  name: string;
}

interface Props {
  sites: Site[];
}

export function NewTemplateForm({ sites }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [siteId, setSiteId] = useState<string>("");
  const [isDefault, setIsDefault] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setFieldErrors({});

    const result = await createTemplateAction({
      name,
      description: description || undefined,
      site_id: siteId || undefined,
      is_default: siteId ? false : isDefault,
    });

    if (result.success) {
      router.push(`/admin/templates/${result.data.templateId}`);
    } else {
      setError(result.error.message);
      if (result.error.fieldErrors) {
        setFieldErrors(result.error.fieldErrors);
      }
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Template Name *
        </label>
        <input
          type="text"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="e.g., Site Safety Induction"
        />
        {fieldErrors.name && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.name[0]}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Brief description of this template..."
        />
        {fieldErrors.description && (
          <p className="mt-1 text-sm text-red-600">
            {fieldErrors.description[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="site"
          className="block text-sm font-medium text-gray-700"
        >
          Site Scope
        </label>
        <select
          id="site"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Company-wide (applies to all sites)</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name} only
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-gray-500">
          Site-specific templates override the company-wide default for that
          site.
        </p>
      </div>

      {!siteId && (
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

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading || !name.trim()}
          className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "Create Template"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
