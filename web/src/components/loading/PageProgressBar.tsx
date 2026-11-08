"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PageProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // When route changes, trigger a quick, silky smooth progress pulse
    setLoading(true);
    setProgress(30);

    const timer1 = setTimeout(() => setProgress(75), 120);
    const timer2 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 200);
    }, 280);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [pathname, searchParams]);

  if (!loading && progress === 0) return null;

  return (
    <div
      className="page-progress-container"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 999999,
        pointerEvents: "none",
        overflow: "hidden",
        background: "transparent",
      }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      aria-hidden="true"
    >
      <div
        className="page-progress-bar"
        style={{
          width: `${progress}%`,
          height: "100%",
          background: "linear-gradient(90deg, #0878F9 0%, #12BCEB 75%, #20C98B 100%)",
          boxShadow: "0 0 10px rgba(18, 188, 235, 0.65), 0 0 3px #0878F9",
          transition: progress === 100 ? "width 0.2s ease-out, opacity 0.2s ease" : "width 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

export default PageProgressBar;
