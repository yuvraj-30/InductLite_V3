"use client";

import { useTransition } from "react";
import { deleteTemplateAction } from "@/app/admin/templates/actions";

export function DeleteButton({
  templateId,
  disabled,
}: {
  templateId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="text-red-600 hover:text-red-900 ml-2"
      title="Delete"
      disabled={disabled || isPending}
      onClick={() => {
        if (
          !window.confirm(
            "Are you sure you want to delete this template? This action cannot be undone.",
          )
        )
          return;
        startTransition(async () => {
          await deleteTemplateAction(templateId);
          window.location.reload();
        });
      }}
    >
      {isPending ? "Deleting..." : "Delete"}
    </button>
  );
}
