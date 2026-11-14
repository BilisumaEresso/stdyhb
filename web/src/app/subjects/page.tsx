"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, X, Compass, Layers, GraduationCap, BookOpen, CheckCircle2 } from "lucide-react";
import BrandEmblem from "@/components/BrandEmblem";
import TaxonomyIcon from "@/components/TaxonomyIcon";
import {
  COLLECTIONS,
  EDUCATION_GROUPS,
  SUBJECT_CATEGORIES,
  getCategoriesByGroup,
  Collection,
  SubjectCategory,
  EducationGroup,
} from "@/lib/taxonomy";

const COLLECTION_TAGLINES: Record<string, string> = {
  "study-materials": "Notes, textbooks & outlines",
  "ethiopian-fiction-reading": "Novels & cultural literature",
  "past-exams-entrance-exit": "Midterm, final & exit exams",
  "university-freshman-courses": "1st-year common curriculum",
};

export default function SubjectsPage() {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("all");

  const normalizedQuery = filterQuery.toLowerCase().trim();

  // Filter categories matching search
  const matchesQuery = (cat: SubjectCategory) => {
    if (!normalizedQuery) return true;
    return (
      cat.name.toLowerCase().includes(normalizedQuery) ||
      cat.description.toLowerCase().includes(normalizedQuery) ||
      (cat.disciplines && cat.disciplines.some((d) => d.toLowerCase().includes(normalizedQuery))) ||
      (cat.departments && cat.departments.some((d) => d.toLowerCase().includes(normalizedQuery))) ||
      (cat.aliases && cat.aliases.some((a) => a.toLowerCase().includes(normalizedQuery))) ||
      (cat.keywords && cat.keywords.some((k) => k.toLowerCase().includes(normalizedQuery)))
    );
  };

  // Filter collections matching search
  const filteredCollections = COLLECTIONS.filter((col) => {
    if (!normalizedQuery) return true;
    return (
      col.name.toLowerCase().includes(normalizedQuery) ||
      col.description.toLowerCase().includes(normalizedQuery) ||
      (col.aliases && col.aliases.some((a) => a.toLowerCase().includes(normalizedQuery)))
    );
  });

  // Groups to display based on activeGroupFilter
  const visibleGroups = EDUCATION_GROUPS.filter((grp) => {
    if (activeGroupFilter === "all") return true;
    return grp.id === activeGroupFilter;
  });

  // Helper for collection exploration URL
  const getCollectionExploreUrl = (col: Collection) => {
    if (col.id === "past-exams-entrance-exit") {
      return `/explore?collection=${col.id}&filter=exam`;
    }
    if (col.id === "university-freshman-courses") {
      return `/explore?collection=${col.id}&q=Freshman`;
    }
    if (col.id === "ethiopian-fiction-reading") {
      return `/explore?collection=${col.id}&q=Ethiopian+Fiction`;
    }
    return `/explore?collection=${col.id}`;
  };

  // Helper for group icon styling
  const getGroupIconClass = (groupId: string) => {
    if (groupId === "university") return "category-icon-uni";
    if (groupId === "secondary") return "category-icon-sec";
    return "category-icon-pri";
  };

  return (
    <main>
      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <section className="page-hero container" style={{ paddingBottom: "24px" }}>
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Academic Taxonomy & Subjects Directory</span>
        </span>
        <h1>
          Explore by <span className="accent">Subject & Discipline</span>
        </h1>
        <p>
          Browse educational materials across 4 official collections and 21 standardized Ethiopian academic categories,
          spanning university faculties, secondary curricula, and primary foundations.
        </p>

        {/* Live Category Filter Search */}
        <div style={{ maxWidth: "480px", marginTop: "20px" }}>
          <div className="searchbar">
            <span className="search-icon">
              <Search size={18} />
            </span>
            <input
              placeholder="Search 21 categories (e.g. Computing, Civics, Physics)..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              aria-label="Filter academic categories"
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

      {/* ── Official Collections Strip (Modern & Compact) ───────────── */}
      <section className="container" style={{ marginBottom: "28px" }}>
        <div className="collections-header-bar">
          <div className="collections-title-lockup">
            <h2>Official Collections</h2>
            <span className="collections-count-pill">4</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Standardized Ethiopian discovery streams
          </span>
        </div>

        <div className="collections-rail">
          {filteredCollections.map((col) => {
            const tagline = COLLECTION_TAGLINES[col.id] || col.description;
            return (
              <Link
                key={col.id}
                href={getCollectionExploreUrl(col)}
                className="collection-card-compact"
                title={`${col.name}: ${col.description}`}
              >
                <div className="collection-icon-compact">
                  <TaxonomyIcon name={col.icon} size={18} />
                </div>

                <div className="collection-info-compact">
                  <div className="collection-title-row">
                    <h3 className="collection-title-compact">{col.name}</h3>
                  </div>
                  <p className="collection-tagline-compact">{tagline}</p>
                </div>

                <ArrowRight size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Education Group Switcher & Category Directory ──────────── */}
      <section className="container section" style={{ paddingTop: "0" }}>
        <div className="collections-header-bar" style={{ marginBottom: "14px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                Academic Categories
              </h2>
              <span className="collections-count-pill">21</span>
            </div>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "13px" }}>
              Standardized subject categories across university, secondary, and primary education.
            </p>
          </div>
        </div>

        {/* Education Group Segmented Control */}
        <div className="segmented-control" role="tablist" aria-label="Education Tiers">
          <button
            type="button"
            role="tab"
            aria-selected={activeGroupFilter === "all"}
            className={`segmented-btn ${activeGroupFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveGroupFilter("all")}
          >
            <span>All Categories</span>
            <span className="segmented-count">21</span>
          </button>
          {EDUCATION_GROUPS.map((grp) => {
            const count = getCategoriesByGroup(grp.id).length;
            const isActive = activeGroupFilter === grp.id;
            const shortLabel = grp.id === "university" ? "University" : grp.id === "secondary" ? "Secondary (9–12)" : "Primary (KG–8)";
            return (
              <button
                key={grp.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`segmented-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveGroupFilter(grp.id)}
              >
                <span>{shortLabel}</span>
                <span className="segmented-count">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Groups & Compact Category Cards */}
        {visibleGroups.map((grp) => {
          const groupCategories = getCategoriesByGroup(grp.id).filter(matchesQuery);
          if (groupCategories.length === 0) return null;

          return (
            <div key={grp.id} style={{ marginBottom: "28px" }}>
              <div className="group-header-compact">
                <h3>
                  <span>{grp.name}</span>
                </h3>
                <span className="muted" style={{ fontSize: "12px", fontWeight: 600 }}>
                  {groupCategories.length} Categories
                </span>
              </div>

              <div className="categories-grid-compact">
                {groupCategories.map((cat) => {
                  const disciplines = (cat.disciplines || cat.departments || []).slice(0, 3);
                  return (
                    <Link
                      key={cat.id}
                      className="category-card-compact"
                      href={`/explore?category=${encodeURIComponent(cat.id)}&q=${encodeURIComponent(cat.name)}`}
                      title={`${cat.name}: ${cat.description}`}
                    >
                      <div className={`category-icon-compact ${getGroupIconClass(grp.id)}`}>
                        <TaxonomyIcon name={cat.icon} size={18} />
                      </div>

                      <div className="category-info-compact">
                        <div className="category-title-row">
                          <h4 className="category-title-compact">{cat.name}</h4>
                        </div>

                        {disciplines.length > 0 ? (
                          <div className="category-disciplines-row">
                            {disciplines.map((d) => (
                              <span key={d} className="category-discipline-chip">
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="category-subtitle-compact">{cat.description}</p>
                        )}
                      </div>

                      <div className="category-arrow-compact">
                        <ArrowRight size={14} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty Search Filter State */}
        {visibleGroups.every((grp) => getCategoriesByGroup(grp.id).filter(matchesQuery).length === 0) && (
          <div className="empty" style={{ marginTop: "24px", padding: "32px 16px" }}>
            <h3 style={{ fontSize: "17px" }}>No categories match "{filterQuery}"</h3>
            <p style={{ fontSize: "13px" }}>Try searching with another subject term or reset your filter.</p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: "10px", fontSize: "12px", padding: "6px 14px" }}
              onClick={() => {
                setFilterQuery("");
                setActiveGroupFilter("all");
              }}
            >
              Reset Category Filters
            </button>
          </div>
        )}
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="container section" style={{ paddingTop: "12px" }}>
        <div className="cta" style={{ padding: "24px 28px" }}>
          <div>
            <h2 style={{ fontSize: "20px" }}>Looking for a specific course or past exam?</h2>
            <p style={{ fontSize: "13px" }}>Search by course code (e.g. Math1011, CSE301) or explore verified past exam papers.</p>
          </div>
          <Link className="btn btn-primary" href="/explore?filter=exam">
            <span>Explore Past Exams</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
