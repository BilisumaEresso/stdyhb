import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Computer Science — Terminal Bracket & Binary Node
 */
export function SubjectCsIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <rect x="3" y="3.5" width="18" height="17" rx="3.5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 8.5L11 12L7 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.5 15.5H16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Software Engineering — Interlocking Modular Architecture Gears
 */
export function SubjectSeIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2V4.5M12 19.5V22M2 12H4.5M19.5 12H22M4.93 4.93L6.7 6.7M17.3 17.3L19.07 19.07M4.93 19.07L6.7 17.3M17.3 6.7L19.07 4.93"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Database Systems — Relational DBMS Stacked Cylinders
 */
export function SubjectDbmsIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Top Cylinder */}
      <ellipse cx="12" cy="5.5" rx="8" ry="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.75" />
      {/* Middle Cylinder Layer */}
      <path d="M4 5.5V11.5C4 13.1569 7.58172 14.5 12 14.5C16.4183 14.5 20 13.1569 20 11.5V5.5" stroke="currentColor" strokeWidth="1.75" />
      {/* Bottom Cylinder Layer */}
      <path d="M4 11.5V17.5C4 19.1569 7.58172 20.5 12 20.5C16.4183 20.5 20 19.1569 20 17.5V11.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

/**
 * Computer Networks — Distributed Topology Mesh (OSI Hierarchy)
 */
export function SubjectNetworksIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Central Root Node */}
      <circle cx="12" cy="5" r="3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Bottom Left Node */}
      <circle cx="5" cy="18" r="3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Bottom Right Node */}
      <circle cx="19" cy="18" r="3" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Interconnect Bus Lines */}
      <path d="M12 8V12M12 12L5 15M12 12L19 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Mathematics — Integral & Coordinate Functions
 */
export function SubjectMathIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Calculus Integral Sign */}
      <path
        d="M15 4C14 4 13 4.8 13 6.5V17.5C13 19.2 12 20 11 20"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Summation / Math Sigma */}
      <path
        d="M6 7H11L8 12L11 17H6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Equal sign */}
      <path d="M16 11.5H20M16 14.5H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

/**
 * General Physics — Atomic Orbital & Wave Mechanics
 */
export function SubjectPhysicsIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Atomic Nucleus */}
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      {/* Diagonal Orbital 1 */}
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1.6" />
      {/* Diagonal Orbital 2 */}
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-45 12 12)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * General Chemistry — Erlenmeyer Lab Flask & Benzene Molecule
 */
export function SubjectChemistryIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Flask Outline */}
      <path
        d="M9 3H15M10 3V8.5L4.5 18C3.8 19.2 4.6 21 6 21H18C19.4 21 20.2 19.2 19.5 18L14 8.5V3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Fluid Meniscus Level */}
      <path d="M7 15C9 14.2 11 15.8 13 15C15 14.2 16.5 14.8 17 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Reaction Bubbles */}
      <circle cx="10" cy="17.5" r="1" fill="currentColor" />
      <circle cx="13.5" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Information Systems — Enterprise Workflow & Architecture
 */
export function SubjectIsIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Layer 1 Top */}
      <path d="M12 3L21 7.5L12 12L3 7.5L12 3Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      {/* Layer 2 Mid */}
      <path d="M3 12L12 16.5L21 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {/* Layer 3 Bottom */}
      <path d="M3 16.5L12 21L21 16.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Artificial Intelligence — Neural Synapse Mesh & Agent Eye
 */
export function SubjectAiIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Outer Head / Chip Container */}
      <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.75" />
      {/* Neural Core Node */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      {/* Synapse Connection Radiants */}
      <path d="M12 4V8M12 16V20M4 12H8M16 12H20M6.5 6.5L9 9M15 15L17.5 17.5M6.5 17.5L9 15M15 9L17.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Data Structures & Algorithms — Binary Search Tree (BST)
 */
export function SubjectDsaIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Root Node */}
      <circle cx="12" cy="5" r="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Left Child */}
      <circle cx="6" cy="13" r="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Right Child */}
      <circle cx="18" cy="13" r="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.75" />
      {/* Leaf Node */}
      <circle cx="9" cy="20" r="2" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.5" />
      {/* Branches */}
      <path d="M10.2 6.8L7.8 11.2M13.8 6.8L16.2 11.2M7 15.2L8.2 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Electrical & Computer Engineering — Logic Gate & Circuit Resistor
 */
export function SubjectEceIcon({ size = 24, className = "", style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ flexShrink: 0, ...style }} aria-hidden="true">
      {/* Circuit Resistor Zig-Zag */}
      <path
        d="M2 12H6L8 8L11 16L13 8L16 16L18 12H22"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Microcontroller Pin Nodes */}
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
