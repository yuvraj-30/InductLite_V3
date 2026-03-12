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
      className="text-accent hover:underline disabled:opacity-50"
    >
      {pending ? loadingLabel : label}
    </button>
  );
}
