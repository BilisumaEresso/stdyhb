"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  Zap,
  BookOpen,
  Send,
  Sparkles,
  CheckCircle2,
  Code,
  Cpu,
  Database,
  Network,
  Calculator,
  Atom,
  FlaskConical,
  Layers,
  Bot,
  FileText,
  ExternalLink,
  Megaphone,
} from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import ResourceCard from "@/components/ResourceCard";
import {
  FilePdfIcon,
  FilePptIcon,
  FileDocIcon,
  FileImageIcon,
  SubjectCsIcon,
  SubjectSeIcon,
  SubjectDbmsIcon,
  SubjectNetworksIcon,
  SubjectMathIcon,
  SubjectPhysicsIcon,
  SubjectChemistryIcon,
  SubjectIsIcon,
  SubjectAiIcon,
  TrustSpeedIcon,
  TrustVerifiedIcon,
  TrustLibraryIcon,
} from "@/components/icons";

const POPULAR_CHIPS = [
  { label: "DBMS", query: "DBMS" },
  { label: "DSA", query: "DSA" },
  { label: "OOP", query: "OOP" },
  { label: "Calculus", query: "Calculus" },
  { label: "Operating Systems", query: "Operating Systems" },
  { label: "Computer Networks", query: "Computer Networks" },
  { label: "Past Exams", query: "Exam", filter: "exam" },
];

const SUBJECTS = [
  {
    title: "Computer Science",
    desc: "Algorithms, operating systems, compiler design & core theory",
    icon: SubjectCsIcon,
    query: "Computer Science",
  },
  {
    title: "Software Engineering",
    desc: "System design, agile testing, OOP & software architecture",
    icon: SubjectSeIcon,
    query: "Software Engineering",
  },
  {
    title: "Database Systems",
    desc: "Relational DBMS, SQL queries, normalization & ER modeling",
    icon: SubjectDbmsIcon,
    query: "Database Systems DBMS",
  },
  {
    title: "Computer Networks",
    desc: "OSI architecture, packet protocols, subnetting & socket labs",
    icon: SubjectNetworksIcon,
    query: "Computer Networks",
  },
  {
    title: "Mathematics",
    desc: "Calculus I & II, linear algebra, discrete math & probability",
    icon: SubjectMathIcon,
    query: "Mathematics Calculus",
  },
  {
    title: "Physics",
    desc: "Classical mechanics, electromagnetism, optics & solved midterms",
    icon: SubjectPhysicsIcon,
    query: "General Physics",
  },
  {
    title: "Chemistry",
    desc: "General chemistry, analytical labs & freshman question papers",
    icon: SubjectChemistryIcon,
    query: "General Chemistry",
  },
  {
    title: "Information Systems",
    desc: "Enterprise architecture, systems analysis & IT management",
    icon: SubjectIsIcon,
    query: "Information Systems",
  },
  {
    title: "Artificial Intelligence",
    desc: "Machine learning, neural networks & intelligent agents",
    icon: SubjectAiIcon,
    query: "Artificial Intelligence Machine Learning",
  },
];

interface StatsData {
  totalResources: number;
  totalChannels: number;
}

export default function HomePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState<StatsData>({ totalResources: 79650, totalChannels: 28 });
  const [recentResources, setRecentResources] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Fetch live system stats from API
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success && data.data) {
          setStats({
            totalResources: data.data.totalResources || 79650,
            totalChannels: data.data.totalChannels || 28,
          });
        }
      })
      .catch(() => {});

    // Fetch a few featured/recent resources for preview
    fetch("/api/search?limit=3")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.data && Array.isArray(data.data)) {
          setRecentResources(data.data.slice(0, 3));
        }
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      router.push("/explore");
    }
  };

  const handleChipClick = (chip: { label: string; query: string; filter?: string }) => {
    if (chip.filter) {
      router.push(`/explore?filter=${chip.filter}`);
    } else {
      router.push(`/explore?q=${encodeURIComponent(chip.query)}`);
    }
  };

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  return (
    <main>
      {/* ── Hero Section ────────────────────────────────────────────── */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <BrandEmblem size={16} />
              <span>Academic Resource Discovery</span>
            </span>

            <h1>
              Find what you need.
              <br />
              Focus on <span className="accent">learning.</span>
            </h1>

            <p>
              Discover past exams, lecture notes, presentations, and academic materials from Ethiopian
              university communities — all in one focused search platform.
            </p>

            {/* Omnibar Search Form with Smart Autocomplete */}
            <SearchAutocomplete
              id="home-search"
              value={searchTerm}
              onChange={setSearchTerm}
              onSubmit={(term) => {
                if (term.trim()) {
                  router.push(`/explore?q=${encodeURIComponent(term.trim())}`);
                } else {
                  router.push("/explore");
                }
              }}
              placeholder="Search courses, past exams, lecture notes, or codes (e.g. DBMS, Calculus)..."
            />

            {/* Popular Search Suggestions */}
            <div className="popular">
              <strong>Popular:</strong>
              {POPULAR_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  className="chip"
                  onClick={() => handleChipClick(chip)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hero-art">
            <img
              src="/assets/hero-illustration.svg"
              alt="StudyHub academic learning stack and resources"
            />
          </div>
        </div>
      </section>

      {/* ── Stats & Trust Strip ─────────────────────────────────────── */}
      <section className="container stats-strip">
        <div className="stat-card">
          <div className="stat-icon">
            <TrustSpeedIcon size={24} />
          </div>
          <div>
            <strong>Fast Discovery</strong>
            <small>Instant relevance ranking</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrustLibraryIcon size={24} />
          </div>
          <div>
            <strong>{stats.totalResources.toLocaleString()}+ Materials</strong>
            <small>Across {stats.totalChannels}+ University Channels</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Send size={22} />
          </div>
          <div>
            <strong>Telegram Connected</strong>
            <small>1-Tap bot delivery</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <TrustVerifiedIcon size={24} />
          </div>
          <div>
            <strong>Verified Academic Files</strong>
            <small>AAU, ASTU, AASTU, Jimma</small>
          </div>
        </div>
      </section>

      {/* ── How StudyHub Works ──────────────────────────────────────── */}
      <section className="section container">
        <div className="section-head">
          <div>
            <span className="eyebrow" style={{ marginBottom: "10px" }}>
              <Zap size={14} className="eyebrow-icon" />
              <span>Simple 3-Step Process</span>
            </span>
            <h2>How StudyHub Works</h2>
            <p>Designed to help you find academic resources without jumping across dozens of chat groups.</p>
          </div>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <span className="step-badge">STEP 01</span>
            <h3>Search</h3>
            <p>Type any topic, course code, or exam title in natural language to query indexed university channels.</p>
          </div>

          <div className="step-card">
            <span className="step-badge">STEP 02</span>
            <h3>Discover</h3>
            <p>Browse structured results with file-type badges, multi-page exam photo albums, and curated PDF bundles.</p>
          </div>

          <div className="step-card">
            <span className="step-badge">STEP 03</span>
            <h3>Access</h3>
            <p>Read PDFs directly in your browser or receive the original files instantly via Telegram bot.</p>
          </div>
        </div>
      </section>

      {/* ── Popular Subjects Section ─────────────────────────────────── */}
      <section className="section container">
        <div className="section-head">
          <div>
            <h2>Popular Academic Subjects</h2>
            <p>Explore past exams, lecture slides, and notes grouped by academic discipline.</p>
          </div>
          <Link className="btn btn-outline" href="/subjects">
            <span>Browse All Subjects</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="subject-grid">
          {SUBJECTS.map((subj) => {
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
                  <h3>{subj.title}</h3>
                  <small>{subj.desc}</small>
                </div>
                <span className="arrow">
                  <ArrowRight size={18} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Featured / Recent Resources ─────────────────────────────── */}
      {recentResources.length > 0 && (
        <section className="section container">
          <div className="section-head">
            <div>
              <h2>Recently Indexed Materials</h2>
              <p>Fresh exams, slides, and lecture notes added to the StudyHub repository.</p>
            </div>
            <Link className="btn btn-outline" href="/explore">
              <span>View All</span>
              <ArrowRight size={15} />
            </Link>
          </div>

          <div className="resource-grid">
            {recentResources.map((item) => (
              <ResourceCard key={item._id} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ── Call to Action Banner ───────────────────────────────────── */}
      <section className="section container">
        <div className="cta">
          <div>
            <h2>Your next study session starts here.</h2>
            <p>Find past exams, lecture slides, and notes in seconds — on the web or directly in Telegram.</p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", zIndex: 1 }}>
            <Link className="btn" href="/explore">
              <span>Explore All Resources</span>
              <ArrowRight size={15} />
            </Link>
            <a
              className="btn"
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              style={{ background: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", border: "1px solid rgba(255, 255, 255, 0.3)" }}
            >
              <Send size={15} />
              <span>Open Bot</span>
            </a>
            <a
              className="btn"
              href="https://t.me/studyhub_et"
              target="_blank"
              rel="noreferrer"
              style={{ background: "rgba(255, 255, 255, 0.15)", color: "#FFFFFF", border: "1px solid rgba(255, 255, 255, 0.3)" }}
            >
              <Megaphone size={15} />
              <span>Join Channel</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
