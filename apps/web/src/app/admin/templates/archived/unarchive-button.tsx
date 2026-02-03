"use client";

import { useTransition } from "react";
import { unarchiveTemplateAction } from "@/app/admin/templates/actions";

export function UnarchiveButton({
  templateId,
  disabled,
}: {
  templateId: string;
  disabled?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="text-green-600 hover:text-green-900 ml-2"
      title="Unarchive"
      disabled={disabled || isPending}
      onClick={() => {
        startTransition(async () => {
          await unarchiveTemplateAction(templateId);
          window.location.reload();
        });
      }}
    >
      {isPending ? "Unarchiving..." : "Unarchive"}
    </button>
  );
}
