# STUDYHUB — PHASE 2.7 TECHNICAL REPORT
## WEBSITE SEARCH PAGINATION & EXPLORE BROWSE RELIABILITY

**Date:** November 14, 2026  
**Status:** Completed & Production Verified  
**Scope:** StudyHub Website (Next.js 15) & Search API (`web/src/app/explore/page.tsx`, `web/src/app/globals.css`, `src/api/routes.js`)  
**Database Document Count:** 92,143 (Strictly Read-Only Baseline, 0 schema mutations, 0 updates/deletes)

---

## 1. EXECUTIVE SUMMARY

Phase 2.7 addressed two major reliability issues in the StudyHub website:
1. **Initial Explore Browse Entity Omission**: The Phase 0 audit noted that historical empty-query browse logic attempted to filter albums using `groupIndex: 0`. In Telegram, album files strictly follow 1-based indexing (`groupIndex: 1, 2, ...`). Consequently, all 12,240 available multi-page photo exam albums were previously omitted from initial browsing.
2. **Explore Page Pagination Contract & Controls**: The frontend Explore page previously utilized an append-only "Load More Resources" mechanism that ignored the `page` URL query parameter, did not provide deterministic Previous/Next pagination, had no boundary safeguards or numeric page jump controls, and did not handle the backend's candidate pool transparently.

Key achievements:
- **Corrected Browse Entity Inventory**: Established a deterministic browse filter:
  `{ isAvailable: true, $or: [{ groupId: null }, { groupIndex: 1 }, { groupIndex: { $exists: false } }] }`
  This accurately yields **39,470 distinct learning entities** (27,230 standalone files + 12,240 album representatives), matching the verified Phase 1 baseline to the exact document.
- **Deterministic Pagination & Boundary Clamping**: Fixed `/api/search` to sanitize page parameters (`pageNum >= 1`), enforce deterministic sorting (`.sort({ downloadCount: -1, indexedAt: -1, _id: 1 })`), clamp out-of-bounds page requests (`page > totalPages`) to prevent false empty pages, and ensure zero duplicate IDs between consecutive pages.
- **Accessible, Responsive Frontend Pagination Controls**: Upgraded `web/src/app/explore/page.tsx` with dedicated **Previous**, **Next**, **numeric page pills** with active state, boundary disabled states, loading feedback, smooth scroll anchoring to the resources grid, and bi-directional URL synchronization (`/explore?q=...&page=...`).
- **Full Verification**: 11/11 Phase 2.7 tests passed; 73/73 tests passed across all Phase 2 suites; Next.js Turbopack build succeeded with exit code 0; database verified at 92,143 documents.

---

## 2. BUGS CONFIRMED & ROOT CAUSE ANALYSIS

### 2.1 The Album Browse Omission Bug
Database analysis of the 55,973 album documents in `telegramresources` revealed:
- `groupIndex === 0`: Exactly 0 album documents.
- `groupIndex === 1`: Exactly 12,272 album documents (12,240 available).
- `groupIndex === 2`: 11,871 documents.
- `groupIndex === 3`: 8,769 documents.

Standalone files (`groupId: null`) were stored with either `groupIndex: 0` or missing `groupIndex`. An earlier query filtering for `{ groupIndex: 0 }` or `{ groupId: null }` solely returned the 27,230 standalone files and omitted all 12,240 multi-page exam photo albums.

### 2.2 Lack of Deterministic Tie-Breaker in MongoDB Sort
In browse mode, MongoDB previously sorted by `.sort({ downloadCount: -1, indexedAt: -1 })`. In MongoDB B-tree indices, when multiple documents share the exact same `downloadCount` (e.g. 0) and `indexedAt` timestamp, skip/limit pagination without a unique tie-breaker can produce non-deterministic row ordering across page boundaries, causing items to occasionally repeat or skip.

### 2.3 Broken Client-Side Pagination State & Missing Controls
In `web/src/app/explore/page.tsx`:
- The page did not read `searchParams.get("page")` upon initial load or URL change. Bookmarked links with `?page=2` defaulted to page 1.
- Changing search filters did not reset page numbers.
- No Previous or Next navigation buttons existed—only an append-only "Load More" button that duplicated cards or became desynchronized.
- Out-of-bounds page requests could yield misleading empty states.

---

## 3. IMPLEMENTATION DETAILS

### 3.1 Backend Search API Enhancements (`src/api/routes.js`)

1. **Deterministic Browse Filter & Baseline Entity Preservation**:
   ```javascript
   const filter = {
     isAvailable: true,
     $or: [{ groupId: null }, { groupIndex: 1 }, { groupIndex: { $exists: false } }]
   };
   ```
   - Matches every standalone document (`groupId: null`).
   - Matches the first page representative (`groupIndex: 1`) of every multi-page album.
   - Accurately reports `total: 39470` learning entities.

2. **Deterministic Sort Tie-Breaker**:
   ```javascript
   const items = await TelegramResource.find(filter)
     .sort({ downloadCount: -1, indexedAt: -1, _id: 1 })
     .skip((safePage - 1) * limitNum)
     .limit(limitNum)
     .lean();
   ```
   Adding `_id: 1` as the tertiary sort key ensures 100% deterministic pagination with strictly zero duplicate items across pages.

3. **Safe Page Clamping & Contract**:
   ```javascript
   const total = results.length;
   const totalPages = Math.max(1, Math.ceil(total / limitNum));
   const safePage = Math.min(pageNum, totalPages);
   ```
   Requests for `page=0` or `page=-5` are clamped to `page=1`. Requests for out-of-range pages (e.g. `page=99999`) are clamped to `totalPages`, preventing false empty results.

4. **Album Grouping Metadata Consistency**:
   In browse mode, items are annotated with `_isGrouped: Boolean(r.groupId)` and `groupSize: r.groupTotal || (r.groupId ? 1 : undefined)`, ensuring full visual compatibility with `ResourceCard.tsx`.

### 3.2 Frontend Explore Page Pagination (`web/src/app/explore/page.tsx`)

1. **Bi-Directional URL Synchronization**:
   `useEffect` now monitors `searchParams.get("page")` alongside `q`, `type`, and `filter`. Bookmarked or shared links (e.g., `/explore?q=dbms&page=2`) load the exact requested page.
2. **Page Change Handling & Smooth Scroll Anchoring**:
   `handlePageChange(newPage)` updates the URL via `router.replace` without a full page refresh, triggers an in-place soft refresh, and smoothly scrolls to `gridSectionRef` at the top of the resource grid.
3. **Ergonomic Pagination Navigation Bar**:
   - `[◀ Previous]` button (disabled on `page === 1`).
   - Responsive page numbers with `[1, 2, 3, 4, "...", totalPages]` intelligent ellipsis calculation.
   - `[Next ▶]` button (disabled on `page === totalPages`).
   - Textual indicator: `Page X of Y`.
   - On mobile screens (<= 640px), numeric buttons collapse to prevent overflow while preserving large, touch-friendly Previous/Next buttons.
4. **Honest Search Result Messaging**:
   - When searching: `Showing page X of Y · Z ranked results for "query"`.
   - When browsing: `Showing page X of Y · 39,470 learning entities across universities`.

### 3.3 Styling & Responsiveness (`web/src/app/globals.css`)
Added dedicated classes for `.explore-pagination`, `.pagination-btn`, `.pagination-page-btn`, and `.pagination-ellipsis` with seamless light (`#0878F9`) and dark (`#12BCEB`) theme support.

---

## 4. REMAINING 200-RESULT SEARCH CANDIDATE CAP ANALYSIS

- **Search Mode (`q` present)**: MongoDB `$text` search selects the top 200 raw candidates, which are ranked by academic relevance (Phase 2.3), deduplicated of cross-channel copies (Phase 2.2), and collapsed of multi-page albums. This produces a candidate pool of ~40–120 ranked entities per query, paginated across ~4–10 pages at 12 items/page.
- **Browse Mode (`q` empty)**: Directly queries MongoDB using indexed cursor pagination (`skip` / `limit`), allowing full traversal across all **39,470 learning entities** without any 200-result cap.
- **Architectural Recommendation**: For search mode, if full multi-thousand candidate pagination is ever required, it should be addressed in a dedicated future refactor via MongoDB search aggregation pipelines (`$facet` or Atlas Search compound queries) rather than expanding the in-memory array limit.

---

## 5. VERIFICATION & TEST RESULTS

### 5.1 Phase 2.7 Test Suite (`test/explore-pagination.test.js`)
All 11 automated test scenarios executed against the live API on the isolated database:
```
=======================================================
  StudyHub Phase 2.7 — Explore Pagination & Browse     
=======================================================

Group 1: Initial Explore Browse & Entity Inventory
  ✓ Test 1: Empty query returns 200 OK with correct browse pagination
  ✓ Test 2: Standalone resources appear with groupId: null
  ✓ Test 3: Album representatives appear with groupIndex 1 and bundle metadata

Group 2: Search Pagination & Deterministic Navigation
  ✓ Test 4: Search with multiple pages returns consecutive slices
  ✓ Test 5: Navigating to last available page returns valid tail items
  ✓ Test 6: Invalid page numbers are sanitized and clamped cleanly

Group 3: Filtering & Cross-Page Uniqueness
  ✓ Test 7: Active file-type filters strictly return matching types
  ✓ Test 8: University filter restricts results to university affiliation
  ✓ Test 9: Strictly zero duplicate items across consecutive search pages
  ✓ Test 10: Zero result search returns empty array and total: 0

Group 4: Database Safety & Baseline Invariance
  ✓ Test 11: Database document count remains strictly unchanged at 92,143

-------------------------------------------------------
Results: 11 / 11 tests passed
-------------------------------------------------------
```

### 5.2 Complete Phase 2 Regression Suite
- Phase 2.1 (Query Expansion Syntax): 9/9 passed (`test/search-query-expansion.test.js`)
- Phase 2.2 (Exact Duplicate Deduplication): 8/8 passed (`test/search-duplicate-deduplication.test.js`)
- Phase 2.3 (Subject Search Relevance): 7/7 passed (`test/search-subject-relevance.test.js`)
- Phase 2.4 (Search Suggestions & Autocomplete): 15/15 passed (`test/search-suggestions.test.js`)
- Phase 2.5 (Search Results Experience): 9/9 passed (`test/search-results-experience.test.js`)
- Phase 2.6 (Telegram Pagination & Session Recovery): 14/14 passed (`test/search-pagination-session.test.js`)
- Phase 2.7 (Website Pagination & Browse Reliability): 11/11 passed (`test/explore-pagination.test.js`)
- **Total Tests Passing**: **73 / 73 tests passed (100% pass rate)**.
- **Next.js Production Build**: `npm run build --prefix web` compiled cleanly (Exit code 0).
- **Database Baseline Verification**: Verified `telegramresources` collection count remains strictly at **92,143 documents** (0 mutations).

---

## 6. SUMMARY OF MODIFIED & CREATED FILES

| File | Type | Changes Description |
|---|---|---|
| [src/api/routes.js](file:///c:/Users/billy/Desktop/StudyHub/src/api/routes.js) | Modified | Deterministic `_id: 1` sort tie-breaker, safe page clamping, and album bundle metadata in `/api/search`. |
| [web/src/app/explore/page.tsx](file:///c:/Users/billy/Desktop/StudyHub/web/src/app/explore/page.tsx) | Modified | Replaced append-only logic with Previous/Next and numeric page navigation, URL page synchronization, and smooth scroll anchoring. |
| [web/src/app/globals.css](file:///c:/Users/billy/Desktop/StudyHub/web/src/app/globals.css) | Modified | Added `.explore-pagination` styling with responsive mobile breakpoints and theme tokens. |
| [test/explore-pagination.test.js](file:///c:/Users/billy/Desktop/StudyHub/test/explore-pagination.test.js) | Created | Automated test suite covering all 11 Phase 2.7 browse, pagination, and boundary specifications. |
| [docs/STUDYHUB_PHASE_2_7_EXPLORE_PAGINATION_REPORT.md](file:///c:/Users/billy/Desktop/StudyHub/docs/STUDYHUB_PHASE_2_7_EXPLORE_PAGINATION_REPORT.md) | Created | Full technical report and verification document. |
