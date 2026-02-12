import type { ReactNode } from "react";

type AlertVariant = "error" | "success" | "info" | "warning";

const variantClass: Record<AlertVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
};

interface AlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

export function Alert({ children, variant = "info", className = "" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${variantClass[variant]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
