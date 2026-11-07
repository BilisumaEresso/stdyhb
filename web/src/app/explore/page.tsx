"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ResourceItem,
  searchResources,
  getFileStreamUrl,
  getFileDownloadUrl,
  getTelegramBotDeepLink,
} from "@/lib/api";

const FILTER_CHIPS = [
  "All",
  "DBMS",
  "DSA",
  "OOP",
  "Exam",
  "Lecture notes",
  "Computer Networks",
];

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "all";
  const initialFilter = searchParams.get("filter") || "";

  const [query, setQuery] = useState(initialQ);
  const [fileType, setFileType] = useState(initialType);
  const [selectedChip, setSelectedChip] = useState(initialFilter || (initialQ ? "" : "All"));
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Sync with searchParams if they change
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all";
    const filter = searchParams.get("filter") || "";
    setQuery(q);
    setFileType(type);
    if (filter) setSelectedChip(filter);
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
    updateUrl(query, fileType, selectedChip === "Exam");
  };

  const handleTypeChange = (newType: string) => {
    setFileType(newType);
    updateUrl(query, newType, selectedChip === "Exam");
  };

  const handleChipClick = (chip: string) => {
    setSelectedChip(chip);
    let nextQuery = query;
    let isExam = false;

    if (chip === "All") {
      nextQuery = "";
    } else if (chip === "Exam") {
      isExam = true;
    } else {
      nextQuery = chip;
    }

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
          <i className="dot"></i> Resource library
        </span>
        <h1>
          Explore <span className="accent">resources.</span>
        </h1>
        <p>
          Search through study materials collected from academic communities. Filter by file type and
          discover resources for your courses.
        </p>

        {/* Toolbar */}
        <div className="toolbar">
          <form className="searchbar" onSubmit={handleSearchSubmit}>
            <span className="search-icon">⌕</span>
            <input
              id="explore-search"
              placeholder="Search by title, subject, course code, or topic..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>

          <select
            id="type-filter"
            aria-label="Filter by file type"
            value={fileType}
            onChange={(e) => handleTypeChange(e.target.value)}
          >
            <option value="all">All file types</option>
            <option value="pdf">PDF</option>
            <option value="ppt">PowerPoint</option>
            <option value="doc">Word document</option>
            <option value="image">Exam Photo Album</option>
          </select>
        </div>

        {/* Filter Chips */}
        <div className="filter-row">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className={`chip ${selectedChip === chip ? "selected" : ""}`}
              onClick={() => handleChipClick(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </section>

      {/* ── Resources Grid Section ─────────────────────────────────── */}
      <section className="container section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>Study materials</h2>
            <p>
              {isLoading
                ? "Searching repository..."
                : query
                ? `Results matching "${query}"`
                : "Latest academic resources indexed from university channels"}
            </p>
          </div>
          <span className="muted" style={{ fontSize: "13px" }}>
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
              ? `${item.university} Resource`
              : "University Channel";

            const displayTitle = (item as any).title || item.fileName || item.caption || "Academic Resource";

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
                        background: "var(--green-soft)",
                        color: "var(--green)",
                      }}
                    >
                      {bundleBadge}
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
                  {item.isExam && (
                    <>
                      <span>•</span>
                      <span style={{ color: "var(--orange)", fontWeight: 700 }}>Past Exam</span>
                    </>
                  )}
                  {sizeText && (
                    <>
                      <span>•</span>
                      <span>{sizeText}</span>
                    </>
                  )}
                  {item.downloadCount > 0 && (
                    <>
                      <span>•</span>
                      <span>{item.downloadCount} dl</span>
                    </>
                  )}
                </div>

                <div className="resource-bottom">
                  <span className="source">↗ {sourceName}</span>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <Link className="resource-link" href={`/resource/${item._id}`}>
                      {isGroup ? "View Bundle →" : "Details →"}
                    </Link>
                    <a
                      className="resource-link"
                      style={{ color: "var(--blue)" }}
                      href={getTelegramBotDeepLink(item._id, Boolean(item.groupId))}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={isGroup ? "Get complete bundle via Telegram" : "Deliver file via Telegram Bot"}
                    >
                      Bot ↗
                    </a>
                  </div>
                </div>
              </article>
            );
          })}

          {!isLoading && resources.length === 0 && (
            <div id="empty-state" className="empty">
              <h3>No matching resources found</h3>
              <p style={{ marginTop: "6px" }}>
                Try adjusting your search terms, removing filters, or browsing by subject.
              </p>
            </div>
          )}

          {isLoading &&
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="resource-card"
                style={{
                  opacity: 0.5,
                  minHeight: "220px",
                  background: "var(--surface-2)",
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
        <div className="container" style={{ padding: "60px 0", textAlign: "center" }}>
          <p className="muted">Loading resource library...</p>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
