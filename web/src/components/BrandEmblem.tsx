export default function BrandEmblem({
  size = 15,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ flexShrink: 0, display: "inline-block" }}
      aria-hidden="true"
    >
      <rect width="20" height="20" rx="5" fill="currentColor" fillOpacity="0.18" />
      {/* Mortarboard Diamond */}
      <path d="M10 4.2L16.2 7.6L10 11L3.8 7.6L10 4.2Z" fill="currentColor" />
      {/* Skull Base */}
      <path
        d="M6.5 9.3V12.3C6.5 13.6 8 14.8 10 14.8C12 14.8 13.5 13.6 13.5 12.3V9.3L10 11.2L6.5 9.3Z"
        fill="currentColor"
        fillOpacity="0.75"
      />
      {/* Golden Tassel Pip */}
      <circle cx="15.2" cy="11.2" r="1.3" fill="#FFB21A" />
    </svg>
  );
}
