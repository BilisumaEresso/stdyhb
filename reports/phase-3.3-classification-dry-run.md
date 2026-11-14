# StudyHub Phase 3.3.2 — Re-Evaluated Classification Dry-Run & Targeted Refinement Report

**Evaluation Date:** 2026-11-14  
**Execution Mode:** Production MongoDB — Strictly Read-Only (0 writes, 0 mutations)  
**Database Document Invariance:** Verified (Initial: 92,143, Final: 92,143)  
**Taxonomy Source of Truth:** `src/config/taxonomy.json` & `src/config/taxonomy.js`  
**Review Worksheet Reference:** `reports/classification-human-review-worksheet.md`  

---

## 1. Executive Summary & Catalog Inventory

StudyHub stores Telegram album members as distinct records in `telegramresources` while presenting them as consolidated units in search results. For classification evaluation, each available album is evaluated as exactly **one searchable entity**, preventing multi-page image albums from inflating document metrics.

| Entity / Document Type | Count | % of Catalog | Definition / Operational Status |
| :--- | :--- | :--- | :--- |
| **Total MongoDB Documents** | **92,143** | 100.0% | Entire collection footprint in `telegramresources` |
| Available Active Documents (`isAvailable: true`) | 83,073 | 90.2% | Documents active and accessible for user discovery |
| Unavailable Documents (`isAvailable: false`) | 9,070 | 9.8% | Documents marked unavailable in `telegramresources` |
| *Formally Quarantined Records* | *9,044* | *9.8%* | *Records safely archived in dedicated `telegramresourcequarantines`* |
| *Temporary Delivery Failure Delta* | *26* | *<0.1%* | *26 academic files investigated in Phase 2.8 before deduplication* |
| **Standalone Searchable Entities** | **27,230** | 69.0% | Independent files (`groupId: null` or empty) |
| **Searchable Albums (Consolidated)** | **12,240** | 31.0% | Unified photo sets covering 55,843 member documents |
| **Total Searchable Entities Evaluated** | **39,470** | **100.0%** | **Denominator for all classification percentages** |

---

## 2. Category Statistics Reconciliation

### Root Cause of the Phase 3.3 Discrepancy
The initial Phase 3.3 report showed 19,131 category predictions and 22,368 uncategorized entities, totaling 41,499 (2,029 greater than the 39,470 evaluated entities). This occurred because resources can receive multiple category assignments (e.g., an interdisciplinary course assigned both `university-computing` and `university-engineering`). The figure 19,131 represented **total category assignments**, while 22,368 represented **distinct entities without categories**.

### Reconciled Entity Breakdown

| Category Dimension | Distinct Entity Count | % of Evaluated Entities (N = 39,470) | Mathematical Reconciliation |
| :--- | :--- | :--- | :--- |
| **Entities with $\ge 1$ Category** | **16,870** | **42.7%** | **$15,678 + 1,192 = 16,870$** |
| — Entities with exactly 1 category | 15,678 | 39.7% | Single-category assignments ($15,678 \times 1 = 15,678$) |
| — Entities with multiple categories | 1,192 | 3.0% | Multi-category assignments ($3,251$ assignments across 1,192 entities) |
| **Entities with 0 Categories (Uncategorized)** | **22,600** | **57.3%** | Generic, unacademic, or ambiguous tier |
| **Total Evaluated Searchable Entities** | **39,470** | **100.0%** | **$16,870 + 22,600 = 39,470$ (Exact Match)** |
| **Total Category Assignments** | **18,929** | — | **$15,678 + 3,251 = 18,929$ assignments** |

### Multi-Category Multiplicity Breakdown
- Exactly 1 category: **15,678 entities** (15,678 assignments)
- Exactly 2 categories: **652 entities** (1,304 assignments)
- Exactly 3 categories: **281 entities** (843 assignments)
- Exactly 4 categories: **202 entities** (808 assignments)
- Exactly 5 categories: **46 entities** (230 assignments)
- Exactly 6 categories: **11 entities** (66 assignments)
- **Excess Assignments over Unique Entities**: $(652 \times 1) + (281 \times 2) + (202 \times 3) + (46 \times 4) + (11 \times 5) = \mathbf{2,059}$. Exactly reconciles total assignments ($18,929 - 16,870 = 2,059$).

---

### Before (Phase 3.3.1) vs After (Phase 3.3.2) Refinement Comparison

| Evaluation Dimension | Phase 3.3.1 Baseline | Phase 3.3.2 Refined | Delta ($\Delta$) | Operational Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Categorized Entities ($\ge 1$ category)** | 17,102 (43.3%) | 16,870 (42.7%) | -232 | Pruned false-positive categories on administrative notices & unverified course codes |
| **Uncategorized Entities (0 categories)** | 22,368 (56.7%) | 22,600 (57.3%) | +232 | Appropriately held unacademic or ambiguous notices in needs-review/unclassified |
| **Total Category Assignments** | 19,131 | 18,929 | -202 | Eliminated spurious cross-tagging on announcements |
| **University Group Entities** | 11,874 (30.1%) | 11,642 (29.5%) | -232 | Pruned Ethiopian Coders announcement from university computing |
| **Secondary Group Entities** | 4,919 (12.5%) | 4,919 (12.5%) | 0 | Invariant; secondary rules preserved |
| **KG–Grade 8 Entities** | 309 (0.8%) | 309 (0.8%) | 0 | Invariant; primary rules preserved |
| **Past Exams Collection** | 14,266 (36.1%) | 13,549 (34.3%) | -717 | Pruned slide decks (`.pptx`) & study notes from past exams |
| **Freshman Courses Collection** | 5,304 (13.4%) | 4,713 (11.9%) | -591 | Broad HEI exams (Chem, Anthro, etc.) require explicit freshman evidence |
| **Study Materials Collection** | 8,080 (20.5%) | 8,078 (20.5%) | -2 | Pruned non-academic notices |
| **Fiction & Reading Collection** | 4,996 (12.7%) | 4,996 (12.7%) | 0 | Invariant; literature rules preserved |
| **Status: Classified** | 25,862 (65.5%) | 25,702 (65.1%) | -160 | Higher precision; spurious records moved to needs-review |
| **Status: Needs Review** | 5,661 (14.3%) | 5,829 (14.8%) | +168 | Appropriately queued for human review |
| **Status: Unclassified** | 7,947 (20.1%) | 7,939 (20.1%) | -8 | Computing math disambiguated (Discrete Math moved to classified) |
| **Confidence: High** | 11,818 (29.9%) | 11,500 (29.1%) | -318 | True exam paper verification lowered false high confidence on slide decks |
| **Confidence: Medium** | 15,884 (40.2%) | 16,218 (41.1%) | +334 | Appropriately balanced medium-confidence distribution |
| **Confidence: Low** | 11,768 (29.8%) | 11,752 (29.8%) | -16 | Unchanged within 0.1% |
| **Catalog Document Count** | 92,143 | 92,143 | 0 | Verified strictly invariant read-only execution |

---

## 3. Distinct Entities per Education Group

Each entity is classified into a single education tier. The tier disambiguation logic prevents cross-tier contamination, meaning no entity is simultaneously assigned to university and school categories.

| Education Group | Canonical Group ID | Distinct Entities | % of Evaluated Catalog |
| :--- | :--- | :--- | :--- |
| **University / Higher Education** | `university` | **11,642** | **29.5%** |
| **Secondary (Grades 9–12)** | `secondary` | **4,919** | **12.5%** |
| **KG–Grade 8 (Primary / Middle)** | `kg8` | **309** | **0.8%** |
| **Entities Assigned Across Multiple Groups** | — | **0** | **0.0% (Zero cross-tier contamination)** |
| **Total Distinct Categorized Entities** | — | **16,870** | **42.7%** |

### Detailed 21 Categories Breakdown (Distinct Entities per Category)

| Category Display Name | Canonical Taxonomy ID | Education Tier | Distinct Entities | % of Evaluated Catalog (N = 39,470) |
| :--- | :--- | :--- | :--- | :--- |
| **Languages & Literacy** | `kg8-languages-literacy` | kg8 | 137 | 0.3% |
| **Mathematics** | `kg8-mathematics` | kg8 | 68 | 0.2% |
| **General & Environmental Science** | `kg8-general-science` | kg8 | 61 | 0.2% |
| **Social Studies & Geography** | `kg8-social-studies-geography` | kg8 | 17 | 0.0% |
| **History, Civics & Moral Education** | `kg8-history-civics` | kg8 | 32 | 0.1% |
| **ICT & Basic Technology** | `kg8-ict-technology` | kg8 | 1 | 0.0% |
| **Arts, Music, Health & Physical Education** | `kg8-arts-health-pe` | kg8 | 7 | 0.0% |
| **English & Ethiopian Languages** | `secondary-languages` | secondary | 578 | 1.5% |
| **Mathematics** | `secondary-mathematics` | secondary | 713 | 1.8% |
| **Physics** | `secondary-physics` | secondary | 1,210 | 3.1% |
| **Chemistry** | `secondary-chemistry` | secondary | 1,046 | 2.7% |
| **Biology & Life Sciences** | `secondary-biology` | secondary | 1,202 | 3.0% |
| **Social Sciences** | `secondary-social-sciences` | secondary | 1,827 | 4.6% |
| **Applied Science & Technology** | `secondary-applied-technology` | secondary | 112 | 0.3% |
| **Computing & Information Sciences** | `university-computing` | university | 1,395 | 3.5% |
| **Engineering & Built Environment** | `university-engineering` | university | 227 | 0.6% |
| **Natural & Computational Sciences** | `university-natural-sciences` | university | 2,027 | 5.1% |
| **Health & Medical Sciences** | `university-health-sciences` | university | 3,935 | 10.0% |
| **Agriculture, Veterinary & Natural Resources** | `university-agriculture` | university | 36 | 0.1% |
| **Business & Economics** | `university-business` | university | 1,391 | 3.5% |
| **Social Sciences, Humanities, Law & Education** | `university-humanities` | university | 2,907 | 7.4% |

---

## 4. Predicted Collection Distribution

A single resource entity may belong to more than one collection when justified by unambiguous evidence (e.g., a university freshman final exam belongs to both **Past Exams, Entrance & Exit** and **University Freshman Courses**).

| Official Collection | Canonical ID | Predicted Entities | % of Evaluated Catalog (N = 39,470) |
| :--- | :--- | :--- | :--- |
| **Past Exams, Entrance & Exit** | `past-exams-entrance-exit` | **13,549** | 34.3% |
| **Study Materials** | `study-materials` | **8,078** | 20.5% |
| **Ethiopian Fiction & Reading** | `ethiopian-fiction-reading` | **4,996** | 12.7% |
| **University Freshman Courses** | `university-freshman-courses` | **4,713** | 11.9% |
| *Single Collection Entities* | *(Entities in exactly 1 collection)* | 21,476 | 54.4% |
| *Multi-Collection Overlap* | *(Entities in $\ge 2$ collections)* | 4,670 | 11.8% |
| *No Collection Predicted* | *(Strictly unclassified)* | 13,324 | 33.8% |

---

## 5. Confidence and Status Cross-Tabulation

### Cross-Tabulation Matrix

| Confidence Level | Classified | Needs Review | Unclassified | Total Entities | % of Catalog |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **HIGH** | **11,500** | **0** | **0** | **11,500** | **29.1%** |
| **MEDIUM** | **14,202** | **2,016** | **0** | **16,218** | **41.1%** |
| **LOW** | **0** | **3,813** | **7,939** | **11,752** | **29.8%** |
| **Total Entities** | **25,702** (65.1%) | **5,829** (14.8%) | **7,939** (20.1%) | **39,470** | **100.0%** |

### Classification Rules Behind Status Assignments
1. **Low Confidence is NEVER Classified ($0$ entities)**:
   - Low-confidence predictions are strictly directed to `needs_review` (3,821) when partial signals exist, or `unclassified` (7,947) when signals are absent or conflicting. A low-confidence prediction is never silently presented as a classified result.
2. **High Confidence is ALWAYS Classified (11,500 entities)**:
   - Resources with explicit, verified evidence (e.g. `isExam: true` with a verified category, explicit freshman course matching, or unambiguous tertiary course code and university metadata) achieve high confidence and `classified` status.
3. **Medium Confidence Disambiguation**:
   - `classified` (14,202): Relevant subject identified in clear higher-ed or secondary context, or verified collection matched (e.g. literature on dedicated fiction channel).
   - `needs_review` (2,016): Collection matched (e.g. Study Materials) without an identifiable academic category, requiring human review before category tagging.

---

## 6. Targeted Quality Audit of Seven Audited Examples (Phase 3.3.2 Refinements)

| Audited Resource Example | Phase 3.3.1 Initial Baseline | Phase 3.3.2 Refined Prediction | Root Cause & Refinement Applied |
| :--- | :--- | :--- | :--- |
| **1. Ethiopian Coders Announcement** | `study-materials`<br>`university-computing`<br>Status: `classified`<br>Confidence: `high` | Collections: `[]`<br>Categories: `[]`<br>Status: `needs_review`<br>Confidence: `low` | Administrative announcement / promotional campaign detected. Prevents weak programming tags and course codes from falsely classifying non-academic notices as study materials. |
| **2. General Psychology (MoSHE Module)** | `study-materials`<br>`university-humanities`<br>Status: `classified`<br>Confidence: `high`<br>*(Omitted freshman)* | Collections:<br>`study-materials`<br>`university-freshman-courses`<br>Categories: `university-humanities`<br>Status: `classified`<br>Confidence: `high` | Narrowly recognized `MoSHE module` combined with standardized freshman course identity, correctly capturing national freshman curriculum context. |
| **3. Communicative English II (`FLEN1012`)** | `study-materials`<br>`university-humanities`<br>Status: `classified`<br>Confidence: `high`<br>*(Attempted universal mapping)* | Without university context:<br>Collections: `study-materials`<br>Categories: `university-humanities`<br>*(No freshman-courses)*<br><br>With university context:<br>Collections: `study-materials`<br>`university-freshman-courses`<br>Categories: `university-humanities` | Prevented `FLEN1012` from acting as a universal freshman code without university context. Preserved optional example course code taxonomy design; requires verified university context. |
| **4. Discrete Math for SE** | No collections<br>No categories<br>Status: `unclassified`<br>Confidence: `low`<br>*(Ambiguity guard trapped)* | Collections: `past-exams-entrance-exit`<br>Categories: `university-computing`<br>Status: `classified`<br>Confidence: `high` | Applied computing mathematics (Discrete Mathematics in computing/software context) correctly routed to `university-computing` instead of being trapped in ambiguous unclassified math or generic natural sciences. |
| **5. General Chemistry BDU** | `past-exams-entrance-exit`<br>`university-freshman-courses`<br>`university-natural-sciences`<br>Status: `classified` | Collections: `past-exams-entrance-exit`<br>Categories: `university-natural-sciences`<br>Status: `classified`<br>Confidence: `high`<br>*(No freshman-courses)* | Broad university exams (chemistry, physics, biology, economics, anthropology) require explicit freshman connection evidence (`freshman`, `1st year`, freshman channel, or MoSHE module) rather than relying exclusively on university presence. |
| **6. Anthropology Mid Exam BDU** | `past-exams-entrance-exit`<br>`university-freshman-courses`<br>`university-humanities`<br>Status: `classified` | Collections: `past-exams-entrance-exit`<br>Categories: `university-humanities`<br>Status: `classified`<br>Confidence: `high`<br>*(No freshman-courses)* | General university midterm examination at Bahir Dar University classified accurately into `past-exams-entrance-exit` and `university-humanities` without over-attributing freshman status without freshman evidence. |
| **7. General Psychology Freshman (.pptx)** | `past-exams-entrance-exit`<br>`study-materials`<br>`university-freshman-courses`<br>Status: `classified` | Collections:<br>`study-materials`<br>`university-freshman-courses`<br>Categories: `university-humanities`<br>Status: `classified`<br>Confidence: `high`<br>*(No past-exams)* | Distinguishes actual examination papers from lecture slides/presentations (`.pptx`); does not assign `past-exams-entrance-exit` solely due to exam channel or tags when the resource is lecture slides. |

---

## 7. Human Review Sample Worksheet

To avoid premature claims of accuracy prior to human inspection, a 30-item representative sample worksheet has been compiled at:

📁 **[`reports/classification-human-review-worksheet.md`](file:///c:/Users/billy/Desktop/StudyHub/reports/classification-human-review-worksheet.md)**

This worksheet contains:
- 6 High-confidence classified entities
- 6 Medium-confidence classified entities
- 6 Medium-confidence needs-review entities
- 6 Low-confidence needs-review / ambiguous entities
- 6 Low-confidence unclassified entities
- Full metadata (IDs, filenames, channels, tags, exam flags, course codes, universities)
- Model predictions and generated reasons
- Structured blank fields for human reviewer decisions (`Agree / Disagree / Uncertain`), verified collections, verified categories, and reviewer notes.

---

## 8. Strictly Read-Only Execution Certification

- **MongoDB Document Modifications:** 0
- **Database Schema Changes:** 0
- **Database Indexes Added/Modified:** 0
- **Collections Written To:** 0
- **Initial Document Count:** 92,143
- **Final Document Count:** 92,143 (Verified Invariant)
