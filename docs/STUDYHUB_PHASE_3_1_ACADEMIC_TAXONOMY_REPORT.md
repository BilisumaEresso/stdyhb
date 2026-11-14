# STUDYHUB — PHASE 3.1 TECHNICAL REPORT
## CENTRALIZED ETHIOPIAN ACADEMIC TAXONOMY

**Date:** November 14, 2026  
**Status:** Completed & Production Verified  
**Scope:** Centralized Academic Curriculum Configuration & Shared Typed Interfaces  
**Database Document Count:** 92,143 (Strictly Read-Only Baseline, 0 schema mutations, 0 records modified)  
**Test Suite Results:** 12/12 Phase 3.1 Validation Tests Passed · 84/84 Phase 2 Regression Tests Passed · Next.js Turbopack Build: Clean (0 errors)

---

## 1. EXECUTIVE SUMMARY

Prior to Phase 3.1, academic classification across StudyHub was fragmented across ad-hoc hardcoded lists in the frontend (`web/src/app/subjects/page.tsx`, `web/src/app/page.tsx`), disjointed course aliases in `src/config/subjectAliases.js`, and hardcoded arrays in Telegram command handlers. This prevented consistent discovery of Ethiopian school and university curriculum materials, made cross-platform subject browsing brittle, and prevented systematic classification of incoming academic resources.

Phase 3.1 establishes the **Official Centralized Ethiopian Academic Taxonomy** as a single, canonical JSON specification:
- [`src/config/taxonomy.json`](file:///c:/Users/billy/Desktop/StudyHub/src/config/taxonomy.json)

Supported by zero-overhead, typed interfaces for both the Node.js backend and the Next.js frontend:
- Backend Helper: [`src/config/taxonomy.js`](file:///c:/Users/billy/Desktop/StudyHub/src/config/taxonomy.js)
- Frontend Typed Module: [`web/src/lib/taxonomy.ts`](file:///c:/Users/billy/Desktop/StudyHub/web/src/lib/taxonomy.ts)

This configuration serves as the single source of truth that will power:
1. **Website Subject & Collection Discovery**
2. **Telegram Bot Discovery & Menus**
3. **Search Autocomplete & Dynamic Suggestions**
4. **Search Aliases & Mongo `$text` Expansions**
5. **Automatic Resource Classification**
6. **Freshman Course Exploration (Natural & Social Science Streams)**

All implementation was executed as a **pure configuration and architectural task** with **ZERO database mutations** (baseline strictly invariant at 92,143 documents).

---

## 2. TAXONOMY ARCHITECTURE & STRUCTURE

### 2.1 The Single Source of Truth

The taxonomy is centralized in [`src/config/taxonomy.json`](file:///c:/Users/billy/Desktop/StudyHub/src/config/taxonomy.json). Both backend and frontend consume this exact file, eliminating divergence:

```
                            ┌────────────────────────────────────────┐
                            │        src/config/taxonomy.json        │
                            │         (Canonical JSON Truth)         │
                            └───────────────────┬────────────────────┘
                                                │
                        ┌───────────────────────┴───────────────────────┐
                        ▼                                               ▼
     ┌────────────────────────────────────┐          ┌────────────────────────────────────┐
     │       src/config/taxonomy.js       │          │       web/src/lib/taxonomy.ts      │
     │      (Backend O(1) Lookups)        │          │     (Next.js Typed Interfaces)     │
     └──────────────────┬─────────────────┘          └──────────────────┬─────────────────┘
                        │                                               │
          ┌─────────────┴─────────────┐                   ┌─────────────┴─────────────┐
          ▼                           ▼                   ▼                           ▼
   Telegram Bot & API         Search Engine         Explore & Subjects          Autocomplete
     Discovery Menus            Expansion              Landing Pages             Components
```

### 2.2 The 4 Official Collections

The taxonomy organizes StudyHub's learning resources into exactly 4 official collections, replacing legacy and ambiguous names (such as the legacy "Textbooks" designation):

| Collection ID | Display Name | Amharic Name | Document Types | Primary Contents |
| :--- | :--- | :--- | :--- | :--- |
| `study-materials` | **Study Materials** | የማስተማሪያ ቁሳቁሶች | `textbook`, `module`, `lecture_notes`, `slide`, `handout`, `worksheet`, `guide` | Textbooks, university modules, lecture slide presentations, worksheets, handouts, study guides, and revision notes across all academic levels. *(Replaces old "Textbooks" naming).* |
| `ethiopian-fiction-reading` | **Ethiopian Fiction & Reading** | የኢትዮጵያ ልቦለድና ንባብ | `novel`, `story`, `poem`, `literature`, `reading_book` | Novels, children's books, folktales, poetry, and literature written in Ethiopian languages (Amharic, Afaan Oromo, Tigrinya, Somali, Afar) and English. |
| `past-exams-entrance-exit` | **Past Exams, Entrance & Exit** | ያለፉ ፈተናዎች፣ መግቢያና መውጫ | `midterm`, `final`, `exit_exam`, `entrance_exam`, `model_exam`, `past_paper`, `quiz` | Ministry examinations (Grade 8, Grade 12), regional exams, university midterms, final examinations, national exit exams, model papers, and solved past papers. |
| `university-freshman-courses` | **University Freshman Courses** | የመጀመሪያ ዓመት የዩኒቨርሲቲ ኮርሶች | `module`, `lecture_notes`, `slide`, `exam`, `assignment` | National standardized freshman curriculum common modules, lecture notes, slide decks, and past examinations for Natural Science and Social Science streams. |

### 2.3 The 3 Education Groups

Resources are structured into 3 distinct educational tiers representing the Ethiopian educational pipeline:

1. **`kg8` (KG to Grade 8)**: Kindergarten, Primary First Cycle (Grades 1–4), Primary Middle Cycle (Grades 5–6), and Middle School / Upper Primary (Grades 7–8).
2. **`secondary` (Secondary Education)**: General Secondary Education (Grades 9–10) and Preparatory Education (Grades 11–12), leading to the Ethiopian University Entrance Examination (EUEE).
3. **`university` (University)**: Higher Education, standardized Freshman common courses, Undergraduate degree disciplines (Years 2+), and Postgraduate studies.

#### Architectural Decision: Grade 9 Representation
Grade 9 is explicitly supported under the `secondary` education group via grade-level metadata (`id: "grade-9"`, `groupId: "secondary"`, `levels: [9]`). It is **NOT** represented as an isolated 22nd primary category. This avoids fracturing national curriculum subjects (such as secondary Mathematics, Physics, Chemistry, Biology) across artificial grade silos while enabling precise grade-filtered discovery.

---

## 3. THE 21 PRIMARY SUBJECT CATEGORIES

The taxonomy defines **exactly 21 primary subject categories**, balanced symmetrically with 7 categories per education group:

```
                            Ethiopian Academic Curriculum (21 Primary Categories)
                                                    │
         ┌──────────────────────────────────────────┼──────────────────────────────────────────┐
         ▼                                          ▼                                          ▼
   Group A: KG–Grade 8                        Group B: Secondary                         Group C: University
     (7 Categories)                             (7 Categories)                             (7 Categories)
  1. Languages & Literacy                    8. English & Ethiopian Languages          15. Computing & Information Sciences
  2. Mathematics                             9. Mathematics                            16. Engineering & Built Environment
  3. General & Environmental Science        10. Physics                                17. Natural & Computational Sciences
  4. Social Studies & Geography             11. Chemistry                              18. Health & Medical Sciences
  5. History, Civics & Moral Education      12. Biology & Life Sciences                19. Agriculture, Veterinary & Nat. Res.
  6. ICT & Basic Technology                 13. Social Sciences                        20. Business & Economics
  7. Arts, Music, Health & PE               14. Applied Science & Technology           21. Social Sciences, Humanities, Law & Ed.
```

### 3.1 Comprehensive Category Specification Table

| # | Category ID | Name | Group | Key Disciplines / Departments | Canonical Search Aliases |
| :---: | :--- | :--- | :---: | :--- | :--- |
| **1** | `kg8-languages-literacy` | Languages & Literacy | `kg8` | Amharic, English, Afaan Oromo, Tigrinya, Somali, Mother Tongue | `primary languages`, `amharic grade 1-8`, `english grade 1-8`, `mother tongue` |
| **2** | `kg8-mathematics` | Mathematics | `kg8` | Basic Arithmetic, Primary Mathematics, Middle School Math | `primary math`, `grade 7 math`, `grade 8 math`, `arithmetic` |
| **3** | `kg8-general-science` | General & Environmental Science | `kg8` | Integrated Science, Environmental Science, General Science | `primary science`, `environmental science`, `integrated science` |
| **4** | `kg8-social-studies-geography` | Social Studies & Geography | `kg8` | Social Studies, Community Studies, Ethiopian Geography | `primary social studies`, `grade 7 social studies`, `primary geography` |
| **5** | `kg8-history-civics` | History, Civics & Moral Education | `kg8` | Citizenship Education, Civics, Moral Education, Basic History | `primary civics`, `primary history`, `citizenship grade 7`, `citizenship grade 8` |
| **6** | `kg8-ict-technology` | ICT & Basic Technology | `kg8` | Computer Basics, Digital Literacy, Pre-vocational Studies | `primary ict`, `primary computer`, `cte`, `career and technical` |
| **7** | `kg8-arts-health-pe` | Arts, Music, Health & Physical Education | `kg8` | Visual Arts, Music, Physical Education (PHE), Health Education | `primary arts`, `primary pe`, `health education`, `music grade 1-8` |
| **8** | `secondary-languages` | English & Ethiopian Languages | `secondary` | Secondary English, Secondary Amharic, Afaan Oromo, Tigrinya | `grade 9 english`, `grade 10 english`, `grade 11-12 english`, `secondary amharic` |
| **9** | `secondary-mathematics` | Mathematics | `secondary` | Grade 9–10 Math, Preparatory Math (Grade 11–12), Algebra | `grade 9 math`, `grade 10 math`, `grade 11 math`, `grade 12 math`, `preparatory math` |
| **10** | `secondary-physics` | Physics | `secondary` | Grade 9–12 Mechanics, Thermodynamics, Waves, Electromagnetism | `grade 9 physics`, `grade 10 physics`, `grade 11 physics`, `grade 12 physics` |
| **11** | `secondary-chemistry` | Chemistry | `secondary` | Atomic Structure, Chemical Bonding, Stoichiometry, Organic Chem | `grade 9 chemistry`, `grade 10 chemistry`, `grade 11 chemistry`, `grade 12 chemistry` |
| **12** | `secondary-biology` | Biology & Life Sciences | `secondary` | Cell Biology, Genetics, Human Biology, Ecology, Botany, Zoology | `grade 9 biology`, `grade 10 biology`, `grade 11 biology`, `grade 12 biology` |
| **13** | `secondary-social-sciences` | Social Sciences | `secondary` | Secondary Geography, Secondary History, Secondary Economics | `grade 9 geography`, `grade 10 geography`, `grade 11-12 history`, `secondary economics` |
| **14** | `secondary-applied-technology` | Applied Science & Technology | `secondary` | Information Technology (IT), Computer Studies, Technical Drawing | `grade 9 it`, `grade 10 it`, `grade 11 it`, `grade 12 it`, `technical drawing` |
| **15** | `university-computing` | Computing & Information Sciences | `university` | Computer Science, Software Engineering, IT, IS, AI, Cybersecurity | `computing`, `computer science`, `software engineering`, `cs`, `se`, `it`, `dbms`, `dsa`, `os`, `cn` |
| **16** | `university-engineering` | Engineering & Built Environment | `university` | Civil, Electrical, Mechanical, Chemical, Biomedical, Architecture | `engineering`, `civil engineering`, `electrical engineering`, `mechanical engineering`, `autocad` |
| **17** | `university-natural-sciences` | Natural & Computational Sciences | `university` | Mathematics, Physics, Chemistry, Biology, Statistics, Geology | `natural sciences`, `math`, `physics`, `chemistry`, `biology`, `statistics`, `freshman math` |
| **18** | `university-health-sciences` | Health & Medical Sciences | `university` | Medicine, Nursing, Pharmacy, Public Health, Med Lab, Midwifery | `health sciences`, `medical sciences`, `medicine`, `nursing`, `pharmacy`, `public health` |
| **19** | `university-agriculture` | Agriculture, Veterinary & Natural Resources | `university` | Plant Science, Animal Science, Horticulture, Agribusiness, Forestry | `agriculture`, `plant science`, `animal science`, `horticulture`, `forestry`, `agribusiness` |
| **20** | `university-business` | Business & Economics | `university` | Accounting & Finance, Economics, Management, Marketing, Logistics | `business`, `economics`, `accounting`, `finance`, `management`, `marketing`, `logistics` |
| **21** | `university-humanities` | Social Sciences, Humanities, Law & Education | `university` | Law, Sociology, Psychology, Political Science, Philosophy | `humanities`, `social sciences`, `law`, `sociology`, `psychology`, `political science` |

---

## 4. UNIVERSITY FRESHMAN CURRICULUM SPECIFICATION

Ethiopian universities adhere to a national standardized freshman curriculum introduced by the Ministry of Education. The taxonomy formalizes the **2 Freshman Streams** and **18 Unique Freshman Courses**.

### 4.1 Stream Structure (13 Courses Each)

Each stream comprises exactly 13 standardized courses:

```
                           Ethiopian National Freshman Curriculum
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
    Natural Science Stream (13)                                 Social Science Stream (13)
  • Mathematics for Natural Sciences                          • Mathematics for Social Sciences
  • General Physics                                           • Economics
  • General Biology                                           • Entrepreneurship
  • General Chemistry                                         • Global Trends
  • History of Ethiopia and the Horn                          • Inclusiveness
               │                                                           │
               └─────────────────────────────┬─────────────────────────────┘
                                             ▼
                             Shared Common Courses (8)
                           • General Psychology
                           • Logic and Critical Thinking
                           • Communicative English I & II
                           • Geography of Ethiopia and the Horn
                           • Social Anthropology
                           • Introduction to Emerging Technologies
                           • Moral and Civic Education
                           • Physical Fitness
```

### 4.2 Stream Comparison Matrix

| Course Name | Course Code | Stream Allocation | Canonical Expansion | Category Reference |
| :--- | :--- | :---: | :--- | :--- |
| **Mathematics for Natural Sciences** | `Math 1011` | Natural Science Only | `mathematics for natural sciences` | `university-natural-sciences` |
| **General Physics** | `Phys 1011` | Natural Science Only | `general physics` | `university-natural-sciences` |
| **General Biology** | `Biol 1011` | Natural Science Only | `general biology` | `university-natural-sciences` |
| **General Chemistry** | `Chem 1011` | Natural Science Only | `general chemistry` | `university-natural-sciences` |
| **History of Ethiopia and the Horn** | `Hist 1011` | Natural Science | `history of ethiopia and the horn` | `university-humanities` |
| **Mathematics for Social Sciences** | `Math 1012` | Social Science Only | `mathematics for social sciences` | `university-natural-sciences` |
| **Economics** | `Econ 1011` | Social Science Only | `economics` | `university-business` |
| **Entrepreneurship** | `Mgmt 1012` | Social Science Only | `entrepreneurship` | `university-business` |
| **Global Trends** | `GlTr 1012` | Social Science Only | `global trends` | `university-humanities` |
| **Inclusiveness** | `SnIe 1012` | Social Science Only | `inclusiveness` | `university-humanities` |
| **General Psychology** | `Psyc 1011` | Shared Both Streams | `general psychology` | `university-humanities` |
| **Logic and Critical Thinking** | `Phil 1011` | Shared Both Streams | `logic and critical thinking` | `university-humanities` |
| **Communicative English Language Skills** | `FLEn 1011` / `EnLa 1011` | Shared Both Streams | `communicative english` | `university-humanities` |
| **Geography of Ethiopia and the Horn** | `Geog 1011` | Shared Both Streams | `geography of ethiopia and the horn` | `university-humanities` |
| **Social Anthropology** | `Anth 1012` | Shared Both Streams | `social anthropology` | `university-humanities` |
| **Intro to Emerging Technologies** | `EmTe 1012` | Shared Both Streams | `emerging technologies` | `university-computing` |
| **Moral and Civic Education** | `McVe 1012` | Shared Both Streams | `moral and civic education` | `university-humanities` |
| **Physical Fitness** | `SpSc 1011` | Shared Both Streams | `physical fitness` | `university-humanities` |

---

## 5. SEARCH ALIASES & BACKWARDS COMPATIBILITY

### 5.1 Zero-Collision Alias Resolution

The taxonomy includes a pre-indexed alias resolution dictionary that maps short acronyms and queries to their canonical targets:
- `dbms` $\rightarrow$ Target: `university-computing` | Expansion: `"database"`
- `dsa` $\rightarrow$ Target: `university-computing` | Expansion: `"data structures"`
- `os` $\rightarrow$ Target: `university-computing` | Expansion: `"operating systems"`
- `cn` $\rightarrow$ Target: `university-computing` | Expansion: `"computer networks"`
- `se` $\rightarrow$ Target: `university-computing` | Expansion: `"software engineering"`
- `coa` $\rightarrow$ Target: `university-computing` | Expansion: `"computer architecture"`
- `ai` $\rightarrow$ Target: `university-computing` | Expansion: `"artificial intelligence"`
- `mathNat` $\rightarrow$ Target: `freshman-math-natural` | Expansion: `"mathematics for natural sciences"`
- `genphys` $\rightarrow$ Target: `freshman-physics` | Expansion: `"general physics"`

Validation Test 8 rigorously proves that **zero conflicting alias destinations exist across normalized keys**.

### 5.2 Preservation of `subjectAliases.js` Compatibility

The legacy module [`src/config/subjectAliases.js`](file:///c:/Users/billy/Desktop/StudyHub/src/config/subjectAliases.js) remains completely functional and intact. Its exported `{ SUBJECT_ALIASES, expandQuery }` functions continue to execute without regressions, ensuring that Phase 2.1 query expansion syntax and Phase 2.3 relevance scoring remain operating at peak accuracy.

---

## 6. VALIDATION & VERIFICATION RESULTS

### 6.1 Phase 3.1 Validation Suite (`test/academic-taxonomy.test.js`)

Executed directly against the local isolated environment:

```
=======================================================
  StudyHub Phase 3.1 — Academic Taxonomy Test Suite    
=======================================================

  ✓ Test 1: Exactly 4 collections with valid IDs and descriptions
  ✓ Test 2: Exactly 21 primary subject categories with unique IDs
  ✓ Test 3: Every category belongs to a valid education group (7 per group)
  ✓ Test 4: Collection IDs and category IDs are unique and well-formatted
  ✓ Test 5: Search aliases resolve to valid taxonomy targets
  ✓ Test 6: Natural Science and Social Science streams are distinct with 13 courses each
  ✓ Test 7: Freshman course aliases resolve to valid courses (18 courses)
  ✓ Test 8: Zero conflicting alias destinations across normalized keys
  ✓ Test 9: Grade 9 supported under secondary education without creating a 22nd primary category
  ✓ Test 10: Existing subjectAliases.js keywords and aliases remain compatible
  ✓ Test 11: Backend (src/) and Frontend (web/) import identical taxonomy configuration
    Verified collection document count: 92,143
  ✓ Test 12: Database document count invariance (strictly 92,143 documents)

=======================================================
  Academic Taxonomy Tests Completed: 12/12 Passed
=======================================================
```

### 6.2 Full Phase 2 Regression Suite

To ensure zero regressions across all search, pagination, and delivery pipelines, all Phase 2 test suites were executed sequentially:

| Test Suite | Phase | Description | Result |
| :--- | :---: | :--- | :---: |
| `test/search-query-expansion.test.js` | 2.1 | Query expansion syntax without SQL Boolean OR tokens | **9/9 Passed** |
| `test/search-duplicate-deduplication.test.js` | 2.2 | Cross-channel exact duplicate collapsing by `fileUniqueId` | **8/8 Passed** |
| `test/search-subject-relevance.test.js` | 2.3 | Subject search relevance ranking with intent scoring | **7/7 Passed** |
| `test/search-suggestions.test.js` | 2.4 | Search suggestions & autocomplete engine on web and bot | **15/15 Passed** |
| `test/search-results-experience.test.js` | 2.5 | Professional search results presentation on web & Telegram | **9/9 Passed** |
| `test/search-pagination-session.test.js` | 2.6 | Telegram search pagination sliding window & 3-tier recovery | **14/14 Passed** |
| `test/explore-pagination.test.js` | 2.7 | Website Explore browse reliability & 39,470 entity inventory | **11/11 Passed** |
| `test/telegram-delivery-failure.test.js` | 2.8 | Telegram delivery error classification (`TEMPORARY` / `PERMANENT`) | **11/11 Passed** |
| `test/academic-taxonomy.test.js` | 3.1 | Centralized Ethiopian academic taxonomy validation | **12/12 Passed** |
| **Total Test Pass Rate** | — | **All Phase 2 & Phase 3.1 Test Suites** | **96/96 Passed (100%)** |

### 6.3 Next.js Frontend Production Build

The Next.js 16.4.5 Turbopack production build was executed with full TypeScript type-checking:

```bash
npm run build --prefix web
```

**Build Output:**
- `next.config.ts`: Successfully compiled in 138ms.
- Turbopack Compilation: Compiled in 5.3s.
- TypeScript Validation: 0 errors in 7.6s.
- Static Pages Generated: 11 / 11 routes generated successfully (`/`, `/explore`, `/subjects`, `/about`, `/help`, `/resource/[id]`, `/sitemap.xml`, etc.).
- Exit code: `0`.

### 6.4 Database Document Invariance

- **Baseline Count (Phase 1):** 92,143 documents
- **Post-Taxonomy Validation Count:** 92,143 documents
- **Net Database Mutation:** **0 writes, 0 updates, 0 deletions, 0 index changes.**

---

## 7. DEVELOPER & INTEGRATION USAGE GUIDE

### 7.1 Backend Consumption (`src/`)

```javascript
const {
  COLLECTIONS,
  SUBJECT_CATEGORIES,
  getCollection,
  getSubjectCategory,
  getCategoriesByGroup,
  getFreshmanCoursesByStream,
  resolveAlias
} = require("./config/taxonomy");

// 1. Get all categories for secondary education
const secondaryCategories = getCategoriesByGroup("secondary");

// 2. Get freshman courses for Natural Science stream
const naturalScienceCourses = getFreshmanCoursesByStream("natural-science");

// 3. Resolve student query abbreviation to category
const target = resolveAlias("dbms");
// Returns: { key: "dbms", targetType: "category", targetId: "university-computing", ... }
```

### 7.2 Frontend Consumption (`web/`)

```typescript
import {
  COLLECTIONS,
  SUBJECT_CATEGORIES,
  getCollection,
  getSubjectCategory,
  getCategoriesByGroup,
  getFreshmanCoursesByStream
} from "@/lib/taxonomy";

// Fully typed TypeScript objects for rendering filters, category grids, and course lists
export default function SubjectDiscoveryPage() {
  const universityCategories = getCategoriesByGroup("university");
  return (
    <div>
      {universityCategories.map(cat => (
        <CategoryCard key={cat.id} category={cat} />
      ))}
    </div>
  );
}
```

---

## 8. CONCLUSION & NEXT STEPS

StudyHub Phase 3.1 establishes a clean, robust, and centralized Ethiopian academic taxonomy without incurring database migrations or disrupting existing search relevance. The system is now primed for Phase 3.2 (Resource Classification and Discovery UI), where materials will be classified against these standardized collections, groups, and categories across the website and Telegram bot.
