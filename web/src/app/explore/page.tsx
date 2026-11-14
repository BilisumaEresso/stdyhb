"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Megaphone,
} from "lucide-react";
import {
  ResourceItem,
  searchResources,
  getTelegramBotDeepLink,
} from "@/lib/api";
import BrandEmblem from "@/components/BrandEmblem";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import ResourceCard from "@/components/ResourceCard";
import {
  FilePdfIcon,
  FilePptIcon,
  FileDocIcon,
  FileImageIcon,
  BundlePdfIcon,
  BundleSlidesIcon,
  BundleAlbumIcon,
  BundleDocIcon,
} from "@/components/icons";
import {
  ResourceCardSkeleton,
  ButtonLoadingState,
  InlineSpinner,
  useToast,
} from "@/components/loading";

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

type SearchStatus = "idle" | "searching" | "refreshing" | "success" | "empty" | "error";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();

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
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [searchStatus, setSearchStatus] = useState<SearchStatus>("searching");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Concurrency, Stale Request Safeguards & Scroll Anchoring
  const gridSectionRef = useRef<HTMLElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);
  const resourcesRef = useRef<ResourceItem[]>([]);
  resourcesRef.current = resources;

  const performFetch = useCallback(
    async (q: string, type: string, isExamOnly: boolean, targetPage = 1) => {
      // 1. Invalidate any in-flight requests
      searchRequestIdRef.current += 1;
      const currentRequestId = searchRequestIdRef.current;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 2. Set Appropriate Loading State
      if (resourcesRef.current.length > 0) {
        // Soft refresh: preserve existing cards while updating
        setSearchStatus("refreshing");
      } else {
        // Initial / Empty search: full skeleton view
        setSearchStatus("searching");
      }

      setErrorMessage("");

      try {
        const res = await searchResources(
          {
            q: q.trim() || undefined,
            fileType: type === "all" ? undefined : type,
            isExam: isExamOnly || undefined,
            page: targetPage,
            limit: 12,
          },
          controller.signal
        );

        // Guard against race conditions from older slow requests
        if (searchRequestIdRef.current !== currentRequestId) {
          return;
        }

        if (res && res.data) {
          setResources(res.data);
          const safePage = res.pagination?.page || targetPage;
          const safeTotal = res.pagination?.total || res.data.length;
          const safeTotalPages = res.pagination?.totalPages || 1;

          setPage(safePage);
          setTotalCount(safeTotal);
          setTotalPages(safeTotalPages);

          if (res.data.length === 0) {
            setSearchStatus("empty");
          } else {
            setSearchStatus("success");
          }
        } else {
          setResources([]);
          setTotalCount(0);
          setTotalPages(1);
          setPage(1);
          setSearchStatus("empty");
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Request was cancelled intentionally by a newer search
          return;
        }
        console.error("Explore fetch error:", err);
        setSearchStatus("error");
        setErrorMessage(
          "We could not connect to the academic repository. Please verify your connection and try again."
        );
      }
    },
    []
  );

  // Synchronize on searchParams change
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "all";
    const filter = searchParams.get("filter") || "";
    const pageParam = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

    setQuery(q);
    setFileType(type);
    if (filter === "exam") {
      setSelectedChip("Past Exams");
    } else if (q) {
      setSelectedChip(q);
    } else {
      setSelectedChip("All");
    }

    performFetch(q, type, filter === "exam", pageParam);
  }, [searchParams, performFetch]);

  const updateUrl = (q: string, type: string, isExam: boolean, newPage = 1) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type && type !== "all") params.set("type", type);
    if (isExam) params.set("filter", "exam");
    if (newPage > 1) params.set("page", newPage.toString());

    router.replace(`/explore?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(query, fileType, selectedChip === "Past Exams", 1);
  };

  const handleTypeChange = (newType: string) => {
    setFileType(newType);
    updateUrl(query, newType, selectedChip === "Past Exams", 1);
  };

  const handleChipClick = (chip: { label: string; query: string; filter: string }) => {
    setSelectedChip(chip.label);
    const isExam = chip.filter === "exam";
    const nextQuery = chip.label === "All" || chip.filter === "exam" ? "" : chip.query;
    setQuery(nextQuery);
    updateUrl(nextQuery, fileType, isExam, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    updateUrl(query, fileType, selectedChip === "Past Exams", newPage);
    performFetch(query, fileType, selectedChip === "Past Exams", newPage);
    gridSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function getPageNumbers(currentPage: number, total: number): (number | "...")[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", total];
    }
    if (currentPage >= total - 2) {
      return [1, "...", total - 3, total - 2, total - 1, total];
    }
    return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", total];
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isRefreshing = searchStatus === "refreshing";
  const isSearching = searchStatus === "searching";

  return (
    <main>
      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <section className="page-hero container">
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Academic Resource Discovery</span>
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
          <SearchAutocomplete
            id="explore-search"
            value={query}
            onChange={setQuery}
            onSubmit={(term) => {
              setQuery(term);
              updateUrl(term, fileType, selectedChip === "Past Exams");
            }}
            placeholder="Search by title, subject, course code, or topic (e.g. DBMS, Calculus)..."
          />

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
      <section ref={gridSectionRef} className="container section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2>Study Materials</h2>
              {isRefreshing && <InlineSpinner size="sm" />}
            </div>
            <p>
              {isSearching
                ? "Searching academic repository..."
                : query
                ? `Showing page ${page} of ${totalPages} · ${totalCount.toLocaleString()} ranked results for "${query}"`
                : selectedChip === "Past Exams"
                ? `Showing page ${page} of ${totalPages} · Verified past examinations`
                : `Showing page ${page} of ${totalPages} · ${totalCount.toLocaleString()} learning entities across universities`}
            </p>
          </div>
          <span className="muted" style={{ fontSize: "14px", fontWeight: 600 }}>
            {isSearching ? (
              "Loading..."
            ) : query ? (
              `${totalCount.toLocaleString()} ranked results`
            ) : (
              `${totalCount.toLocaleString()} resources available`
            )}
          </span>
        </div>

        {/* ── Resource Grid & Progressive Cards ──────────────────────── */}
        <div
          className="resource-grid"
          aria-busy={isSearching || isRefreshing}
        >
          {/* Skeletons on initial search */}
          {isSearching && <ResourceCardSkeleton count={6} />}

          {/* Actual Resource Cards */}
          {!isSearching &&
            resources.map((item) => (
              <ResourceCard
                key={item._id}
                item={item}
                onToast={(msg, type) => showToast(msg, type, 2500)}
              />
            ))}
        </div>

        {/* ── Empty State ───────────────────────────────────────────── */}
        {searchStatus === "empty" && (
          <div id="empty-state" className="empty">
            <img
              src="/assets/mascot.png"
              alt="StudyHub Mascot"
              className="empty-mascot"
            />
            <h3>Nothing found yet.</h3>
            <p
              style={{
                marginTop: "6px",
                maxWidth: "420px",
                margin: "6px auto 18px",
                color: "var(--muted)",
              }}
            >
              Try another course name, subject, or keyword. You can also explore popular subjects or clear your filters.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setQuery("");
                setSelectedChip("All");
                setFileType("all");
                updateUrl("", "all", false, 1);
              }}
            >
              Clear Filters & Show All
            </button>
          </div>
        )}

        {/* ── Error & Retry State ───────────────────────────────────── */}
        {searchStatus === "error" && (
          <div className="empty" role="alert" aria-live="assertive">
            <AlertCircle
              size={40}
              style={{ color: "var(--accent, #EF4444)", margin: "0 auto 12px" }}
            />
            <h3 style={{ fontSize: "19px" }}>Unable to Load Resources</h3>
            <p
              style={{
                maxWidth: "420px",
                margin: "6px auto 18px",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              {errorMessage || "We ran into an issue retrieving study materials. Please try again."}
            </p>
            <ButtonLoadingState
              variant="primary"
              onClick={() => performFetch(query, fileType, selectedChip === "Past Exams", 1)}
            >
              <RefreshCw size={14} />
              <span>Retry Search</span>
            </ButtonLoadingState>
          </div>
        )}

        {/* ── Exploration Pagination Controls ───────────────────────── */}
        {searchStatus === "success" && totalPages > 1 && (
          <nav className="explore-pagination" aria-label="Explore Resources Pagination">
            <button
              type="button"
              className="pagination-btn"
              disabled={page <= 1 || isRefreshing}
              onClick={() => handlePageChange(page - 1)}
              aria-label="Previous Page"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <div className="pagination-pages">
              {getPageNumbers(page, totalPages).map((p, idx) =>
                p === "..." ? (
                  <span key={`ellipsis-${idx}`} className="pagination-ellipsis" aria-hidden="true">
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    type="button"
                    className={`pagination-page-btn ${page === p ? "active" : ""}`}
                    onClick={() => handlePageChange(p as number)}
                    aria-current={page === p ? "page" : undefined}
                    aria-label={`Page ${p}`}
                    disabled={isRefreshing}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="pagination-btn"
              disabled={page >= totalPages || isRefreshing}
              onClick={() => handlePageChange(page + 1)}
              aria-label="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>

            <span className="pagination-indicator">
              Page {page} of {totalPages}
            </span>
          </nav>
        )}

        {/* ── Community Banner ────────────────────────────────────────── */}
        <div
          style={{
            marginTop: "48px",
            padding: "20px 24px",
            background: "var(--surface-hover)",
            borderRadius: "16px",
            border: "1px solid var(--card-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "var(--primary-soft)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "14px", color: "var(--foreground)" }}>
                Prefer searching on Telegram?
              </strong>
              <small style={{ color: "var(--muted)", fontSize: "12px" }}>
                Send files to private chats or groups via @{process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot"} · Announcements on @studyhub_et
              </small>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <a
              className="btn btn-outline"
              href="https://t.me/studyhub_et"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "13px", padding: "8px 14px" }}
            >
              <Megaphone size={14} />
              <span>Channel</span>
            </a>
            <a
              className="btn btn-primary"
              href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "studyhub_resource_bot"}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: "13px", padding: "8px 14px" }}
            >
              <Send size={14} />
              <span>Open Bot</span>
            </a>
          </div>
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
