import Link from "next/link";
import { ArrowLeft, Search, Home, AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <main className="container" style={{ padding: "80px 0 100px", textAlign: "center" }}>
      <img
        src="/assets/mascot.png"
        alt="StudyHub Robot Mascot"
        style={{
          width: "120px",
          height: "120px",
          borderRadius: "24px",
          margin: "0 auto 24px",
          boxShadow: "var(--shadow)",
          border: "1px solid var(--line)",
          objectFit: "cover",
        }}
      />
      <span className="eyebrow" style={{ marginBottom: "16px" }}>
        <AlertCircle size={14} className="eyebrow-icon" />
        <span>Error 404</span>
      </span>
      <h1 style={{ fontSize: "clamp(32px, 4.5vw, 48px)", margin: "16px 0 12px" }}>
        Page not found.
      </h1>
      <p className="muted" style={{ maxWidth: "460px", margin: "0 auto 28px", fontSize: "16px" }}>
        The study resource, subject, or route you are looking for might have been moved, renamed, or
        is temporarily unavailable.
      </p>

      <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/">
          <Home size={15} />
          <span>Return Home</span>
        </Link>
        <Link className="btn btn-outline" href="/explore">
          <Search size={15} />
          <span>Search All Resources</span>
        </Link>
      </div>
    </main>
  );
}
