import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const widthClassName = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: keyof typeof widthClassName;
  className?: string;
  panelClassName?: string;
  hideCloseButton?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
  className,
  panelClassName,
  hideCloseButton = false,
}: ModalProps) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={cn("modal-overlay", className)}>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close dialog"
        onClick={() => onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("modal-panel", widthClassName[width], panelClassName)}
      >
        <div className="modal-header">
          <div>
            <h2 id={titleId} className="text-xl font-bold text-[color:var(--text-primary)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-secondary">{description}</p>
            ) : null}
          </div>
          {!hideCloseButton ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onClose?.()}
              aria-label="Close dialog"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </Button>
          ) : null}
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}
