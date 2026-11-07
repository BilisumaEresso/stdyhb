"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  Filter,
  Send,
  Layers,
  GraduationCap,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  ResourceItem,
  searchResources,
  getTelegramBotDeepLink,
} from "@/lib/api";

const FILTER_CHIPS = [
  { label: "All", query: "", filter: "" },
  { label: "Past Exams", query: "Exam", filter: "exam" },
  { label: "DBMS", query: "DBMS", filter: "" },
  { label: "DSA", query: "DSA", filter: "" },
  { label: "OOP", query: "OOP", filter: "" },
  { label: "Calculus", query: "Calculus", filter: "" },
  { label: "Computer Networks", query: "Computer Networks", filter: "" },
  { label: "Operating Systems", query: "Operating Systems", filter: "" },
];

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "all";
  const initialFilter = searchParams.get("filter") || "";

  const [query, setQuery] = useState(initialQ);
  const [fileType, setFileType] = useState(initialType);
  const [selectedChip, setSelectedChip] = useState(
    initialFilter === "exam" ? "Past Exams" : initialQ || "All"
  );
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize on searchParams change
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all";
    const filter = searchParams.get("filter") || "";
    setQuery(q);
    setFileType(type);
    if (filter === "exam") {
      setSelectedChip("Past Exams");
    } else if (q) {
      setSelectedChip(q);
    } else {
      setSelectedChip("All");
    }
    performFetch(q, type, filter === "exam");
  }, [searchParams]);

  const performFetch = async (q: string, type: string, isExamOnly: boolean) => {
    setIsLoading(true);
    const res = await searchResources({
      q: q.trim() || undefined,
      fileType: type === "all" ? undefined : type,
      isExam: isExamOnly || undefined,
    });

    if (res?.data) {
      setResources(res.data);
      setTotalCount(res.pagination?.total || res.data.length);
    } else {
      setResources([]);
      setTotalCount(0);
    }
    setIsLoading(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(query, fileType, selectedChip === "Past Exams");
  };

  const handleTypeChange = (newType: string) => {
    setFileType(newType);
    updateUrl(query, newType, selectedChip === "Past Exams");
  };

  const handleChipClick = (chip: { label: string; query: string; filter: string }) => {
    setSelectedChip(chip.label);
    const isExam = chip.filter === "exam";
    const nextQuery = chip.label === "All" || chip.filter === "exam" ? "" : chip.query;
    setQuery(nextQuery);
    updateUrl(nextQuery, fileType, isExam);
  };

  const updateUrl = (q: string, type: string, isExam: boolean) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type && type !== "all") params.set("type", type);
    if (isExam) params.set("filter", "exam");

    router.replace(`/explore?${params.toString()}`);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main>
      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <section className="page-hero container">
        <span className="eyebrow">
          <span className="dot"></span> Academic Resource Discovery
        </span>
        <h1>
          Explore <span className="accent">Academic Resources</span>
        </h1>
        <p>
          Find lecture notes, past examinations, presentations, and other learning materials collected
          from Ethiopian university communities.
        </p>

        {/* Toolbar */}
        <div className="toolbar">
          <form className="searchbar" onSubmit={handleSearchSubmit}>
            <span className="search-icon">
              <Search size={20} />
            </span>
            <input
              id="explore-search"
              aria-label="Search by title, subject, course code, or topic"
              placeholder="Search by title, subject, course code, or topic (e.g. DBMS, Calculus)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <span>Search</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <select
            id="type-filter"
            aria-label="Filter by file type"
            value={fileType}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="all">All File Types</option>
            <option value="pdf">PDF Documents</option>
            <option value="ppt">PowerPoint Slides</option>
            <option value="doc">Word Documents</option>
            <option value="image">Exam Photo Albums</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div className="filter-row">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className={`chip ${selectedChip === chip.label ? "selected" : ""}`}
              onClick={() => handleChipClick(chip)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* ── Resources Grid Section ─────────────────────────────────── */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Study Materials</h2>
            <p>
              {isLoading
                ? "Searching academic repository..."
                : query
                ? `Showing results matching "${query}"`
                : selectedChip === "Past Exams"
                ? "Verified past midterm and final examinations"
                : "Latest academic resources indexed from university channels"}
            </p>
          </div>
          <span className="muted" style={{ fontSize: "14px", fontWeight: 600 }}>
            {isLoading ? "Loading..." : `${totalCount.toLocaleString()} resources available`}
          </span>
        </div>

        <div className="resource-grid">
          {resources.map((item) => {
            const isGroup = Boolean(item.groupId);
            const groupSize = item.groupTotal || (item as any).groupSize || 1;

            let typeClass = item.fileType || "pdf";
            let typeBadge = (item.fileType || "PDF").toUpperCase();
            let bundleBadge = "";

            if (isGroup) {
              if (item.fileType === "image") {
                typeClass = "image";
                typeBadge = "ALBUM";
                bundleBadge = `${groupSize}-Page Photo Album`;
              } else if (item.fileType === "pdf") {
                typeClass = "pdf";
                typeBadge = "BUNDLE";
                bundleBadge = `${groupSize}-File PDF Bundle`;
              } else if (item.fileType === "ppt") {
                typeClass = "ppt";
                typeBadge = "SLIDES";
                bundleBadge = `${groupSize}-Slide PPT Pack`;
              } else if (item.fileType === "doc") {
                typeClass = "doc";
                typeBadge = "PACKET";
                bundleBadge = `${groupSize}-Doc Packet`;
              } else {
                typeClass = "doc";
                typeBadge = "BUNDLE";
                bundleBadge = `${groupSize}-Item Bundle`;
              }
            }

            const sizeText = formatFileSize(item.fileSize);
            const sourceName = item.channelUsername
              ? `@${item.channelUsername}`
              : item.university
              ? `${item.university}`
              : "University Channel";

            const displayTitle = (item as any).cleanTitle || (item as any).title || item.fileName || "Academic Resource";

            return (
              <article key={item._id} className="resource-card">
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div className={`file-type ${typeClass}`}>{typeBadge}</div>
                  {bundleBadge && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "8px",
                        background: "var(--primary-soft)",
                        color: "var(--primary)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Layers size={11} />
                      <span>{bundleBadge}</span>
                    </span>
                  )}
                  {item.isExam && (
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "8px",
                        background: "var(--gold-soft)",
                        color: "var(--gold)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <GraduationCap size={12} />
                      <span>Past Exam</span>
                    </span>
                  )}
                </div>

                <h3>
                  <Link href={`/resource/${item._id}`} style={{ color: "inherit" }}>
                    {displayTitle}
                  </Link>
                </h3>

                <div className="resource-meta">
                  <span>{item.courseCode || item.university || "Academic"}</span>
                  {sizeText && (
                    <>
                      <span>•</span>
                      <span>{sizeText}</span>
                    </>
                  )}
                  {item.downloadCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{item.downloadCount} downloads</span>
                    </>
                  )}
                </div>

                <div className="resource-bottom">
                  <span className="source">{sourceName}</span>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Link className="resource-link" href={`/resource/${item._id}`}>
                      <span>{isGroup ? "View Bundle" : "Details"}</span>
                      <ArrowRight size={13} />
                    </Link>
                    <a
                      className="resource-link"
                      style={{ color: "var(--primary)" }}
                      href={getTelegramBotDeepLink(item._id, Boolean(item.groupId))}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={isGroup ? "Get complete bundle via Telegram" : "Deliver file via Telegram Bot"}
                    >
                      <Send size={13} />
                      <span>Bot</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Empty State with Mascot */}
          {!isLoading && resources.length === 0 && (
            <div id="empty-state" className="empty">
              <img
                src="/assets/mascot.png"
                alt="StudyHub Mascot"
                className="empty-mascot"
              />
              <h3>Nothing found yet.</h3>
              <p style={{ marginTop: "6px", maxWidth: "420px", margin: "6px auto 18px", color: "var(--muted)" }}>
                Try another course name, subject, or keyword. You can also explore popular subjects or clear your filters.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setQuery("");
                  setSelectedChip("All");
                  setFileType("all");
                  updateUrl("", "all", false);
                }}
              >
                Clear Filters & Show All
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="resource-card"
                style={{
                  opacity: 0.5,
                  minHeight: "220px",
                  background: "var(--surface-2)",
                  animation: "pulse 1.5s infinite ease-in-out",
                }}
              />
            ))}
        </div>
      </section>
    </main>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "80px 0", textAlign: "center" }}>
          <p className="muted">Loading academic resource library...</p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
