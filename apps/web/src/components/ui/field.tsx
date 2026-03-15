import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn("label", className)} {...props} />
));

FieldLabel.displayName = "FieldLabel";

const FieldHint = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("field-hint", className)} {...props} />
));

FieldHint.displayName = "FieldHint";

const FieldError = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("field-error", className)} {...props} />
));

FieldError.displayName = "FieldError";

const FieldSection = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("field-section", className)} {...props} />
));

FieldSection.displayName = "FieldSection";

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn("field-stack", className)} {...props}>
      {label ? (
        <FieldLabel htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="ml-1 text-red-700 dark:text-red-300">*</span>
          ) : null}
        </FieldLabel>
      ) : null}
      {children}
      {hint ? <FieldHint>{hint}</FieldHint> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}

export { Field, FieldError, FieldHint, FieldLabel, FieldSection };
