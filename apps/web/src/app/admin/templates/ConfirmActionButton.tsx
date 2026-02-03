"use client";
import React from "react";

type ConfirmActionButtonProps = {
  templateName: string;
  confirmMessage: string;
  children: React.ReactElement<{ children?: React.ReactNode }>;
};

export function ConfirmActionButton({
  templateName,
  confirmMessage,
  children,
}: ConfirmActionButtonProps) {
  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!confirm(confirmMessage.replace("{name}", templateName))) {
      e.preventDefault();
    }
  }

  // If the child is a form, find the button and attach the handler
  const isReactElement = (el: unknown): el is React.ReactElement =>
    typeof el === "object" &&
    el !== null &&
    "props" in (el as object) &&
    "type" in (el as object);

  if (isReactElement(children) && children.type === "form") {
    const formChildren = React.Children.map(
      // children.props is safe here because of the type guard above
      (children as React.ReactElement<{ children?: React.ReactNode }>).props
        .children,
      (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type !== "button") return child;

        const props =
          child.props as React.ButtonHTMLAttributes<HTMLButtonElement>;
        if (props.type === "submit") {
          return React.cloneElement(
            child as React.ReactElement<
              React.ButtonHTMLAttributes<HTMLButtonElement>
            >,
            { onClick: handleClick },
          );
        }
        return child;
      },
    );
    return React.cloneElement(
      children as React.ReactElement<{ children?: React.ReactNode }>,
      undefined,
      formChildren,
    );
  }
  // Otherwise, clone the child button and attach the handler
  if (React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<
        React.ButtonHTMLAttributes<HTMLButtonElement>
      >,
      { onClick: handleClick },
    );
  }

  return children;
}
