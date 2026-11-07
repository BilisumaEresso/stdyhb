import Link from "next/link";
import {
  HelpCircle,
  Search,
  Send,
  Download,
  BookOpen,
  FolderArchive,
  Images,
  FileText,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";
import {
  FilePdfIcon,
  FileExamIcon,
  BundleAlbumIcon,
  BundlePdfIcon,
  TrustTelegramIcon,
  TrustVerifiedIcon,
  TrustSpeedIcon,
} from "@/components/icons";

export const metadata = {
  title: "Help & Student Guide | StudyHub",
  description:
    "Learn how to discover academic materials, past exams, lecture notes, and receive files instantly via the StudyHub Telegram bot.",
};

const faqs = [
  {
    q: "How do I receive materials directly on my Telegram?",
    a: "Every resource card has a 'Send to Bot' button. Clicking it opens our official Telegram companion (@studyhub_resource_bot) and automatically delivers the document or past exam straight to your Telegram chat or Saved Messages. This allows you to study without downloading large files through a mobile browser.",
  },
  {
    q: "Is StudyHub completely free to use?",
    a: "Yes! StudyHub is 100% free for all Ethiopian university students. Our mission is to make educational resources, past examinations, and reference lecture notes open and universally accessible.",
  },
  {
    q: "What is the difference between Single Files, Curated Bundles, and Photo Albums?",
    a: "A Single File is a standalone PDF, slide presentation, or document. A Curated Bundle is a multi-file collection grouped by topic or course (e.g., lecture slides + syllabus + lab manual). A Photo Album is a multi-page scanned exam or handwritten model answer presented in a responsive lightbox viewer.",
  },
  {
    q: "Which Ethiopian universities are represented on StudyHub?",
    a: "Materials are aggregated and indexed from public student channels across Addis Ababa University (AAU), Adama Science and Technology University (ASTU), Addis Ababa Science and Technology University (AASTU), Jimma University, Hawassa University, Bahir Dar University, University of Gondar, and specialized engineering colleges.",
  },
  {
    q: "How can I search for past exams specifically?",
    a: "You can go to the Explore page and select 'Past Exam' under the File Type filter, or search keywords such as 'Midterm', 'Final Exam', 'Exit Exam', or 'COC'. Popular search tags on the homepage also offer 1-tap filters for common exam topics.",
  },
  {
    q: "Can my student batch or department channel contribute materials?",
    a: "Yes! If you manage a Telegram study group, academic batch channel, or have verified exam archives, reach out to our bot via @studyhub_resource_bot or our Telegram student support. We verify materials before making them publicly searchable.",
  },
];

export default function HelpPage() {
  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot";

  return (
    <main>
      {/* Page Hero */}
      <section className="page-hero container">
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Student Guide & FAQ</span>
        </span>
        <h1>
          How to get the most out of <span className="accent">StudyHub.</span>
        </h1>
        <p>
          Find past examinations, lecture notes, and reference books easily. Learn how to search,
          preview in browser, or receive files directly inside Telegram.
        </p>
      </section>

      {/* 3 Quick-Start Steps */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>
              Getting Started in <span className="accent">3 Easy Steps</span>
            </h2>
            <p>Master resource discovery on StudyHub in less than two minutes.</p>
          </div>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <span className="step-badge">Step 01</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Search size={20} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0 }}>Search with Precision</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Enter your course code (e.g., <code>CoSc2011</code>), course title, or subject. Filter by
              resource format: Single PDF, Curated Course Bundle, or Photo Exam Album.
            </p>
          </div>

          <div className="step-card">
            <span className="step-badge">Step 02</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <TrustTelegramIcon size={22} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0 }}>1-Tap Telegram Delivery</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Click <strong>&quot;Send to Bot&quot;</strong> on any resource. Our companion bot{" "}
              <code>@{botUsername}</code> instantly sends the original document file right into your
              Telegram app.
            </p>
          </div>

          <div className="step-card">
            <span className="step-badge">Step 03</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <Download size={20} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0 }}>Study Offline Any Time</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6" }}>
              Save incoming documents to your Telegram &quot;Saved Messages&quot; or forward them to your study
              circle. Once downloaded, files remain available even with intermittent mobile data.
            </p>
          </div>
        </div>
      </section>

      {/* Resource Types Guide */}
      <section className="container section">
        <div className="section-head">
          <div>
            <h2>
              Understanding <span className="accent">Resource Formats</span>
            </h2>
            <p>StudyHub indexes academic content in three distinct tiers.</p>
          </div>
        </div>

        <div className="value-grid">
          <div className="value-card" style={{ borderLeft: "4px solid var(--primary)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <FilePdfIcon size={24} style={{ color: "var(--primary)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Single Documents & PDFs</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
              Standard academic files: official course syllabi, professor lecture slides (.pptx),
              laboratory manuals, and past midterm question sheets. You can preview PDF documents
              directly inside the web browser.
            </p>
          </div>

          <div className="value-card" style={{ borderLeft: "4px solid var(--gold)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <BundlePdfIcon size={24} style={{ color: "var(--gold)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Curated Multi-File Bundles</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
              Comprehensive semester archives containing multiple related files. When you request a bundle,
              the Telegram bot delivers all chapters, worksheets, and model solutions in a coherent packet.
            </p>
          </div>

          <div className="value-card" style={{ borderLeft: "4px solid var(--green)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <BundleAlbumIcon size={24} style={{ color: "var(--green)" }} />
              <h3 style={{ margin: 0, fontSize: "17px" }}>Photo Exam Lightboxes</h3>
            </div>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6", margin: 0 }}>
              Scanned paper exams and handwritten board solutions shared across campus channels. View each
              page high-resolution in our full-screen responsive image viewer.
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="container section">
        <div className="section-head">
          <div>
            <h2>
              Frequently Asked <span className="accent">Questions</span>
            </h2>
            <p>Quick answers to common questions about finding and sharing materials.</p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "18px" }}>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span
                  style={{
                    color: "var(--primary)",
                    background: "var(--primary-soft)",
                    width: "28px",
                    height: "28px",
                    borderRadius: "8px",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Q
                </span>
                <strong style={{ fontSize: "15px", color: "var(--text)", lineHeight: "1.4" }}>
                  {faq.q}
                </strong>
              </div>
              <p
                className="muted"
                style={{ fontSize: "14px", lineHeight: "1.6", margin: 0, paddingLeft: "38px" }}
              >
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Telegram Bot Commands Strip */}
      <section className="container section">
        <div
          style={{
            background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "32px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "28px",
            alignItems: "center",
          }}
        >
          <div>
            <span className="eyebrow" style={{ marginBottom: "12px" }}>
              <TrustTelegramIcon size={16} />
              <span>Telegram Companion</span>
            </span>
            <h2 style={{ fontSize: "24px", marginBottom: "12px" }}>
              StudyHub Bot Commands
            </h2>
            <p className="muted" style={{ fontSize: "14px", lineHeight: "1.6", marginBottom: "20px" }}>
              You can search directly inside Telegram without opening a browser. Open a chat with{" "}
              <strong>@{botUsername}</strong> and try these commands:
            </p>
            <a
              className="btn btn-primary"
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noreferrer"
            >
              <Send size={15} />
              <span>Launch @{botUsername}</span>
            </a>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              padding: "18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, fontSize: "13px" }}>/start</code>
              <span className="muted" style={{ fontSize: "13px" }}>
                Initialize the bot and browse main academic categories.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, fontSize: "13px" }}>/help</code>
              <span className="muted" style={{ fontSize: "13px" }}>
                View instructions and tips for locating rare course notes.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, fontSize: "13px" }}>/search [term]</code>
              <span className="muted" style={{ fontSize: "13px" }}>
                Instant query across 80,000+ indexed documents.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
              <code style={{ color: "var(--primary)", fontWeight: 700, fontSize: "13px" }}>/exams</code>
              <span className="muted" style={{ fontSize: "13px" }}>
                Filter exclusively for university midterm and exit exams.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="container section" style={{ paddingBottom: "70px" }}>
        <div className="cta-box">
          <h2>
            Ready to find your <span className="accent">study materials?</span>
          </h2>
          <p>
            Search thousands of past exams, lecture notes, and reference books tailored for Ethiopian university students.
          </p>
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/explore">
              <span>Start Searching</span>
              <ArrowRight size={15} />
            </Link>
            <Link className="btn btn-outline" href="/subjects">
              <span>Browse Subjects</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
