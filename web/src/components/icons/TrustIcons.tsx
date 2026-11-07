import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Trust Strip — High-Speed Relevance Discovery
 */
export function TrustSpeedIcon({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <path
        d="M13 2L4 13.5H11.5L10 22L20 9.5H12.5L13 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Speed trails */}
      <path d="M3 5H6M2 8H4M19 16H22M18 19H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  );
}

/**
 * Trust Strip — Verified Ethiopian University Channels
 */
export function TrustVerifiedIcon({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Classical Portico Pediment */}
      <path d="M3 8L12 3.5L21 8H3Z" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      {/* Portico Columns */}
      <path d="M5.5 8V16M9.5 8V16M14.5 8V16M18.5 8V16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {/* Base Foundation */}
      <path d="M2 17H22M3 20H21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      {/* Academic Shield Checkmark Badge */}
      <circle cx="17.5" cy="14.5" r="4" fill="#0878F9" />
      <path d="M16 14.5L17.2 15.7L19.2 13.5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Trust Strip — Telegram Bot 1-Tap Delivery
 */
export function TrustTelegramIcon({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Orbital Ring Aura */}
      <circle cx="12" cy="12" r="9.5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* Dynamic Telegram Paper Plane */}
      <path
        d="M17.5 7L6 11.5L10 13L15 9.5L11.5 14L15.5 17L17.5 7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Trust Strip — Academic Repository Archive Volumes
 */
export function TrustLibraryIcon({ size = 22, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <path
        d="M4 6.5C4 5.39543 4.89543 4.5 6 4.5H10.5C11.5 4.5 12 5.5 12 6.5V19.5C12 18.5 11.5 18 10.5 18H6C4.89543 18 4 18.6716 4 19.5V6.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M20 6.5C20 5.39543 19.1046 4.5 18 4.5H13.5C12.5 4.5 12 5.5 12 6.5V19.5C12 18.5 12.5 18 13.5 18H18C19.1046 18 20 18.6716 20 19.5V6.5Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}
