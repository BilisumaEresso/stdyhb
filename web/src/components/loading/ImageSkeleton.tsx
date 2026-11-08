"use client";

import React, { useState } from "react";
import { AlertCircle } from "lucide-react";

interface ImageSkeletonProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  fallbackText?: string;
  aspectRatio?: string;
}

export function ImageSkeleton({
  src,
  alt = "",
  className = "",
  style = {},
  containerClassName = "",
  containerStyle = {},
  fallbackText = "Image unavailable",
  aspectRatio,
  ...props
}: ImageSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      className={`image-skeleton-container ${containerClassName}`}
      style={{
        position: "relative",
        overflow: "hidden",
        display: "inline-block",
        aspectRatio: aspectRatio,
        ...containerStyle,
      }}
    >
      {/* Skeleton Shimmer Underlay */}
      {!isLoaded && !hasError && (
        <div
          className="skeleton-box"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            borderRadius: "inherit",
          }}
          aria-hidden="true"
        />
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            minHeight: "120px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-2)",
            color: "var(--muted)",
            padding: "16px",
            textAlign: "center",
            borderRadius: "inherit",
          }}
        >
          <AlertCircle size={22} style={{ color: "var(--accent, #EF4444)", marginBottom: "6px" }} />
          <span style={{ fontSize: "12px", fontWeight: 600 }}>{fallbackText}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={className}
          style={{
            transition: "opacity 0.26s cubic-bezier(0.16, 1, 0.3, 1)",
            opacity: isLoaded ? 1 : 0,
            display: "block",
            width: "100%",
            height: "100%",
            ...style,
          }}
          onLoad={(e) => {
            setIsLoaded(true);
            props.onLoad?.(e);
          }}
          onError={(e) => {
            setHasError(true);
            props.onError?.(e);
          }}
          {...props}
        />
      )}
    </div>
  );
}

export default ImageSkeleton;
