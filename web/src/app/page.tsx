"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const POPULAR_CHIPS = ["DBMS", "DSA", "OOP", "Calculus", "CN", "OS", "Exam"];

const SUBJECTS = [
  {
    title: "Computer Science",
    desc: "Algorithms, systems and more",
    icon: "⌘",
    query: "Computer Science",
  },
  {
    title: "Software Engineering",
    desc: "Design, testing and development",
    icon: "⚙",
    query: "Software Engineering",
  },
  {
    title: "Database Systems",
    desc: "DBMS, SQL and data",
    icon: "▤",
    query: "Database Systems",
  },
  {
    title: "Computer Networks",
    desc: "Networking fundamentals",
    icon: "⌘",
    query: "Computer Networks",
  },
  {
    title: "Mathematics",
    desc: "Calculus, algebra and more",
    icon: "▦",
    query: "Mathematics",
  },
  {
    title: "Physics",
    desc: "Core physics materials",
    icon: "⚛",
    query: "Physics",
  },
];

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push("/explore");
    }
  };

  const handleChipClick = (chip: string) => {
    router.push(`/explore?q=${encodeURIComponent(chip)}`);
  };

  return (
    <main>
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <i className="dot"></i> Academic Resource Search
            </span>

            <h1>
              Find what you need.
              <br />
              Focus on <span className="accent">learning.</span>
            </h1>

            <p>
              Search past exams, lecture notes, PDFs, presentations and more from Ethiopian university
              channels.
            </p>

            <form className="searchbar" onSubmit={handleSearch}>
              <span className="search-icon">⌕</span>
              <input
                aria-label="Search study materials"
                placeholder="Search study materials (e.g. DBMS, Calculus, CS301)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Search&nbsp; →
              </button>
            </form>

            <div className="popular">
              <strong>Popular:</strong>
              {POPULAR_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="chip"
                  onClick={() => handleChipClick(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="hero-art">
            <img
              src="/assets/hero-illustration.svg"
              alt="Stack of study books and academic files"
            />
          </div>
        </div>
      </section>

      {/* ── Stats Strip ─────────────────────────────────────────────── */}
      <section className="container stats-strip">
        <div className="stat-card">
          <div className="stat-icon">ϟ</div>
          <div>
            <strong>Lightning fast</strong>
            <small>Get results in seconds</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div>
            <strong>80,000+ Files</strong>
            <small>From 27+ University Channels</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">➤</div>
          <div>
            <strong>Telegram powered</strong>
            <small>Search and access easily</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">▥</div>
          <div>
            <strong>Smart ranking</strong>
            <small>Find the most relevant</small>
          </div>
        </div>
      </section>

      {/* ── Popular Subjects Section ─────────────────────────────────── */}
      <section className="section container">
        <div className="section-head">
          <div>
            <h2>Popular subjects</h2>
            <p>Explore resources by subject</p>
          </div>
          <Link className="btn btn-outline" href="/subjects">
            View all subjects&nbsp; →
          </Link>
        </div>

        <div className="subject-grid">
          {SUBJECTS.map((subj) => (
            <Link
              key={subj.title}
              className="subject-card"
              href={`/explore?q=${encodeURIComponent(subj.query)}`}
            >
              <div className="subject-icon">{subj.icon}</div>
              <div>
                <h3>{subj.title}</h3>
                <small>{subj.desc}</small>
              </div>
              <span className="arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="section container">
        <div className="cta">
          <div>
            <h2>Your next study session starts here.</h2>
            <p>Find useful material, explore subjects, and get back to learning.</p>
          </div>
          <Link className="btn" href="/explore">
            Explore resources&nbsp; →
          </Link>
        </div>
      </section>
    </main>
  );
}
