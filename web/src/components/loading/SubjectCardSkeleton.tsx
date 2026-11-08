import React from "react";

interface SubjectCardSkeletonProps {
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function SubjectCardSkeleton({
  count = 1,
  className = "",
  style = {},
}: SubjectCardSkeletonProps) {
  const cards = Array.from({ length: count });

  return (
    <>
      {cards.map((_, idx) => (
        <div
          key={idx}
          className={`subject-card skeleton-card ${className}`}
          style={{
            pointerEvents: "none",
            userSelect: "none",
            ...style,
          }}
          aria-hidden="true"
        >
          {/* Icon Box Placeholder */}
          <div
            className="skeleton-box"
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              flexShrink: 0,
            }}
          />

          {/* Info Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Category Tag */}
            <div
              className="skeleton-box"
              style={{
                height: "11px",
                width: "75px",
                borderRadius: "4px",
                marginBottom: "8px",
              }}
            />

            {/* Subject Title */}
            <div
              className="skeleton-box"
              style={{
                height: "18px",
                width: idx % 2 === 0 ? "75%" : "60%",
                borderRadius: "6px",
                marginBottom: "10px",
              }}
            />

            {/* Description Lines */}
            <div
              className="skeleton-box"
              style={{
                height: "12px",
                width: "95%",
                borderRadius: "4px",
                marginBottom: "6px",
              }}
            />
            <div
              className="skeleton-box"
              style={{
                height: "12px",
                width: "60%",
                borderRadius: "4px",
                marginBottom: "10px",
              }}
            />

            {/* Resource Count Line */}
            <div
              className="skeleton-box"
              style={{
                height: "12px",
                width: "42%",
                borderRadius: "4px",
              }}
            />
          </div>

          {/* Arrow Placeholder */}
          <div
            className="skeleton-box"
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              flexShrink: 0,
              alignSelf: "center",
            }}
          />
        </div>
      ))}
    </>
  );
}

export default SubjectCardSkeleton;
