# STUDYHUB — PHASE 3.2.1 TECHNICAL REPORT
## TAXONOMY-DRIVEN SEARCH SUGGESTIONS

**Date:** November 14, 2026  
**Status:** Completed & Production Verified  
**Scope:** Backend Search Suggestion Engine Integration with Centralized Ethiopian Academic Taxonomy  
**Database Document Count:** 92,143 (Strictly Read-Only Baseline, 0 schema mutations, 0 records modified)  
**Test Suite Results:** 38/38 Phase 3.2.1 Tests Passed · 15/15 Phase 2.4 Tests Passed · 12/12 Phase 3.1 Tests Passed · Next.js Turbopack Build: Clean (0 errors, 11 routes)  
**Performance:** 0.174ms per suggestion query (1,000 queries in 173.98ms, sub-millisecond in-memory execution)

---

## 1. EXECUTIVE SUMMARY

Phase 3.2.1 seamlessly replaced legacy hardcoded subject arrays and disconnected query suggestions in `src/search/suggestion.service.js` with direct consumption of the centralized Ethiopian Academic Taxonomy (`src/config/taxonomy.json` / `src/config/taxonomy.js`). 

Previously, the search suggestion engine maintained its own redundant lists of subject names, which risked diverging from the approved taxonomy established in Phase 3.1 and refined in Phase 3.1.1. Under Phase 3.2.1:
- The suggestion engine indexes the official 4 collections, 21 primary subject categories (using approved canonical display names), 2 freshman streams, and 18 university freshman common courses.
- Configured academic aliases act as **query recognition triggers** that suggest canonical academic entities rather than flooding students' autocomplete dropdowns with dozens of raw lower-case synonyms and typo variants.
- The distinction between Natural Science and Social Science streams (e.g., *Mathematics for Natural Sciences* vs *Mathematics for Social Sciences*) is strictly enforced with zero cross-contamination.
- High-value legacy acronyms (`DBMS`, `DSA`, `CN`, `OS`, `SE`, `COA`, `AI`) and curated exam queries (`DBMS Exam`, `DSA Final Exam`) are preserved.
- The existing Express API contract (`GET /api/search/suggestions`) and Telegram bot inline query responses are 100% preserved.
- MongoDB remains strictly read-only with document count invariant at 92,143.

---

## 2. CENTRALIZED TAXONOMY INTEGRATION DETAILS

The suggestion engine (`src/search/suggestion.service.js`) was updated to import canonical taxonomy entities directly from `src/config/taxonomy.js`:

```javascript
const {
  COLLECTIONS,
  SUBJECT_CATEGORIES,
  FRESHMAN_STREAMS,
  FRESHMAN_COURSES,
  ALIASES: TAXONOMY_ALIASES
} = require("../config/taxonomy");
const { SUBJECT_ALIASES } = require("../config/subjectAliases");
```

### Architectural Pipeline
1. **Zero Database Keystroke Overhead**: Keystroke autocomplete does not query MongoDB. Instead, an in-memory index is pre-compiled at service startup and persists in memory.
2. **Unified `normalizeText` with Ampersand Harmonization**:
   ```javascript
   function normalizeText(text = "") {
     return String(text)
       .toLowerCase()
       .normalize("NFD")
       .replace(/[\u0300-\u036f]/g, "")
       .replace(/&/g, " and ")
       .replace(/[^a-z0-9\s]/g, " ")
       .replace(/\s+/g, " ")
       .trim();
   }
   ```
   By mapping `&` to ` and `, queries like `"computing & information sciences"`, `"computing and information sciences"`, `"business & economics"`, and `"business and economics"` produce identical normalized representations, ensuring seamless matching.
3. **Index Composition**:
   - Total indexed entities: 141 canonical items.
   - Index compilation time: < 3ms on application boot.

---

## 3. ACADEMIC HIERARCHY SUGGESTIONS

The suggestion engine indexes entities in accordance with the official StudyHub academic hierarchy:

### A. Collections (Base Score: 100)
All 4 official StudyHub collections are indexed with their metadata keywords and aliases:
1. `Study Materials` (`study-materials`)
2. `Ethiopian Fiction & Reading` (`ethiopian-fiction-reading`)
3. `Past Exams, Entrance & Exit` (`past-exams-entrance-exit`)
4. `University Freshman Courses` (`university-freshman-courses`)

### B. Primary Categories (Base Score: 100)
All 21 approved category canonical display names across KG–8, Secondary, and University tiers are indexed. Associated disciplines, departments, and taxonomy aliases are linked as query triggers:
- **KG–Grade 8 (7 Categories):** `Languages & Literacy`, `Mathematics`, `General & Environmental Science`, `Social Studies & Geography`, `History, Civics & Moral Education`, `ICT & Basic Technology`, `Arts, Music, Health & Physical Education`.
- **Grades 9–12 (7 Categories):** `English & Ethiopian Languages`, `Mathematics`, `Physics`, `Chemistry`, `Biology & Life Sciences`, `Social Sciences`, `Applied Science & Technology`.
- **University (7 Categories):** `Computing & Information Sciences`, `Engineering & Built Environment`, `Natural & Computational Sciences`, `Health & Medical Sciences`, `Agriculture, Veterinary & Natural Resources`, `Business & Economics`, `Social Sciences, Humanities, Law & Education`.

### C. Freshman Streams & Common Courses (Base Score: 95)
- **Streams (2):** `Natural Science Stream` (`natural-science`), `Social Science Stream` (`social-science`).
- **Freshman Courses (18):**
  - `Mathematics for Natural Sciences` (`freshman-math-natural`)
  - `Mathematics for Social Sciences` (`freshman-math-social`)
  - `General Physics` (`freshman-physics`)
  - `General Chemistry` (`freshman-chemistry`)
  - `General Biology` (`freshman-biology`)
  - `Communicative English Language Skills` (`freshman-english`)
  - `Geography of Ethiopia and the Horn` (`freshman-geography`)
  - `History of Ethiopia and the Horn` (`freshman-history`)
  - `Social Anthropology` (`freshman-anthropology`)
  - `Introduction to Emerging Technologies` (`freshman-emerging-tech`)
  - `Moral and Civic Education` (`freshman-civics`)
  - `Logic and Critical Thinking` (`freshman-logic`)
  - `General Psychology` (`freshman-psychology`)
  - `Economics` (`freshman-economics`)
  - `Entrepreneurship` (`freshman-entrepreneurship`)
  - `Inclusiveness` (`freshman-inclusiveness`)
  - `Global Trends` (`freshman-global-trends`)
  - `Physical Fitness` (`freshman-fitness`)

---

## 4. QUERY TRIGGER & CANONICAL RESOLUTION LOGIC

### Elimination of Raw Alias Flooding
In legacy Phase 2.4, every raw alias from `SUBJECT_ALIASES` was added to the index as its own standalone suggestion. When a student typed `"math nat"`, the autocomplete returned `"Math for Natural Science"`, `"Math for Natural Sciences"`, `"Mathematics for Natural Science"`, and `"General Mathematics Natural Science"`—pushing the canonical course name down and presenting redundant, fragmented choices.

Under Phase 3.2.1, aliases and course codes are stored as **search triggers** (`keywords`) inside the canonical item:
- Alias `"flen 1011"` or `"enla 1011"` -> triggers `Communicative English Language Skills`
- Alias `"geog 1011"` -> triggers `Geography of Ethiopia and the Horn`
- Alias `"hist 1011"` -> triggers `History of Ethiopia and the Horn`
- Alias `"mcve"` or `"civics"` -> triggers `Moral and Civic Education`
- Alias `"emtech"` -> triggers `Introduction to Emerging Technologies`
- Alias `"snie"` -> triggers `Inclusiveness`
- Alias `"urban planning"` or `"architecture"` -> triggers `Engineering & Built Environment`

### Deduplication and Scoring Hierarchy
The match scoring function `calculateMatchScore(queryNorm, queryWords, item)` evaluates relevance across 7 tiered stages:

| Rule | Match Type | Condition / Example | Score Boost |
| :---: | :--- | :--- | :---: |
| **1** | **Exact Match** | `itemNorm === queryNorm` (e.g., `"dbms"` -> `DBMS`) | **+1000** |
| **2** | **Direct Prefix Match** | `itemNorm.startsWith(queryNorm)` (e.g., `"comp"` -> `Compiler Design`) | **+800 − dist** |
| **3** | **Acronym Match** | `acronym === queryNorm` (e.g., `"dsa"` -> `Data Structures...`) | **+700** |
| **4** | **Multi-Token Match** | All query words start words in item in order (e.g., `"math nat"`) | **+650 + 50** |
| **5** | **Word-Start Match** | Any word in item starts with query (e.g., `"learning"` in `Machine Learning`) | **+500 − (idx × 20)** |
| **6** | **Keyword & Trigger Match** | Matches alias/course code (`kw === queryNorm` or `kw.startsWith(queryNorm)`) | **+750 / +600** |
| **7** | **Substring Match** | Query occurs inside item title | **+300** |

### Natural Science vs Social Science Stream Separation
Multi-token matching and keyword indexing ensure distinct mathematical courses never leak into the wrong stream:
- **`"math nat"`**:
  - `Mathematics for Natural Sciences` matches on multi-token `"math"` and `"nat"` (Score: $95 + 650 + 50 = 795$).
  - `Mathematics for Social Sciences` scores **0** (query word `"nat"` does not match any word in `"mathematics for social sciences"`).
- **`"math soc"`**:
  - `Mathematics for Social Sciences` matches on multi-token `"math"` and `"soc"` (Score: $95 + 650 + 50 = 795$).
  - `Mathematics for Natural Sciences` scores **0** (query word `"soc"` does not match any word in `"mathematics for natural sciences"`).
- **Course Codes**:
  - `"math 1011"` strictly suggests `Mathematics for Natural Sciences`.
  - `"math 1012"` strictly suggests `Mathematics for Social Sciences`.

---

## 5. TEST VERIFICATION & PERFORMANCE RESULTS

### Dedicated Phase 3.2.1 Test Suite (`test/taxonomy-search-suggestions.test.js`)
All 38 assertions across 8 functional groups passed:

```
=======================================================
  StudyHub Phase 3.2.1 — Taxonomy Suggestions Test     
=======================================================

Group 1: Approved Category Display Names Recognition
  ✓ All 4 official collection names exist and can be suggested
  ✓ All 21 approved category canonical display names are recognized

Group 2: Category Aliases Resolve to Correct Canonical Categories
  ✓ Computing aliases resolve to 'Computing & Information Sciences'
  ✓ Natural sciences aliases resolve to 'Natural & Computational Sciences'
  ✓ Health aliases resolve to 'Health & Medical Sciences'
  ✓ Business aliases resolve to 'Business & Economics'
  ✓ Architecture aliases resolve to 'Engineering & Built Environment'

Group 3: Freshman Course Names and Aliases Resolution
  ✓ All 18 freshman courses can be queried by name
  ✓ Course code alias 'flen 1011' resolves to 'Communicative English Language Skills'
  ✓ Geography alias 'geog 1011' resolves to 'Geography of Ethiopia and the Horn'
  ✓ History alias 'hist 1011' resolves to 'History of Ethiopia and the Horn'
  ✓ Logic alias 'critical thinking' resolves to 'Logic and Critical Thinking'
  ✓ Civics alias 'mcve' or 'civics' resolves to 'Moral and Civic Education'
  ✓ Emerging tech alias 'emtech' resolves to 'Introduction to Emerging Technologies'
  ✓ Inclusiveness alias 'snie' resolves to 'Inclusiveness'

Group 4: Natural Science vs Social Science Mathematics Distinction
  ✓ 'math nat' prioritizes Mathematics for Natural Sciences without matching Social Sciences
  ✓ 'math soc' prioritizes Mathematics for Social Sciences without matching Natural Sciences
  ✓ Course code 'math 1011' resolves to Natural Sciences math
  ✓ Course code 'math 1012' resolves to Social Sciences math

Group 5: Legacy Aliases Continue Working
  ✓ Legacy alias 'dbms' yields 'DBMS' as #1 and contains 'Database Management Systems'
  ✓ Legacy alias 'dsa' yields 'DSA' as #1 and contains 'Data Structures and Algorithms'
  ✓ Legacy alias 'cn' yields 'CN' as #1 and contains 'Computer Networks'
  ✓ Legacy alias 'os' yields 'OS' as #1 and contains 'Operating Systems'
  ✓ Legacy alias 'se' yields 'SE' as #1 and contains 'Software Engineering'
  ✓ Legacy alias 'coa' yields 'COA' as #1 and contains 'Computer Organization'
  ✓ Legacy alias 'ai' yields 'AI' as #1 and contains 'Artificial Intelligence'

Group 6: Existing Curated Suggestions Remain Available
  ✓ Curated query 'dbms exam' surfaces 'DBMS Exam'
  ✓ Curated query 'dsa final' surfaces 'DSA Final Exam'
  ✓ Curated query 'calculus i' surfaces 'Calculus I Past Exam'
  ✓ Curated query 'physics mid' surfaces 'General Physics Mid Exam'

Group 7: Website and Telegram Integration Shapes
  ✓ Suggestions items strictly adhere to { text, type, subjectKey } contract
  ✓ Simulated Express API endpoint returns standard { success: true, data: [...] }
  ✓ Simulated Telegram Inline query returns array with limit capping

Group 8: Empty and Short Query Fallback Behavior
  ✓ Empty query returns recent searches followed by canonical popular items
  ✓ Empty query without recent searches returns canonical popular defaults
  ✓ 1-letter queries execute gracefully without errors
  ✓ Limit capping clamps to maximum of 20 items
  ✓ Output contains zero duplicate normalized titles across all test queries

=======================================================
  Tests Completed: 38/38 Passed  
=======================================================
```

### Performance Benchmark
- **Throughput Benchmark**: 1,000 randomized queries executed in **173.98ms**.
- **Average Latency**: **0.1740ms per call** (< 0.2ms).
- **Memory Footprint**: < 200 KB for entire compiled suggestion index.

---

## 6. COMPATIBILITY VERIFICATION (WEBSITE + TELEGRAM)

### Website Autocomplete Compatibility
The website search autocomplete component (`web/src/components/SearchAutocomplete.tsx`) communicates with `GET /api/search/suggestions?q=...&limit=...`. The returned JSON structure:

```json
{
  "success": true,
  "data": [
    {
      "text": "Computing & Information Sciences",
      "type": "subject",
      "subjectKey": "university-computing"
    },
    {
      "text": "Computer Science",
      "type": "popular",
      "subjectKey": "cs"
    }
  ]
}
```

The response contract `{ success: true, data: Array<{ text: string, type: "subject" | "course" | "popular" | "recent", subjectKey?: string }> }` was strictly preserved.

### Telegram Bot Inline Mode Compatibility
The Telegram bot inline search handler (`src/bot/inline/inlineQuery.js`) invokes `getSuggestions(query, { limit: 3 })`. The resulting array provides direct completion options with zero schema or type breaking changes.

### Full Regression Suite Run

| Test Suite | File | Status | Notes |
| :--- | :--- | :---: | :--- |
| **Taxonomy Suggestions** | `test/taxonomy-search-suggestions.test.js` | **38/38 Passed** | Phase 3.2.1 validation suite |
| **Search Suggestions** | `test/search-suggestions.test.js` | **15/15 Passed** | Phase 2.4 regression suite |
| **Academic Taxonomy** | `test/academic-taxonomy.test.js` | **12/12 Passed** | Phase 3.1 & 3.1.1 validation suite |
| **Query Expansion** | `test/search-query-expansion.test.js` | **9/9 Passed** | Phase 2.1 regression suite |
| **Duplicate Deduplication** | `test/search-duplicate-deduplication.test.js` | **8/8 Passed** | Phase 2.2 regression suite |
| **Subject Relevance** | `test/search-subject-relevance.test.js` | **7/7 Passed** | Phase 2.3 regression suite |
| **Results Experience** | `test/search-results-experience.test.js` | **9/9 Passed** | Phase 2.5 regression suite |
| **Pagination & Session** | `test/search-pagination-session.test.js` | **14/14 Passed** | Phase 2.6 regression suite |
| **Delivery Failure** | `test/telegram-delivery-failure.test.js` | **11/11 Passed** | Phase 2.8 regression suite |
| **Next.js Turbopack Build** | `npm run build --prefix web` | **Clean (0 errors)** | 11 static/dynamic routes compiled |

---

## 7. PRODUCTION READINESS CHECKLIST

- [x] **Zero Database Mutations**: MongoDB document count strictly invariant at 92,143.
- [x] **Single Source of Truth**: Search suggestions dynamically derive from `src/config/taxonomy.js`.
- [x] **21 Canonical Categories**: All 21 approved category names recognized and suggestible.
- [x] **18 Freshman Courses**: All 18 freshman courses recognized and suggestible.
- [x] **Stream Separation**: Natural Science vs Social Science mathematics verified strictly distinct.
- [x] **Legacy Acronyms Preserved**: `DBMS`, `DSA`, `CN`, `OS`, `SE`, `COA`, `AI` return exact acronym as #1.
- [x] **No Synonym Flooding**: Aliases act as query triggers pointing to canonical academic titles.
- [x] **Sub-Millisecond Speed**: 0.174ms average execution time per suggestion keystroke.
- [x] **API & Bot Compatibility**: Fully compatible with website autocomplete and Telegram inline mode.
- [x] **Clean Frontend Build**: Next.js 16.4.5 Turbopack builds with zero TypeScript or compilation errors.
