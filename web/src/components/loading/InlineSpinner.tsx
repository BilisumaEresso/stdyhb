import React from "react";

interface InlineSpinnerProps {
  size?: "xs" | "sm" | "md" | "lg" | number;
  className?: string;
  color?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
}

export function InlineSpinner({
  size = "sm",
  className = "",
  color,
  style = {},
  "aria-label": ariaLabel = "Loading...",
}: InlineSpinnerProps) {
  const pixelSize =
    typeof size === "number"
      ? size
      : size === "xs"
      ? 12
      : size === "sm"
      ? 16
      : size === "md"
      ? 20
      : 24;

  const strokeWidth = pixelSize <= 16 ? 2.5 : 3;

  return (
    <svg
      width={pixelSize}
      height={pixelSize}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-spinner ${className}`}
      style={{
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color || "currentColor"}
        strokeWidth={strokeWidth}
        strokeOpacity="0.2"
      />
      <path
        d="M12 3C16.9706 3 21 7.02944 21 12"
        stroke={color || "var(--spinner-color, #0878F9)"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default InlineSpinner;
