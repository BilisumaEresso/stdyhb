import React from "react";

interface StudyHubLoaderProps {
  size?: "sm" | "md" | "lg";
  message?: string;
  variant?: "inline" | "fullscreen" | "card";
  className?: string;
  style?: React.CSSProperties;
}

export function StudyHubLoader({
  size = "md",
  message = "Loading academic resources...",
  variant = "inline",
  className = "",
  style = {},
}: StudyHubLoaderProps) {
  const dimensions =
    size === "sm"
      ? { width: 36, height: 32, scale: 0.75 }
      : size === "lg"
      ? { width: 68, height: 60, scale: 1.4 }
      : { width: 50, height: 44, scale: 1 };

  const content = (
    <div
      className={`studyhub-loader studyhub-loader-${size} ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: size === "sm" ? "8px" : "14px",
        ...style,
      }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="studyhub-book-wrapper"
        style={{
          position: "relative",
          width: dimensions.width,
          height: dimensions.height,
        }}
      >
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 60 52"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="studyhub-book-svg"
          aria-hidden="true"
        >
          {/* Back Cover / Foundation */}
          <path
            d="M30 46C20 40 8 41 4 43V9C9 7 21 6 30 12C39 6 51 7 56 9V43C52 41 40 40 30 46Z"
            fill="var(--navy, #082B62)"
            fillOpacity="0.15"
          />

          {/* Left Static Page Wing */}
          <path
            d="M30 44C20 38 9 39 5 41V8C10 6 21 5 30 11V44Z"
            fill="var(--primary, #0878F9)"
            fillOpacity="0.85"
            stroke="var(--navy, #082B62)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Right Static Page Wing */}
          <path
            d="M30 44C40 38 51 39 55 41V8C50 6 39 5 30 11V44Z"
            fill="var(--primary, #0878F9)"
            stroke="var(--navy, #082B62)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />

          {/* Animated Page 1 (Cyan fluttering page) */}
          <g className="studyhub-anim-page studyhub-anim-page-1">
            <path
              d="M30 11C38 6 48 7 54 9V41C48 39 38 38 30 44V11Z"
              fill="var(--cyan, #12BCEB)"
              fillOpacity="0.9"
            />
          </g>

          {/* Animated Page 2 (White / Surface fluttering page) */}
          <g className="studyhub-anim-page studyhub-anim-page-2">
            <path
              d="M30 11C36 7 45 7 51 9V41C45 39 36 38 30 44V11Z"
              fill="var(--surface, #FFFFFF)"
              fillOpacity="0.85"
            />
          </g>

          {/* Animated Page 3 (Royal Blue accent page) */}
          <g className="studyhub-anim-page studyhub-anim-page-3">
            <path
              d="M30 11C34 7 42 7 48 9V41C42 39 34 38 30 44V11Z"
              fill="var(--primary-hover, #0662CC)"
              fillOpacity="0.7"
            />
          </g>

          {/* Center Spine Ridge */}
          <path
            d="M30 11V46"
            stroke="var(--navy, #082B62)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Golden Bookmark Pip */}
          <circle cx="30" cy="8" r="2.4" fill="var(--gold, #FFB21A)" />
        </svg>

        {/* Ambient Cyan Glow */}
        <div className="studyhub-loader-glow" />
      </div>

      {message && (
        <span
          className="studyhub-loader-text"
          style={{
            fontSize: size === "sm" ? "12px" : size === "lg" ? "15px" : "13.5px",
            fontWeight: 600,
            color: "var(--muted)",
            letterSpacing: "0.2px",
            textAlign: "center",
          }}
        >
          {message}
        </span>
      )}
    </div>
  );

  if (variant === "fullscreen") {
    return (
      <div
        className="studyhub-loader-fullscreen"
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          backdropFilter: "blur(6px)",
        }}
      >
        {content}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className="studyhub-loader-card"
        style={{
          padding: "48px 24px",
          borderRadius: "20px",
          background: "var(--surface)",
          border: "1px solid var(--card-border)",
          boxShadow: "var(--shadow-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}

export default StudyHubLoader;
