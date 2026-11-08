import React from "react";
import { Check } from "lucide-react";
import { InlineSpinner } from "./InlineSpinner";

export interface ButtonLoadingStateProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  isSuccess?: boolean;
  loadingText?: string;
  successText?: string;
  variant?: "primary" | "outline" | "ghost";
  spinnerSize?: "xs" | "sm" | "md";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function ButtonLoadingState({
  isLoading = false,
  isSuccess = false,
  loadingText,
  successText,
  variant = "primary",
  spinnerSize = "sm",
  icon,
  disabled,
  className = "",
  children,
  ...props
}: ButtonLoadingStateProps) {
  const btnClass =
    variant === "outline"
      ? "btn btn-outline"
      : variant === "ghost"
      ? "btn btn-ghost"
      : "btn btn-primary";

  const successClass = isSuccess ? "btn-success" : "";
  const loadingClass = isLoading ? "btn-loading" : "";

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-live="polite"
      className={`${btnClass} ${loadingClass} ${successClass} ${className}`}
      style={{
        position: "relative",
        transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
        ...props.style,
      }}
    >
      {isSuccess ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <Check size={16} style={{ color: "var(--green, #20C98B)" }} />
          <span>{successText || children}</span>
        </span>
      ) : isLoading ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <InlineSpinner size={spinnerSize} />
          <span>{loadingText || children}</span>
        </span>
      ) : icon ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          {icon}
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export default ButtonLoadingState;
