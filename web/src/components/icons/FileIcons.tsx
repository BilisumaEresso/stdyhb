import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom Academic PDF Document Icon
 */
export function FilePdfIcon({ size = 20, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Document Sheet */}
      <path
        d="M5 4.5C5 3.39543 5.89543 2.5 7 2.5H14L19 7.5V19.5C19 20.6046 18.1046 21.5 17 21.5H7C5.89543 21.5 5 20.6046 5 19.5V4.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Folded Corner */}
      <path
        d="M14 2.5V7.5H19"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Formatted Academic Text Lines */}
      <path
        d="M8.5 12H15.5M8.5 15.5H13M8.5 8.5H11"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Custom Presentation Slide Deck (PowerPoint) Icon
 */
export function FilePptIcon({ size = 20, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Projector Screen / Easel */}
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="12"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Presentation Bar Chart */}
      <path
        d="M7 11.5V10M10.5 11.5V8M14 11.5V6.5M17 11.5V9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Easel Stand Legs */}
      <path
        d="M12 15.5V19M8 20.5L12 18.5L16 20.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Custom Word Document / Research Notes Manuscript Icon
 */
export function FileDocIcon({ size = 20, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Notebook Spine / Sheet */}
      <rect
        x="4.5"
        y="3"
        width="15"
        height="18"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Margin Line */}
      <path d="M8.5 3V21" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Ruled Manuscript Lines */}
      <path
        d="M11.5 7.5H16.5M11.5 11.5H16.5M11.5 15.5H14.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Custom Past Examination Paper Icon with University Mortarboard
 */
export function FileExamIcon({ size = 20, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Paper Sheet */}
      <path
        d="M5 4.5C5 3.39543 5.89543 2.5 7 2.5H17C18.1046 2.5 19 3.39543 19 4.5V19.5C19 20.6046 18.1046 21.5 17 21.5H7C5.89543 21.5 5 20.6046 5 19.5V4.5Z"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Mortarboard Academic Cap */}
      <path d="M12 6L16.5 8.5L12 11L7.5 8.5L12 6Z" fill="currentColor" />
      <path
        d="M9.5 9.8V12C9.5 12.8 10.6 13.5 12 13.5C13.4 13.5 14.5 12.8 14.5 12V9.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Solved / Graded Checkmark */}
      <path
        d="M8.5 17L10.5 19L15.5 14"
        stroke="#FFB21A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Custom Exam Photo / Handwritten Capture Icon
 */
export function FileImageIcon({ size = 20, className = "", style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {/* Photo Frame */}
      <rect
        x="3.5"
        y="4"
        width="17"
        height="16"
        rx="3"
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* Sun / Camera Aperture */}
      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
      {/* Handwritten / Page Slopes */}
      <path
        d="M4.5 17L9 12.5L13 16.5L15.5 14L19.5 18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
