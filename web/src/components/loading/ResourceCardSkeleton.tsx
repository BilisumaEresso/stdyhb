import React from "react";

interface ResourceCardSkeletonProps {
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ResourceCardSkeleton({
  count = 1,
  className = "",
  style = {},
}: ResourceCardSkeletonProps) {
  const cards = Array.from({ length: count });

  return (
    <>
      {cards.map((_, idx) => (
        <article
          key={idx}
          className={`resource-card skeleton-card ${className}`}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            ...style,
          }}
          aria-hidden="true"
        >
          {/* Top Bar: File Type Icon & Badges */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <div
                className="skeleton-box"
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  flexShrink: 0,
                }}
              />
              <div
                className="skeleton-box"
                style={{
                  width: "90px",
                  height: "22px",
                  borderRadius: "8px",
                }}
              />
            </div>

            {/* Title Lines */}
            <div style={{ marginBottom: "16px" }}>
              <div
                className="skeleton-box"
                style={{
                  height: "17px",
                  width: idx % 2 === 0 ? "88%" : "94%",
                  borderRadius: "6px",
                  marginBottom: "8px",
                }}
              />
              <div
                className="skeleton-box"
                style={{
                  height: "17px",
                  width: idx % 2 === 0 ? "62%" : "50%",
                  borderRadius: "6px",
                }}
              />
            </div>

            {/* Metadata Line */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div
                className="skeleton-box"
                style={{
                  height: "13px",
                  width: "65px",
                  borderRadius: "4px",
                }}
              />
              <span className="muted" style={{ fontSize: "10px", opacity: 0.3 }}>•</span>
              <div
                className="skeleton-box"
                style={{
                  height: "13px",
                  width: "48px",
                  borderRadius: "4px",
                }}
              />
              <span className="muted" style={{ fontSize: "10px", opacity: 0.3 }}>•</span>
              <div
                className="skeleton-box"
                style={{
                  height: "13px",
                  width: "75px",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>

          {/* Bottom Bar: Source & Action Links */}
          <div
            className="resource-bottom"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "14px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <div
              className="skeleton-box"
              style={{
                height: "13px",
                width: "95px",
                borderRadius: "4px",
              }}
            />
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div
                className="skeleton-box"
                style={{
                  height: "14px",
                  width: "55px",
                  borderRadius: "4px",
                }}
              />
              <div
                className="skeleton-box"
                style={{
                  height: "14px",
                  width: "38px",
                  borderRadius: "4px",
                }}
              />
            </div>
          </div>
        </article>
      ))}
    </>
  );
}

export default ResourceCardSkeleton;
