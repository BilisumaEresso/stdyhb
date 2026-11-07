"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Send,
  Download,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  HelpCircle,
  FileSearch,
  Layers,
  GraduationCap,
} from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";
import {
  FileExamIcon,
} from "@/components/icons";

interface FAQItem {
  id: string;
  category: "all" | "bot" | "exams" | "formats" | "universities";
  categoryLabel: string;
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    id: "telegram-bot-dl",
    category: "bot",
    categoryLabel: "Telegram Bot",
    question: "How do I receive academic documents directly to Telegram?",
    answer:
      "Every document, slide deck, or exam on StudyHub includes a 'Send to Bot' button. Clicking it launches our official companion bot (@studyhub_resource_bot) in Telegram. The bot immediately transfers the original uncompressed PDF or document straight into your chat. This saves significant mobile internet data by avoiding third-party browser download redirections.",
  },
  {
    id: "free-access",
    category: "all",
    categoryLabel: "General",
    question: "Is StudyHub completely free for Ethiopian university students?",
    answer:
      "Yes, 100% free. StudyHub was created to eliminate the friction of searching through chaotic Telegram channels. All past exams, model answer keys, lecture slides, and course handouts are freely accessible without paywalls, sign-up requirements, or advertising traps.",
  },
  {
    id: "finding-exams",
    category: "exams",
    categoryLabel: "Past Exams",
    question: "How do I find past midterm, final, and university exit exams?",
    answer:
      "You can filter specifically for exams on the Explore page by selecting 'Past Exam' in the format selector, or search by course code (e.g., 'CoSc2011', 'Math1011') or keywords like 'Exit Exam', 'COC', 'Midterm', or 'Model Exam'. Many exam listings also include handwritten step-by-step model solutions from top scoring students.",
  },
  {
    id: "formats-diff",
    category: "formats",
    categoryLabel: "Resource Formats",
    question: "What is the difference between Single Files, Curated Bundles, and Photo Albums?",
    answer:
      "Single Files are individual documents like lecture slides (.pptx) or lab handouts (.pdf). Curated Bundles are complete course packages containing multiple chapters, sample exercises, and reference notes organized together. Photo Exam Albums are multi-page scans of physical paper exams displayed in a full-screen, pinch-to-zoom web lightbox viewer.",
  },
  {
    id: "offline-reading",
    category: "bot",
    categoryLabel: "Telegram Bot",
    question: "Can I save materials to study offline when internet is unavailable?",
    answer:
      "Yes! When our Telegram bot delivers your requested material, tap the file menu and select 'Save to Downloads' or forward it to your Telegram 'Saved Messages'. Telegram stores downloaded documents on your device so you can review lecture notes and past exams without an active data connection.",
  },
  {
    id: "supported-universities",
    category: "universities",
    categoryLabel: "Universities",
    question: "Which Ethiopian universities and colleges are indexed?",
    answer:
      "StudyHub indexes academic repositories across Addis Ababa University (AAU - 4 Kilo, 5 Kilo, 6 Kilo, FBE), Adama Science & Technology University (ASTU), Addis Ababa Science & Technology University (AASTU), Jimma University (JU), Hawassa University (HU), Bahir Dar University (BDU), University of Gondar (UoG), Haramaya University, and specialized medical and engineering faculties.",
  },
  {
    id: "contribute-channel",
    category: "universities",
    categoryLabel: "Universities",
    question: "How can our campus channel or student batch submit study materials?",
    answer:
      "If you manage an academic batch channel, study group, or have digital copies of verified previous year exams, message @studyhub_resource_bot with the '/contribute' command or share your channel link. Our academic review team verifies files for quality and legibility before publishing them to the public discovery index.",
  },
  {
    id: "preview-issues",
    category: "formats",
    categoryLabel: "Troubleshooting",
    question: "What should I do if a web PDF preview loads slowly or fails?",
    answer:
      "Certain complex PDF files containing embedded high-resolution graphics can take longer to stream in the web browser on slow 3G mobile connections. If a preview stalls, simply tap 'Send to Bot' to have the complete file delivered instantly over Telegram's optimized protocol.",
  },
];

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [openFaqId, setOpenFaqId] = useState<string | null>("telegram-bot-dl");

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  const categories = [
    { id: "all", label: "All Questions" },
    { id: "bot", label: "Telegram Bot Companion" },
    { id: "exams", label: "Past Exams & Midterms" },
    { id: "formats", label: "PDFs, Bundles & Albums" },
    { id: "universities", label: "Universities & Contributing" },
  ];

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory =
        activeCategory === "all" || faq.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.categoryLabel.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  return (
    <main>
      {/* Redesigned Student Help Hero */}
      <section className="container">
        <div className="help-hero">
          <span className="eyebrow" style={{ display: "inline-flex", margin: "0 auto 16px" }}>
            <BrandEmblem size={16} />
            <span>Student Knowledge & Help Center</span>
          </span>
          <h1>
            How can we help your <span className="accent">studies today?</span>
          </h1>
          <p>
            Quick guides, search strategies, Telegram bot companion commands, and answers to common
            student questions across Ethiopian universities.
          </p>

          {/* Interactive Search Bar */}
          <div className="help-search-box">
            <Search size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search help topics, exit exams, bot commands, or file formats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="btn btn-ghost"
                style={{ width: "28px", height: "28px", fontSize: "12px", border: "0" }}
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="help-category-pills">
            {categories.map((cat) => (
              <button
                key={cat.id}
                className={`help-pill ${activeCategory === cat.id ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Featured Quick Guide Cards */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>
              Essential Guides for <span className="accent">Academic Success</span>
            </h2>
            <p>Four key techniques to locate course materials faster than ever before.</p>
          </div>
        </div>

        <div className="steps-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div className="step-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <FileSearch size={22} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Course Code Queries</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Use official curriculum course numbers such as <code>CoSc2011</code>, <code>Math1011</code>, or <code>Phys1011</code>. This returns exact department syllabus matches.
            </p>
          </div>

          <div className="step-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <Send size={20} style={{ color: "var(--cyan)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>1-Tap Telegram Delivery</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Tap <strong>&quot;Send to Bot&quot;</strong> on any resource. Our verified Telegram companion sends the file straight into your Telegram app with zero mobile browser data waste.
            </p>
          </div>

          <div className="step-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <Layers size={22} style={{ color: "var(--gold)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Curated Bundles</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Don&apos;t download files one by one. Curated bundles combine lecture slides, lab manuals, and chapter worksheets into one coherent multi-file course packet.
            </p>
          </div>

          <div className="step-card">
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <FileExamIcon size={22} style={{ color: "var(--green)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Exam Model Solutions</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Search for midterm and final papers with handwritten step-by-step workings and model answers verified by senior top-scoring students.
            </p>
          </div>
        </div>
      </section>

      {/* Telegram Bot Simulation Card */}
      <section className="container section">
        <div className="telegram-sim-box">
          {/* Simulated Chat Interface */}
          <div className="sim-chat-view">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--green)" }} />
              <strong style={{ fontSize: "13px", color: "var(--muted)" }}>
                StudyHub Bot Demo Chat
              </strong>
            </div>

            <div className="sim-bubble-user">
              <span>/exams Database Systems</span>
            </div>

            <div className="sim-bubble-bot">
              <p style={{ margin: "0 0 6px 0", fontWeight: 700, fontSize: "13px", color: "var(--primary)" }}>
                StudyHub Resource Bot
              </p>
              <p style={{ margin: 0, fontSize: "13px" }}>
                Found <strong>6 verified past examinations</strong> for Database Systems (AAU / ASTU / AASTU).
              </p>
              <div className="sim-btn-row">
                <span className="sim-inline-btn">
                  <Download size={13} />
                  <span>Download Exam PDF (3.4 MB)</span>
                </span>
                <span className="sim-inline-btn">
                  <ExternalLink size={13} />
                  <span>Preview Solutions</span>
                </span>
              </div>
            </div>
          </div>

          {/* Bot Info & Commands */}
          <div className="sim-info-view">
            <span className="eyebrow" style={{ marginBottom: "12px" }}>
              <Send size={14} />
              <span>Mobile-First Companion</span>
            </span>
            <h2 style={{ fontSize: "24px", margin: "0 0 10px" }}>
              The Power of @{botUsername}
            </h2>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "22px" }}>
              Students in Ethiopia often face intermittent mobile networks. Our Telegram bot transfers original files using Telegram&apos;s reliable resume-capable protocol.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", fontSize: "13px" }}>
                <code style={{ color: "var(--primary)", fontWeight: 700 }}>/start</code>
                <span className="muted">Initialize bot & access directory categories</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", fontSize: "13px" }}>
                <code style={{ color: "var(--primary)", fontWeight: 700 }}>/search [course]</code>
                <span className="muted">Instant query across 70,000+ indexed academic resources</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", fontSize: "13px" }}>
                <code style={{ color: "var(--primary)", fontWeight: 700 }}>/exams [subject]</code>
                <span className="muted">Filter directly for midterms, finals, and COC papers</span>
              </div>
            </div>

            <a
              className="btn btn-primary"
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
              <Send size={15} />
              <span>Launch @{botUsername}</span>
            </a>
          </div>
        </div>
      </section>

      {/* Interactive FAQ Accordion */}
      <section className="container section">
        <div className="section-head" style={{ textAlign: "center", display: "block", marginBottom: "32px" }}>
          <h2>
            Frequently Asked <span className="accent">Questions</span>
          </h2>
          <p>
            {filteredFaqs.length} {filteredFaqs.length === 1 ? "answer" : "answers"} found
            {activeCategory !== "all" && ` in ${categories.find((c) => c.id === activeCategory)?.label}`}
            {searchQuery && ` matching "${searchQuery}"`}.
          </p>
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="empty" style={{ maxWidth: "600px", margin: "0 auto" }}>
            <HelpCircle size={40} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
            <h3>No matching questions found</h3>
            <p className="muted" style={{ fontSize: "14px" }}>
              Try searching with different terms or reset your category filter.
            </p>
            <button
              className="btn btn-outline"
              style={{ marginTop: "14px" }}
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="faq-list">
            {filteredFaqs.map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className={`faq-card ${isOpen ? "open" : ""}`}>
                  <button
                    className="faq-header"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    aria-expanded={isOpen}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <span className="faq-icon-tag">
                        <HelpCircle size={17} />
                      </span>
                      <span>{faq.question}</span>
                    </div>
                    <ChevronDown size={18} className="faq-chevron" />
                  </button>

                  {isOpen && (
                    <div className="faq-body">
                      <p style={{ margin: 0 }}>{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Campus Channel Contribution & Support Banner */}
      <section className="container section" style={{ paddingBottom: "70px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
            border: "1px solid var(--card-border)",
            borderRadius: "22px",
            padding: "44px 32px",
            textAlign: "center",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <span className="eyebrow" style={{ display: "inline-flex", margin: "0 auto 14px" }}>
            <GraduationCap size={16} />
            <span>Campus Community Program</span>
          </span>
          <h2 style={{ fontSize: "26px", margin: "0 auto 12px", maxWidth: "600px" }}>
            Missing course materials from <span className="accent">your department?</span>
          </h2>
          <p
            className="muted"
            style={{ fontSize: "15px", lineHeight: "1.6", maxWidth: "580px", margin: "0 auto 24px" }}
          >
            StudyHub grows through community collaboration. If your class batch channel or student group has past exams, notes, or lab sheets, send them our way!
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <a
              className="btn btn-primary"
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
            >
              <Send size={15} />
              <span>Submit Materials via Bot</span>
            </a>
            <Link className="btn btn-outline" href="/explore">
              <span>Back to Library</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
