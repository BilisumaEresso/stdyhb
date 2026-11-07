import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Sparkles,
  GraduationCap,
  Send,
  ArrowRight,
  ShieldCheck,
  Zap,
} from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";

export const metadata: Metadata = {
  title: "About StudyHub — Mission & Campus Community",
  description:
    "Learn about StudyHub's mission to empower Ethiopian university students with instant, open access to academic resources, past exams, and lecture notes.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About StudyHub — Ethiopian Academic Knowledge Platform",
    description:
      "StudyHub connects Ethiopian university students with shared learning materials from campus Telegram communities.",
    url: "/about",
  },
};

export default function AboutPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  return (
    <main>
      <section className="page-hero container">
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Our Mission & Platform</span>
        </span>
        <h1>
          Making academic resources <span className="accent">easier to discover.</span>
        </h1>
        <p>
          StudyHub helps Ethiopian university students discover past examinations, lecture notes, and
          learning materials from the campus channels where students already share knowledge.
        </p>
      </section>

      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="about-grid">
          <div>
            <h2>
              Academic knowledge, <span className="accent">within reach.</span>
            </h2>
            <p className="muted" style={{ lineHeight: "1.7", fontSize: "16px" }}>
              Finding the right lecture note or past exam can take hours across disconnected Telegram chat
              groups, bloated channels, and fragmented storage links.
            </p>
            <p className="muted" style={{ lineHeight: "1.7", fontSize: "16px" }}>
              StudyHub aggregates and indexes educational materials into one focused academic search engine.
              Whether you are preparing for a freshman physics midterm, reviewing computer science algorithms,
              or looking for university exit exam papers, StudyHub brings clarity to your studies.
            </p>
            <p className="muted" style={{ lineHeight: "1.7", fontSize: "16px" }}>
              Search on the web with fast previews, or send materials directly to your Telegram via{" "}
              <strong>@{botUsername}</strong> with a single tap.
            </p>
            <div style={{ marginTop: "24px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href="/explore">
                <span>Explore the Library</span>
                <ArrowRight size={15} />
              </Link>
              <a
                className="btn btn-outline"
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noreferrer"
              >
                <Send size={15} />
                <span>Open Telegram Bot</span>
              </a>
            </div>
          </div>

          <div className="about-visual">
            <img
              src="/assets/mascot.png"
              alt="StudyHub Official Mascot — The Academic Robot"
              style={{
                width: "min(100%, 320px)",
                borderRadius: "24px",
                boxShadow: "var(--shadow)",
                border: "1px solid var(--line)",
              }}
            />
          </div>
        </div>

        {/* ── Product Core Values ─────────────────────────────────────── */}
        <div className="value-grid">
          <div className="value-card">
            <div className="stat-icon">
              <Zap size={22} />
            </div>
            <h3>Accessibility</h3>
            <p className="muted" style={{ lineHeight: "1.6", fontSize: "14px" }}>
              Open and free access to past exams and study materials for every Ethiopian university student,
              across AAU, ASTU, AASTU, Jimma, Gondar, and more.
            </p>
          </div>

          <div className="value-card">
            <div className="stat-icon">
              <Users size={22} />
            </div>
            <h3>Community Powered</h3>
            <p className="muted" style={{ lineHeight: "1.6", fontSize: "14px" }}>
              Built upon the collaborative spirit of campus Telegram communities, preserving notes and
              solutions passed down through student batches.
            </p>
          </div>

          <div className="value-card">
            <div className="stat-icon">
              <Sparkles size={22} />
            </div>
            <h3>Simplicity & Speed</h3>
            <p className="muted" style={{ lineHeight: "1.6", fontSize: "14px" }}>
              Zero paywalls, zero sign-up friction, and clean multi-filter discovery designed to help you get
              straight to studying.
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="container section">
        <div className="cta">
          <div>
            <h2>Ready to find your next study resource?</h2>
            <p>Start searching past exams, slides, and lecture notes in the library today.</p>
          </div>
          <Link className="btn" href="/explore">
            <span>Explore All Materials</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
