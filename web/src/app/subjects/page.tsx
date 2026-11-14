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

export default function SubjectsPage() {
  const [filterQuery, setFilterQuery] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("all");

  const normalizedQuery = filterQuery.toLowerCase().trim();

  // Filter categories matching search
  const matchesQuery = (cat: SubjectCategory) => {
    if (!normalizedQuery) return true;
    return (
      cat.name.toLowerCase().includes(normalizedQuery) ||
      (cat.amharicName && cat.amharicName.includes(normalizedQuery)) ||
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
      (col.amharicName && col.amharicName.includes(normalizedQuery)) ||
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

  return (
    <main>
      {/* ── Page Hero ─────────────────────────────────────────────── */}
      <section className="page-hero container">
        <span className="eyebrow">
          <BrandEmblem size={16} />
          <span>Academic Taxonomy & Subjects Directory</span>
        </span>
        <h1>
          Explore by <span className="accent">Subject & Discipline</span>
        </h1>
        <p>
          Browse educational materials organized by the official Ethiopian Academic Taxonomy—spanning
          4 primary collections and 21 standardized subject categories across primary, secondary, and higher education.
        </p>

        {/* Live Category Filter Search */}
        <div style={{ maxWidth: "520px", marginTop: "24px" }}>
          <div className="searchbar">
            <span className="search-icon">
              <Search size={18} />
            </span>
            <input
              placeholder="Search 21 categories (e.g. Computing, Natural Sciences, Civics)..."
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

      {/* ── Official Collections Section ──────────────────────────── */}
      <section className="container section" style={{ paddingTop: "12px", paddingBottom: "24px" }}>
        <div className="section-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2>Official Academic Collections</h2>
              <span className="amharic-badge" style={{ fontWeight: 700, color: "var(--primary)" }}>
                4 Collections
              </span>
            </div>
            <p>
              Four standardized discovery streams defined in the centralized taxonomy configuration.
            </p>
          </div>
        </div>

        <div className="collections-grid">
          {filteredCollections.map((col) => (
            <Link
              key={col.id}
              href={getCollectionExploreUrl(col)}
              className="collection-card"
            >
              <div className="collection-header">
                <div className="collection-icon">
                  <TaxonomyIcon name={col.icon} size={22} />
                </div>
                {col.amharicName && (
                  <span className="amharic-badge">{col.amharicName}</span>
                )}
              </div>

              <h3>{col.name}</h3>
              <p>{col.description}</p>

              <div className="collection-footer">
                <span>Explore Resources</span>
                <ArrowRight size={16} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Education Group Switcher & Category Directory ──────────── */}
      <section className="container section" style={{ paddingTop: "12px" }}>
        <div className="section-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2>Academic Categories by Education Tier</h2>
              <span className="amharic-badge" style={{ fontWeight: 700, color: "var(--primary)" }}>
                21 Categories
              </span>
            </div>
            <p>
              Standardized subject categories across university faculties, secondary curricula, and primary foundations.
            </p>
          </div>
        </div>

        {/* Education Group Filter Pills */}
        <div className="group-tabs" role="tablist" aria-label="Education Tiers">
          <button
            type="button"
            role="tab"
            aria-selected={activeGroupFilter === "all"}
            className={`group-tab-btn ${activeGroupFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveGroupFilter("all")}
          >
            All Categories (21)
          </button>
          {EDUCATION_GROUPS.map((grp) => {
            const count = getCategoriesByGroup(grp.id).length;
            const isActive = activeGroupFilter === grp.id;
            return (
              <button
                key={grp.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`group-tab-btn ${isActive ? "active" : ""}`}
                onClick={() => setActiveGroupFilter(grp.id)}
              >
                <span>{grp.name}</span>
                <span style={{ opacity: 0.8 }}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Groups & Categories */}
        {visibleGroups.map((grp) => {
          const groupCategories = getCategoriesByGroup(grp.id).filter(matchesQuery);
          if (groupCategories.length === 0) return null;

          return (
            <div key={grp.id} style={{ marginBottom: "36px" }}>
              <div className="taxonomy-group-header">
                <div>
                  <div className="taxonomy-group-title">
                    <h2>{grp.name}</h2>
                    {grp.amharicName && (
                      <span className="amharic-badge" style={{ fontSize: "12px" }}>
                        {grp.amharicName}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px", maxWidth: "680px" }}>
                    {grp.description}
                  </p>
                </div>
                <span className="muted" style={{ fontSize: "13px", fontWeight: 600 }}>
                  {groupCategories.length} Categories
                </span>
              </div>

              <div className="subject-grid">
                {groupCategories.map((cat) => {
                  const disciplineHighlights = (cat.disciplines || cat.departments || []).slice(0, 3);
                  return (
                    <Link
                      key={cat.id}
                      className="subject-card"
                      href={`/explore?category=${encodeURIComponent(cat.id)}&q=${encodeURIComponent(cat.name)}`}
                    >
                      <div className="subject-icon">
                        <TaxonomyIcon name={cat.icon} size={24} />
                      </div>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                              fontWeight: 700,
                              color: "var(--primary)",
                            }}
                          >
                            {grp.name.split(" ")[0]}
                          </span>
                          {cat.amharicName && (
                            <span className="amharic-badge" style={{ fontSize: "10px", padding: "1px 5px" }}>
                              {cat.amharicName}
                            </span>
                          )}
                        </div>

                        <h3>{cat.name}</h3>
                        <small style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {cat.description}
                        </small>

                        {disciplineHighlights.length > 0 && (
                          <div className="discipline-tags">
                            {disciplineHighlights.map((disc) => (
                              <span key={disc} className="discipline-tag">
                                {disc}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="arrow">
                        <ArrowRight size={18} />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Empty Search Filter State */}
        {visibleGroups.every((grp) => getCategoriesByGroup(grp.id).filter(matchesQuery).length === 0) && (
          <div className="empty" style={{ marginTop: "32px" }}>
            <h3>No categories match "{filterQuery}"</h3>
            <p>Try searching with another keyword or explore all 21 standardized academic categories.</p>
            <button
              type="button"
              className="btn btn-outline"
              style={{ marginTop: "12px" }}
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
      <section className="container section">
        <div className="cta">
          <div>
            <h2>Looking for a specific course or exit examination?</h2>
            <p>Search using canonical course codes (e.g. Math1011, CSE301) or explore verified past exam papers.</p>
          </div>
          <Link className="btn" href="/explore?filter=exam">
            <span>Explore Past Exams</span>
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </main>
  );
}
