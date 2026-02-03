"use client";
import { useFormStatus } from "react-dom";

export default function SubmitButton({
  label,
  loadingLabel,
}: {
  label: string;
  loadingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
