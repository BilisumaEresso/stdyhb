import React from "react";

interface DocumentPreviewSkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  height?: number | string;
}

export function DocumentPreviewSkeleton({
  className = "",
  style = {},
  height = "520px",
}: DocumentPreviewSkeletonProps) {
  return (
    <div
      className={`document-preview-skeleton ${className}`}
      style={{
        width: "100%",
        minHeight: height,
        borderRadius: "18px",
        background: "var(--surface)",
        border: "1px solid var(--card-border)",
        boxShadow: "var(--shadow-card)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "none",
        userSelect: "none",
        ...style,
      }}
      aria-hidden="true"
    >
      {/* Document Toolbar Placeholder */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface-2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            className="skeleton-box"
            style={{ width: "28px", height: "28px", borderRadius: "8px" }}
          />
          <div
            className="skeleton-box"
            style={{ width: "110px", height: "14px", borderRadius: "4px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            className="skeleton-box"
            style={{ width: "70px", height: "24px", borderRadius: "12px" }}
          />
          <div
            className="skeleton-box"
            style={{ width: "24px", height: "24px", borderRadius: "6px" }}
          />
          <div
            className="skeleton-box"
            style={{ width: "24px", height: "24px", borderRadius: "6px" }}
          />
        </div>
      </div>

      {/* Simulated Document Sheet */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 20px",
          background: "rgba(8, 43, 98, 0.02)",
        }}
      >
        <div
          style={{
            width: "min(100%, 420px)",
            height: "100%",
            minHeight: "360px",
            background: "var(--surface)",
            borderRadius: "12px",
            border: "1px solid var(--card-border)",
            boxShadow: "var(--shadow-sm)",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Document Heading Bar */}
          <div
            className="skeleton-box"
            style={{ height: "20px", width: "70%", borderRadius: "6px", marginBottom: "8px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "12px", width: "45%", borderRadius: "4px", marginBottom: "16px" }}
          />

          {/* Paragraph Lines 1 */}
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "100%", borderRadius: "3px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "96%", borderRadius: "3px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "90%", borderRadius: "3px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "65%", borderRadius: "3px", marginBottom: "14px" }}
          />

          {/* Paragraph Lines 2 */}
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "98%", borderRadius: "3px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "92%", borderRadius: "3px" }}
          />
          <div
            className="skeleton-box"
            style={{ height: "10px", width: "78%", borderRadius: "3px", marginBottom: "14px" }}
          />

          {/* Diagram / Math Placeholder Box */}
          <div
            className="skeleton-box"
            style={{
              height: "70px",
              width: "100%",
              borderRadius: "8px",
              opacity: 0.8,
            }}
          />
        </div>
      </div>

      {/* Footer Page Tracker */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "10px 16px",
          borderTop: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <div
          className="skeleton-box"
          style={{ width: "90px", height: "16px", borderRadius: "10px" }}
        />
      </div>
    </div>
  );
}

export default DocumentPreviewSkeleton;
