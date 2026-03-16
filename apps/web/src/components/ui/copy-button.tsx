"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

type CopyStatus = "idle" | "copied" | "error";

interface CopyButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick" | "type"> {
  value: string;
  label: ReactNode;
  copiedLabel?: ReactNode;
  errorLabel?: ReactNode;
  resetMs?: number;
}

function fallbackCopy(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!copied) {
    throw new Error("execCommand copy failed");
  }
}

export function CopyButton({
  value,
  label,
  copiedLabel = "Copied!",
  errorLabel = "Copy failed",
  resetMs = 1500,
  disabled,
  ...buttonProps
}: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const scheduleReset = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setStatus("idle");
      resetTimerRef.current = null;
    }, resetMs);
  };

  const handleClick = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          fallbackCopy(value);
        }
      } else {
        fallbackCopy(value);
      }
      setStatus("copied");
    } catch {
      setStatus("error");
    }
    scheduleReset();
  };

  const content =
    status === "copied" ? copiedLabel : status === "error" ? errorLabel : label;

  return (
    <button
      type="button"
      {...buttonProps}
      disabled={disabled}
      onClick={handleClick}
      aria-live="polite"
    >
      {content}
    </button>
  );
}
