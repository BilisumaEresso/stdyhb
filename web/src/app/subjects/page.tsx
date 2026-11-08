"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ArrowRight, X } from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";
import { SubjectCardSkeleton } from "@/components/loading";
import {
  SubjectCsIcon,
  SubjectSeIcon,
  SubjectDbmsIcon,
  SubjectNetworksIcon,
  SubjectMathIcon,
  SubjectPhysicsIcon,
  SubjectChemistryIcon,
  SubjectIsIcon,
  SubjectAiIcon,
  SubjectDsaIcon,
  SubjectEceIcon,
} from "@/components/icons";

const ALL_SUBJECTS = [
  {
    title: "Computer Science",
    category: "Computing",
    desc: "Algorithms, data structures, operating systems, compiler theory & core computer science.",
    icon: SubjectCsIcon,
    query: "Computer Science",
    count: "Thousands of verified materials",
  },
  {
    title: "Software Engineering",
    category: "Computing",
    desc: "Software architecture, design patterns, testing, OOP, requirements & agile development.",
    icon: SubjectSeIcon,
    query: "Software Engineering",
    count: "Past exams, projects & labs",
  },
  {
    title: "Database Systems",
    category: "Computing",
    desc: "Relational DBMS, SQL syntax, indexing, normalization, ER diagrams & database design.",
    icon: SubjectDbmsIcon,
    query: "Database Systems DBMS",
    count: "Lecture slides, sheets & assignments",
  },
  {
    title: "Computer Networks",
    category: "Computing",
    desc: "Networking architecture, OSI layers, TCP/IP protocols, routing algorithms & socket labs.",
    icon: SubjectNetworksIcon,
    query: "Computer Networks",
    count: "Lab manuals & presentation packs",
  },
  {
    title: "Mathematics",
    category: "Natural & Formal Sciences",
    desc: "Calculus I & II, linear algebra, discrete mathematics, differential equations & statistics.",
    icon: SubjectMathIcon,
    query: "Mathematics Calculus",
    count: "Solved midterm & final problem sets",
  },
  {
    title: "Physics",
    category: "Natural & Formal Sciences",
    desc: "General physics, classical mechanics, electromagnetism, optics & thermodynamics.",
    icon: SubjectPhysicsIcon,
    query: "General Physics",
    count: "Formula sheets, lab manuals & tests",
  },
  {
    title: "Chemistry",
    category: "Natural & Formal Sciences",
    desc: "Foundational general chemistry, organic mechanisms, analytical chemistry & freshman exams.",
    icon: SubjectChemistryIcon,
    query: "General Chemistry",
    count: "Freshman document bundles",
  },
  {
    title: "Information Systems",
    category: "Computing",
    desc: "Enterprise architecture, business process modeling, systems analysis & IT fundamentals.",
    icon: SubjectIsIcon,
    query: "Information Systems",
    count: "Curated outlines & slide decks",
  },
  {
    title: "Artificial Intelligence",
    category: "Computing",
    desc: "Machine learning, neural networks, computer vision, NLP & intelligent search agents.",
    icon: SubjectAiIcon,
    query: "Artificial Intelligence Machine Learning",
    count: "Research notes, slides & code guides",
  },
  {
    title: "Data Structures & Algorithms",
    category: "Computing",
    desc: "Binary trees, graphs, sorting, dynamic programming, complexity analysis & problem sets.",
    icon: SubjectDsaIcon,
    query: "Data Structures Algorithms DSA",
    count: "Coding problems & midterm exams",
  },
  {
    title: "Electrical & Computer Engineering",
    category: "Engineering",
    desc: "Circuit analysis, digital logic design, microprocessors, signals & linear systems.",
    icon: SubjectEceIcon,
    query: "Electrical Engineering Digital Logic",
    count: "Circuit diagrams & lecture notes",
  },
];

export default function SubjectsPage() {
  const [filterQuery, setFilterQuery] = useState("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    // Quick, smooth initial layout settle
    const timer = setTimeout(() => setIsInitialLoading(false), 120);
    return () => clearTimeout(timer);
  }, []);

  const filteredSubjects = ALL_SUBJECTS.filter((s) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.title.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });

  return (
    <main>
      <section className="page-hero container">
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Academic Discipline Directory</span>
        </span>
        <h1>
          Explore by <span className="accent">Subject</span>
        </h1>
        <p>
          Browse Ethiopian university materials organized by discipline, from core freshman courses to
          specialized departmental exams and lecture slides.
        </p>

        {/* Live Subject Filter Search */}
        <div style={{ maxWidth: "480px", marginTop: "24px" }}>
          <div className="searchbar">
            <span className="search-icon">
              <Search size={18} />
            </span>
            <input
              placeholder="Filter subjects (e.g. Computing, Physics, Math)..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              aria-label="Filter subjects"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label="Clear filter"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="container section" style={{ paddingTop: "12px" }}>
        <div className="subject-grid">
          {isInitialLoading ? (
            <SubjectCardSkeleton count={8} />
          ) : (
            filteredSubjects.map((subj) => {
              const Icon = subj.icon;
              return (
                <Link
                  key={subj.title}
                  className="subject-card"
                  href={`/explore?q=${encodeURIComponent(subj.query)}`}
                >
                  <div className="subject-icon">
                    <Icon size={24} />
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        fontWeight: 700,
                        color: "var(--primary)",
                        marginBottom: "4px",
                        display: "block",
                      }}
                    >
                      {subj.category}
                    </span>
                    <h3>{subj.title}</h3>
                    <small>{subj.desc}</small>
                    <small
                      style={{
                        display: "block",
                        marginTop: "8px",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      {subj.count}
                    </small>
                  </div>
                  <span className="arrow">
                    <ArrowRight size={18} />
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {filteredSubjects.length === 0 && (
          <div className="empty" style={{ marginTop: "20px" }}>
            <h3>No subjects match "{filterQuery}"</h3>
            <p>Try searching for a broader academic term or explore our full library.</p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: "12px" }}
              onClick={() => setFilterQuery("")}
            >
              Reset Filter
            </button>
          </div>
        )}
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="container section">
        <div className="cta">
          <div>
            <h2>Looking for a specific course code?</h2>
            <p>Use the search omnibar with your exact course code (e.g. CSE301, PHYS101, MATH201).</p>
          </div>
          <Link className="btn" href="/explore">
            <span>Search Library</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
