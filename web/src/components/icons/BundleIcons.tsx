import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom 3-Tier Multi-File PDF Bundle Icon
 */
export function BundlePdfIcon({ size = 18, className = "", style }: IconProps) {
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
      {/* Lower Book Volume */}
      <rect x="4" y="15" width="16" height="5" rx="1.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
      {/* Middle Book Volume */}
      <rect x="4" y="9.5" width="16" height="5" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5" />
      {/* Top Book Volume */}
      <rect x="4" y="4" width="16" height="5" rx="1.5" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
      {/* Book Binding Ribbons */}
      <path d="M8 4V20M16 4V20" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.6" strokeDasharray="1 1" />
    </svg>
  );
}

/**
 * Custom Fanned-out Presentation Slide Pack Icon
 */
export function BundleSlidesIcon({ size = 18, className = "", style }: IconProps) {
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
      {/* Back Slide 3 */}
      <rect
        x="8.5"
        y="2.5"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Middle Slide 2 */}
      <rect
        x="5.5"
        y="5.5"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Front Slide 1 */}
      <rect
        x="2.5"
        y="8.5"
        width="12"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.85"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Slide chart line on front card */}
      <path d="M5.5 15.5L8 13.5L10.5 15L12.5 11.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Custom Multi-Page Photo Exam Album Icon
 */
export function BundleAlbumIcon({ size = 18, className = "", style }: IconProps) {
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
      {/* Outer Film / Page Container */}
      <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity="0.16" stroke="currentColor" strokeWidth="1.75" />
      {/* Top Reel Perforations */}
      <circle cx="6.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="10" cy="7.5" r="1" fill="currentColor" />
      <circle cx="13.5" cy="7.5" r="1" fill="currentColor" />
      <circle cx="17" cy="7.5" r="1" fill="currentColor" />
      {/* Exam Booklet Page Grid */}
      <rect x="5.5" y="11" width="5.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13" y="11" width="5.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Custom Lab Packet & Assignment Manila Folder Icon
 */
export function BundleDocIcon({ size = 18, className = "", style }: IconProps) {
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
      {/* Folder Tab & Body */}
      <path
        d="M3 6.5C3 5.39543 3.89543 4.5 5 4.5H9.5L11.5 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V6.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      {/* Paper Stack inside */}
      <path d="M7 11H17M7 14.5H13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
