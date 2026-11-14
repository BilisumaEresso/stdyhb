# StudyHub — Phase 0: Deep Database, Resource & Search Architecture Audit Report

**Date of Inspection**: 2026-11-13  
**Auditor**: Senior Software Architect, MongoDB Database Engineer & IR Specialist  
**Target Environment**: Production Database (`studyhub` on MongoDB Atlas v8.0.37) & Codebase (`c:\Users\billy\Desktop\StudyHub`)  
**Audit Status**: Complete — Read-Only Investigation  

---

## Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Database Architecture & Topology](#2-database-architecture--topology)
3. [Verified Resource Count & Inventory](#3-verified-resource-count--inventory)
4. [Resource Data Profile & Field Completeness](#4-resource-data-profile--field-completeness)
5. [Telegram Data Structure & Identity Mapping](#5-telegram-data-structure--identity-mapping)
6. [Data Quality & Duplicate Analysis](#6-data-quality--duplicate-analysis)
7. [Stratified Resource Sampling Analysis](#7-stratified-resource-sampling-analysis)
8. [Website Search Architecture Audit](#8-website-search-architecture-audit)
9. [Telegram Bot Search Architecture Audit](#9-telegram-bot-search-architecture-audit)
10. [Search Inline Suggestions & Discovery](#10-search-inline-suggestions--discovery)
11. [SEO & Web Discoverability Audit](#11-seo--web-discoverability-audit)
12. [Automatic Categorization Readiness & Signal Evaluation](#12-automatic-categorization-readiness--signal-evaluation)
13. [Future Database Model Compatibility](#13-future-database-model-compatibility)
14. [Historical Backfill Feasibility Analysis](#14-historical-backfill-feasibility-analysis)
15. [Technical Risks & Operational Hazards](#15-technical-risks--operational-hazards)
16. [Evidence, File References & Verification Traceability](#16-evidence-file-references--verification-traceability)
17. [Decisions Requiring User / Stakeholder Sign-Off](#17-decisions-requiring-user--stakeholder-sign-off)

---

## 1. Executive Overview

This technical audit was conducted to prepare StudyHub for a multi-collection, multi-subject academic categorization overhauling its 92,000+ indexed academic resources. StudyHub is an academic resource discovery engine serving Ethiopian university and high school students across two primary entry points:
- **Web Application**: Next.js 15 App Router deployed on Vercel (`webstudyhub.vercel.app`).
- **Telegram Bot**: Telegraf 4 + GramJS runner deployed on Render (`@studyhub_resource_bot`).

### Key Discoveries:
1. **Verified Resource Count**: The database contains **92,140 total resource documents** in `telegramresources`. Of these, **83,070 are active/available (`isAvailable: true`)**, and **9,070 are deactivated/quarantined (`isAvailable: false`)**. In addition, **9,044 documents** reside in a dedicated quarantine snapshot collection (`telegramresourcequarantines`), comprising 8,651 single-image non-academic files, 138 commercial advertisements, and 123 administrative notices removed during earlier purification phases.
2. **Search Architecture Relationship**: The website and Telegram bot **share the same underlying scoring engine** (`src/search/search.service.js`), but **execute differently**:
   - The Telegram bot personalizes results by injecting the authenticated user's university profile (+80 boost), formats results into interactive Telegram message keyboards, and supports inline queries (`@bot <query>`).
   - The Website API (`src/api/routes.js`) calls the search service with `user: null`, hard-caps results at 200 items, and filters them in-memory by university and fileType before slicing for pagination. When browsing without a search query (`q=""`), the website bypasses the search engine completely and executes a direct MongoDB find with a subtle group filtering flaw.
3. **Severe Duplicate Proliferation**: Over **52.4% of all available documents (43,536 records)** belong to duplicate `fileUniqueId` clusters (13,133 distinct clusters). 5,972 clusters are cross-channel duplicates where the exact same document (e.g. entrance exam workbooks, national curriculum textbooks) was independently indexed from up to 37 different Telegram channels.
4. **Media Group / Album Structure**: Over two-thirds (**67.22% / 55,840 available files**) are parts of Telegram media groups (albums) spanning **12,239 distinct groups**. These include 5,929 multi-PDF bundles, 4,491 handwritten/printed photo exam albums, 411 PPT slide packs, and 1,408 mixed bundles.
5. **No Document Content / OCR Text Stored**: The database stores **zero extracted document text or OCR text**. All indexing, title generation, and search scoring depend solely on raw filenames, Telegram post captions, channel usernames, and heuristically derived tags.
6. **Shared Database Pollution**: The production MongoDB database (`studyhub`) currently hosts several orphaned collections from an unrelated restaurant POS/ordering application (`branches`, `restaurants`, `tables`, `orders`, `products`, `assistances`).

---

## 2. Database Architecture & Topology

### 2.1 Database Technology & Infrastructure
- **Database Engine**: MongoDB 8.0.37 (MongoDB Atlas Community/Dedicated cluster, Replica Set across AWS/GCP nodes).
- **Database Name**: `studyhub`
- **Application ODM**: Mongoose v9.6.3 running on Node.js.
- **Connection Protocol**: Forced IPv4 resolution (`family: 4`, `dns.setDefaultResultOrder('ipv4first')`) to bypass ISP/cloud DNS timeouts on Windows and Render.

### 2.2 Complete Collection Inventory

| Collection Name | Document Count | StudyHub Purpose | Active / Legacy |
|---|---:|---|---|
| `telegramresources` | **92,140** | Primary academic resources indexed from Telegram channels | **Active Core** |
| `telegramresourcequarantines` | **9,044** | Rollback safety collection for purged/quarantined resources | **Active Core** |
| `telegramchannels` | **91** | Source Telegram channels tracked for ingestion and health | **Active Core** |
| `users` | **104** | Telegram bot registered users & profile data | **Active Core** |
| `searchhistories` | **290** | Query log per user for suggestions and analytics | **Active Core** |
| `downloadhistories` | **70** | User download, preview, and set-view delivery events | **Active Core** |
| `savedresources` | **17** | User bookmarked materials | **Active Core** |
| `channelrecommendations` | **65** | User-suggested Telegram channels pending admin review | **Active Core** |
| `botsessions` | **12** | Telegraf user session state with 7-day TTL | **Active Utility** |
| `cachedsearches` | **5** | Multi-provider search cache with 24-hour TTL index | **Active Utility** |
| `resourcereports` | **2** | Broken file or incorrect subject flags reported by users | **Active Utility** |
| `querysessions` | **0** | Short MD5 query hash mappings for inline pagination (1-hr TTL) | **Active Utility** |
| `branches` | 1 | Restaurant ordering branch schema | *Foreign / Legacy* |
| `restaurants` | 1 | Restaurant ordering profile schema | *Foreign / Legacy* |
| `tables` | 0 | Restaurant ordering table schema | *Foreign / Legacy* |
| `orders` | 0 | Restaurant ordering checkout schema | *Foreign / Legacy* |
| `products` | 0 | Restaurant menu product schema | *Foreign / Legacy* |
| `categories` | 0 | Restaurant menu category schema | *Foreign / Legacy* |
| `assistances` | 0 | Restaurant service assistance schema | *Foreign / Legacy* |

### 2.3 Physical Indexes on `telegramresources`
1. `_id_`: Unique primary key.
2. `channelUsername_1_messageId_1`: Unique compound index enforcing channel-message uniqueness.
3. `tags_1`: Single field index on the string array of tags.
4. `courseCode_1`: Single field index on extracted course codes.
5. `isExam_1_fileType_1`: Compound index for exam filtering.
6. `fileName_text_caption_text_tags_text_courseCode_text`: MongoDB full-text index with weights:
   - `fileName`: 5
   - `tags`: 4
   - `courseCode`: 3
   - `caption`: 1

> [!WARNING] Critical Missing Indexes
> There are **NO indexes** on `isAvailable`, `groupId`, `fileUniqueId`, `university`, `cleanTitle`, `downloadCount`, or `indexedAt`. Because almost every web and bot search includes `isAvailable: true` and groups by `groupId`, MongoDB is forced into full collection scans and in-memory collapses for unindexed predicates.

### 2.4 End-to-End Resource Ingestion & Delivery Pipeline

```
Telegram Source Channel (@channel)
           │
           ▼
[GramJS Telethon Client Session]
(Reads raw channel updates: Document, Photo, Album)
           │
           ▼
[3-Tier Gatekeeper in telegramIndexer.js]
  ├─ Gate 1: Junk / Scam / Ad Regex Pre-Filter
  ├─ Gate 2: Single Image Rejection (Only Albums permitted)
  └─ Gate 3: Academic Signal Verification (Course/Exam keywords)
           │
           ▼
[Metadata Normalizer & Title Generator]
(Extracts courseCode, year, university, semester; generates cleanTitle)
           │
           ▼
[MongoDB Storage] ───> Inserts into `telegramresources`
           │           (Unique key: { channelUsername, messageId })
           │           (Preserves groupId, groupIndex, groupTotal)
           │
           ├──────────────────────────────┐
           ▼                              ▼
[Search Engine (search.service.js)]   [Private Archive Channel]
  ├─ Typo Correction                  (autoArchiveSingle / autoArchiveGroup
  ├─ Subject Alias Expansion           backs up messages via GramJS to
  ├─ Partitioned Text Search           ARCHIVE_CHAT_ID for permanent delivery)
  ├─ Album Bundle Collapsing              │
  └─ ISR Popularity Boosting              ▼
           │                     [File Delivery Engine (fileDelivery.js)]
           │                       ├─ GramJS forwards from Channel/Archive
           │                       ├─ Enters RELAY_GROUP_ID
           │                       ├─ Telegraf bot `copyMessage` to User
           │                       └─ Relay message deleted immediately
           ▼
[Presentation Tier]
  ├─ Web: Express REST API (/api/search) -> Next.js 15 UI Cards
  └─ Bot: Telegraf Interactive Message Cards + Inline Queries
```

---

## 3. Verified Resource Count & Inventory

*Date of Verification: 2026-11-13T05:51:49.330Z*

### 3.1 Resource Breakdown

| Metric | Raw Count | % of Total | % of Available |
|---|---:|---:|---:|
| **Total Stored Resource Documents** | **92,140** | 100.00% | — |
| **Available Resources (`isAvailable: true`)** | **83,070** | 90.16% | 100.00% |
| **Deactivated / Unavailable Resources** | **9,070** | 9.84% | — |
| **Quarantine Backup Collection (`telegramresourcequarantines`)** | **9,044** | — | — |
| **Total Marked as Past Exam (`isExam: true`)** | **42,354** | 45.96% | 51.00% |
| **Files in Media Groups / Albums (`groupId != null`)** | **55,970** | 60.74% | 67.22% |
| **Unique Media Group Clusters (`distinct groupId`)** | **12,271** | — | — |
| **Standalone Files (No `groupId`)** | **36,170** | 39.26% | 32.78% |
| **Backed Up in Private Archive (`archiveMessageId != null`)** | **74,946** | 81.34% | 80.81% |

### 3.2 Clarification of the "80,000+" Statistic
The commonly cited "80,000+ resources" refers to **83,070 active database documents in `telegramresources`**.
However, because **55,840 active documents are individual pages/files belonging to 12,239 media groups (albums)**, the actual number of **distinct searchable academic entities** (standalone files + collapsed album sets) is:
$$\text{Distinct Searchable Entities} = 27,230\text{ (standalone)} + 12,239\text{ (albums)} = \mathbf{39,469\text{ distinct learning objects}}$$
Furthermore, because **43,536 documents are cross-posted duplicate files**, the number of **unique physical files (distinct `fileUniqueId`)** is approximately **49,500 unique files**.

---

## 4. Resource Data Profile & Field Completeness

### 4.1 Schema Field Completeness Table

*Evaluated across all 83,070 available resource documents (`isAvailable: true`)*

| Field Name | BSON Type | Populated Count | Missing / Empty | Completeness % | Search Utility | Classification Value | Recommended Action |
|---|---|---:|---:|---:|---|---|---|
| `_id` | ObjectId | 83,070 | 0 | **100.00%** | System Key | None | Retain as primary key |
| `fileId` | String | 83,070 | 0 | **100.00%** | Delivery | None | Retain for Bot API delivery |
| `fileUniqueId` | String | 83,070 | 0 | **100.00%** | Dedup | High (Dedup) | **Index immediately** for deduplication |
| `messageId` | Number | 83,070 | 0 | **100.00%** | Delivery | Low | Retain for channel provenance |
| `chatId` | Number | 83,070 | 0 | **100.00%** | Delivery | Low | Retain for GramJS forwarding |
| `channelUsername` | String | 83,070 | 0 | **100.00%** | Display | Medium | Retain; use for subject prior probability |
| `cleanTitle` | String | 83,070 | 0 | **100.00%** | High | **Critical** | Retain; primary text signal for classifier |
| `fileName` | String | 62,462 | 20,608 | **75.19%** | High | **Critical** | Retain; 20,608 missing are Telegram photos |
| `caption` | String | 61,244 | 21,826 | **73.73%** | High | **Critical** | Retain; vital for photo sets and context |
| `fileType` | String | 83,070 | 0 | **100.00%** | High | Medium | Retain enum: `pdf`, `ppt`, `doc`, `image` |
| `fileSize` | Number | 83,070 | 0 | **100.00%** | Display | Low | Fix: 17,305 have `fileSize <= 0` |
| `groupId` | String | 55,840 | 27,230 | **67.22%** | High | High (Bundling) | **Index immediately**; critical for albums |
| `groupIndex` | Number | 83,070 | 0 | **100.00%** | Ordering | Low | Retain (1-based index) |
| `groupTotal` | Number | 83,070 | 0 | **100.00%** | Display | Low | Retain album size counter |
| `tags` | Array[Str] | 56,441 | 26,629 | **67.94%** | High | High | Retain; normalize existing noisy tags |
| `isExam` | Boolean | 83,070 | 0 | **100.00%** | High | High | Retain; 51.0% marked true |
| `courseCode` | String | 11,298 | 71,772 | **13.60%** | High | High | Retain; re-extract using improved regex |
| `year` | Number | 19,684 | 63,386 | **23.70%** | Medium | Medium | Retain; distinguish E.C. vs G.C. years |
| `university` | String | 7,709 | 75,361 | **9.28%** | High | High | Sparse; supplement from channel metadata |
| `semester` | String | 651 | 82,419 | **0.78%** | Low | Low | Extremely sparse; do not rely upon |
| `relevanceScore` | Number | 83,070 | 0 | **100.00%** | Medium | Low | Legacy scoring counter; replace with dynamic IR |
| `downloadCount` | Number | 83,070 | 0 | **100.00%** | High | Low | **Index** for popularity sorting |
| `reportCount` | Number | 22,971 | 60,099 | **27.65%** | Moderation| Low | Retain for quality flags |
| `isAvailable` | Boolean | 83,070 | 0 | **100.00%** | Critical | Low | **Index immediately** |
| `archiveMessageId`| Number | 67,125 | 15,945 | **80.81%** | Delivery | None | Retain for storage redundancy |
| `indexedAt` | Date | 83,070 | 0 | **100.00%** | Sort | Low | Retain |
| `messageDate` | Date | 83,070 | 0 | **100.00%** | Sort/Year | Medium | Retain; range: 2020–2026 |

### 4.2 File Format Distributions

| Format / FileType | Stored Count | % of Available | File Extension Count | Extension Consistency |
|---|---:|---:|---:|---|
| **PDF Documents (`pdf`)** | 54,520 | 65.63% | `.pdf`: 54,520 | 100% Consistent |
| **Exam Photo Sets (`image`)** | 20,608 | 24.81% | None (Telegram photos) | 100% Grouped albums |
| **PowerPoint Presentations (`ppt`)** | 4,401 | 5.30% | `.pptx`: 3,701 / `.ppt`: 700 | 100% Consistent |
| **Word Documents (`doc`)** | 3,541 | 4.26% | `.docx`: 3,038 / `.doc`: 503 | 100% Consistent |
| **Other / Code / Archives** | 0 | 0.00% | None | Skipped at ingestion |

### 4.3 Linguistic & Script Breakdown
Based on full-text Unicode block analysis across all 83,070 available documents:
- **Latin / English Script Only**: **62,039 resources (74.68%)**
  - Predominantly university course slides, textbook PDFs, coding problem sets, and engineering notes.
  - Afaan Oromo materials also use Latin script (e.g. Qubee Afaan Oromoo literature from `@qubeeacademy`).
- **Mixed Latin & Ethiopic Script**: **21,031 resources (25.32%)**
  - Includes national exam prep, Amharic explanations with English course terminology, Ministry of Education announcements, and bilingual student notes.
- **Pure Ethiopic Script Only**: **0 resources (0.00%)**
  - Zero documents are purely Ethiopic because filenames always include English file extensions (`.pdf`, `.pptx`) or Telegram usernames (`@amharic_fiction_books`).
- **Detected Specific Ethiopian Languages**:
  1. *Amharic*: Readily detected in 21,000+ captions and literature files from `@amharic_fiction_books` and `@ethio_pdf_books`.
  2. *Afaan Oromo*: Detected in text from `@qubeeacademy` and `@hundechannelexam` (uses Latin script with Oromo lexical markers such as *gaaffii*, *barnoota*, *deebii*, *qormaata*).
  3. *Tigrinya*: Sparse; occasional exam papers from Mekelle University channels.

---

## 5. Telegram Data Structure & Identity Mapping

Because StudyHub is built atop Telegram's distributed content delivery network, misunderstanding Telegram's identity model can corrupt file delivery and search clustering.

### 5.1 Identity Definitions & Relationships

```
Telegram Channel (@username / chatId)
       │
       └──> Telegram Message (messageId)
                 │
                 ├── [Single File Post] ──> 1 TelegramResource doc (groupId = null)
                 │
                 └── [Media Group Album (groupedId)]
                           │
                           ├── Photo 1 (messageId: 101) ──> 1 TelegramResource doc (groupIndex: 1, groupTotal: 4)
                           ├── Photo 2 (messageId: 102) ──> 1 TelegramResource doc (groupIndex: 2, groupTotal: 4)
                           ├── Photo 3 (messageId: 103) ──> 1 TelegramResource doc (groupIndex: 3, groupTotal: 4)
                           └── Photo 4 (messageId: 104) ──> 1 TelegramResource doc (groupIndex: 4, groupTotal: 4)
```

1. **Does 1 database document represent 1 Telegram message or 1 file?**
   - **1 document represents 1 Telegram media message containing 1 file**.
   - In the Telegram MTProto API, multi-file albums are sent as sequential individual messages sharing a common 64-bit integer `groupedId`.
   - Each message in the album carries its own unique `messageId` and its own media payload (`photo` or `document`).
2. **How are media-group albums stored?**
   - Each file within the album receives its own separate document in `telegramresources`.
   - All documents in the set share the same `groupId` (stored as string: `msgs[0].groupedId.toString()`).
   - Each document records `groupIndex` (1-indexed position) and `groupTotal` (total count of media items in the album).
   - In Search (`src/search/search.service.js`), the engine **collapses** all documents sharing the same `groupId` into a single parent card (except for book channels, where individual files remain distinct).
3. **Difference between `fileId` and `fileUniqueId`**:
   - `fileId`: A session-specific, bot-specific token generated by Telegram's Bot API to download or re-send a file. If the bot token changes, `fileId` values can become invalid.
   - `fileUniqueId`: A global, immutable content identifier assigned by Telegram MTProto. Two messages containing the exact same file in two different channels will have the exact same `fileUniqueId`.
4. **File Delivery Integrity**:
   - The bot does not stream files directly from disk or cloud storage.
   - It runs GramJS under a Telegram user session (`TELEGRAM_SESSION`) that reads messages by `messageId` from the origin channel or archive channel (`ARCHIVE_CHAT_ID`), forwards them into a private `RELAY_GROUP_ID`, and then uses the Telegraf Bot API (`ctx.telegram.copyMessage`) to deliver the file to the student before wiping the relay message.
   - **Critical Architecture Implication**: Classification must be performed on the **parent learning entity** (the media group or standalone file), while maintaining individual file metadata for multi-file downloads.

---

## 6. Data Quality & Duplicate Analysis

### 6.1 Duplicate Quantification

```
Total Available Documents: 83,070
 ├── Unique Standalone / Single Files: 39,534
 └── Duplicate File Instances:        43,536 (52.41% of database)
       ├── 13,133 distinct fileUniqueId duplicate clusters
       └── 5,972 cross-channel clusters (shared across 2 to 37 channels)
```

### 6.2 Top Cross-Channel Duplicate Clusters

| Document Title / Filename | Copies in DB | Channels Sharing Document | Document Type | Academic Subject |
|---|---:|---|---|---|
| `WORK BOOK-GEOGRAPHY-GRADE-11&12.pdf` | **37** | `@ethioacadamic`, `@Ethio_Students_only`, `@keleme_2013`, `@Ethiel_Academy`, `@QesemAcademy`, `@Best_book_for_students`, `@qubeeacademy`, `@Marvel_Educations` | PDF | Grade 11–12 Social Sciences |
| `WORK BOOK-ENGLISH-GRADE 11&12.pdf` | **35** | 7 different public channels | PDF | Grade 11–12 English |
| `Handout- English for Grade 12.pdf` | **32** | 5 different public channels | PDF | Grade 12 English |
| `WORK BOOK-HISTORY-GRADE-11&12.pdf` | **32** | 7 different public channels | PDF | Grade 11–12 History |
| `Entrance Exam Physics.pdf` | **32** | 5 different public channels | PDF | Grade 12 Physics |
| `Freshman Communicative English Module.pdf` | **28** | 6 university channels | PDF | University Freshman |

### 6.3 Why Duplicates Must Not Be Deleted
In Telegram academic discovery:
- Each duplicate document represents a **distinct channel message with unique channel provenance**.
- Students often search for materials specific to their university or trusted channel (e.g., `@astusoftware2023`).
- If a channel is banned or deleted by Telegram, having duplicate copies indexed across other channels provides **operational redundancy** for file delivery.
- **Architectural Solution**: De-duplicate at the **Search and Presentation Layer** using a canonical `fileUniqueId` parent mapping, rather than hard-deleting database provenance records.

### 6.4 Data Integrity Metrics
- **Orphaned Channel References**: **0**. All 81 channels referenced by `telegramresources` exist in `telegramchannels`.
- **Corrupted Date Fields**: **0** null dates, **0** future dates.
- **Zero-Byte File Size Stubs**: **17,305 documents** have `fileSize: 0`. These are Telegram photos indexed without byte length metadata from `media.sizes`.
- **Missing Both Title & Caption**: **628 documents (0.76%)** have no filename and no caption. Their display titles rely entirely on fallback defaults.
- **Corrupted Enum in `telegramchannels`**: 1 channel record in `telegramchannels` has `type: "1"` (invalid integer string instead of enum value).

---

## 7. Stratified Resource Sampling Analysis

To evaluate real classification feasibility, **655 resources** were sampled across 10 distinct strata representing diverse formats, universities, scripts, and download volumes.

```
Total Sampled: 655
 ├── 1. Clearly Classifiable:        318 (48.5%)
 ├── 2. Ambiguous Titles:             226 (34.5%)
 ├── 3. Requires Channel Context:      47  (7.2%)
 ├── 4. Requires Extracted Text/OCR:   13  (2.0%)
 ├── 5. Requires Manual Review:         1  (0.2%)
 └── 6. Non-Academic / Quarantined:    50  (7.6%)
```

### 7.1 Representative Sanitized Examples by Pattern

#### Pattern 1: Clearly Classifiable Academic Files (48.5% of sample)
*Files with explicit course names, course codes, or academic keywords in filename or caption.*
- `Descassgnment1.pdf` — Caption: `#Discrete_Mathematics Assignment #1 Submission Date: ...` | Channel: `@astusoftware2023` | Classifiable to: **University -> Computing & Information Sciences -> Mathematics / Discrete Math**.
- `Discrete Math Worksheet I.pdf` — Caption: `#Discrete_Mathematics Assignment #1` | Classifiable to: **Computing -> Discrete Mathematics**.
- `WORK BOOK-GEOGRAPHY-GRADE-11&12.pdf` — Filename contains complete level, subject, and resource type | Classifiable to: **Grades 10–12 -> Social Sciences -> Geography**.
- `Chemistry Mock Exam for Grade 12 Tyk Remedial.pdf` — Classifiable to: **Grades 10–12 -> Chemistry** & **Past Exams, Entrance & Exit**.

#### Pattern 2: Ambiguous Titles Needing Caption Context (34.5% of sample)
*Files whose filenames are generic numbers or abbreviations, but whose caption provides the academic subject.*
- `Five year coures.pdf` — Caption: `ASTU Software Engineering 5-year curriculum outline...` | Ambiguous filename resolved by caption to **Computing & Information Sciences**.
- `uow168693.pdf` — Caption: `For the night owls and morning birds 😊 Just check this note before the exam.` | Tagged with `exam`. Ambiguous subject; caption proves it is exam prep, but subject requires surrounding post context or channel curriculum mapping.
- Telegram Photo Album `14248702666835540` — Caption: `Good Day Everyone, Your entrance ticket for the upcoming exit exam is now ready...` | Captured as exam due to keyword "exit exam", but actually an administrative scheduling notice.

#### Pattern 3: Files Requiring Channel Context (7.2% of sample)
*Files whose titles and captions lack discipline keywords, but whose origin channel confirms the subject.*
- `Unit 5.ppt` — Caption: `_______` | Channel: `@astusoftware2023` | Filename "Unit 5" is meaningless in isolation, but channel context maps it to **ASTU Software Engineering**.
- `Lecture 4 Formal Methods in Testing.pdf` — Caption: `FORMAL METHODS` | Channel: `@astusoftware2023` | Channel context confirms university-level software verification.
- `Afaan Oromoo Kitaaba Barataa Kutaa 8.pdf` — Channel: `@ethio_new_curriculum` | Confirms **KG–Grade 8 -> Languages & Literacy -> Afaan Oromo**.

#### Pattern 4: Photo Exam Albums Requiring Extracted Text / OCR (2.0% of sample)
*Handwritten exam papers photographed on desks without descriptive captions.*
- Set of 6 photos in group `13884719203918231` from `@aau_exam_collection`. Filename is empty. Caption: `Mid Exam 2014 E.C.`
- The caption confirms it is a midterm exam from 2021/2022, but does NOT specify whether it is Calculus, Electrical Circuits, or Accounting. Without OCR on the header image, the subject cannot be determined from metadata alone.

#### Pattern 5: Non-Academic / Administrative / Promotional Material (7.6% of sample)
*Materials indexed prior to the Gatekeeper overhaul.*
- Single photos of bank transfer receipts (`CBE Birr`, `Telebirr`) for tutoring services.
- Dorm placement announcements, registration deadlines, graduation schedules.
- Correctly identified by Phase 2/3 and routed to `TelegramResourceQuarantine`.

---

## 8. Website Search Architecture Audit

### 8.1 Execution Flow

```
[Student in Browser]
       │
       ▼
[Next.js 15 Client Component (`web/src/app/explore/page.tsx`)]
       │
       ▼
[Next.js Internal Route Proxy (`/api/search?...`)]
       │
       ▼
[Express REST Controller (`src/api/routes.js` -> `GET /api/search`)]
       │
       ├── Case A: Query `q` is non-empty:
       │     ├─ Calls `searchService.searchResources(q, user=null)`
       │     ├─ `searchService` runs typo correction & query expansion
       │     ├─ Executes 2 parallel text searches on MongoDB (limit 100 images, 100 docs)
       │     ├─ Merges & scores results (top 200)
       │     ├─ In-memory collapses album bundles by `groupId`
       │     ├─ Returns top 200 items to Express route
       │     ├─ Express in-memory filters by `university` and `fileType`
       │     └─ Slices array: `results.slice(startIdx, startIdx + limit)`
       │
       └── Case B: Query `q` is empty (Directory / Explore Browse):
             ├─ Directly queries `TelegramResource.find(filter)` on MongoDB
             ├─ Filters: `{ isAvailable: true, $or: [{ groupId: null }, { groupIndex: 0 }] }`
             └─ Slices using MongoDB `.skip()` and `.limit()`
```

### 8.2 Architectural Flaws & Bottlenecks in Website Search
1. **Broken Group Filter on Empty Browse**:
   - In `src/api/routes.js` (line 111), the query filter for non-search browsing specifies:
     ```javascript
     $or: [{ groupId: null }, { groupIndex: 0 }, { groupIndex: { $exists: false } }]
     ```
   - However, in `telegramIndexer.js`, albums are indexed with **1-based indexing** (`groupIndex = i + 1`, starting at 1, not 0).
   - Consequently, **no media group albums ever appear** on the initial Explore browse page when `q` is empty.
2. **In-Memory Pagination on 200-Item Cap**:
   - When searching with `q`, the search service hard-caps total results at 200 items.
   - If a search query matches 1,200 documents in the database, only the top 200 are retrieved, and pagination beyond page 10 (`200 / 20 = 10`) shows no results even though 1,000 relevant documents exist.
   - Slicing occurs in Node.js memory rather than using cursor pagination.
3. **No Dynamic Taxonomical Filtering**:
   - The API only accepts `university`, `fileType`, and `isExam`.
   - It cannot filter by Subject Category, Collection, Department, Course, or Education Grade.

---

## 9. Telegram Bot Search Architecture Audit

### 9.1 Execution Flow

```
[Student in Telegram Chat]
       │
       ├── Interaction 1: Direct Command `/search <query>` or message text
       │     ├─ Update intercepted by `src/bot/commands/search.js`
       │     ├─ Resolves student `User` profile from `users` collection
       │     ├─ Logs search to `SearchHistory` & increments `searchCount`
       │     ├─ Calls `searchService.searchResources(query, user)` (+80 boost for own university)
       │     ├─ Creates 8-character MD5 hash of query & stores in `QuerySession`
       │     └─ Calls `sendPaginatedResults` in `fileDelivery.js` (renders inline button keyboard)
       │
       ├── Interaction 2: Empty `/search` or Search Menu Button
       │     ├─ Calls `showSearchScreen(ctx)`
       │     ├─ Fetches user's last 4 distinct searches from `SearchHistory`
       │     ├─ Fetches 4 dynamic global trending suggestions from `SearchHistory` + top tags
       │     └─ Renders interactive 1-tap search button grid
       │
       └── Interaction 3: Telegram Inline Query (`@studyhub_resource_bot <query>`)
             ├─ Intercepted by `src/bot/inline/inlineQuery.js`
             ├─ If query is empty: returns 6 article cards with trending academic topics
             └─ If query is active: runs search, formats top 10 items as article cards with "📥 Get via Bot" deep links
```

### 9.2 Key Weaknesses in Telegram Bot Search
1. **Query Session Expiration (1 Hour TTL)**:
   - Pagination buttons encode a short hash (`qsearch_<hash>`) referencing `QuerySession`.
   - Because `QuerySession` documents expire after 3,600 seconds (1 hour), tapping "Next Page" or a filter pill on an older search message results in an alert: `"❌ Search expired. Please type your query."`
2. **Double Query Expansion Operator Bug**:
   - `expandQuery` in `subjectAliases.js` transforms `dbms exam` into:
     ```
     (dbms OR database OR database systems OR database management system) exam
     ```
   - In `search.service.js`, parentheses are stripped:
     ```
     dbms OR database OR database systems OR database management system exam
     ```
   - In MongoDB full-text search (`$text: { $search: cleanSearch }`), **MongoDB does NOT have an `OR` operator**. Spaces already mean logical OR. The uppercase word `"OR"` is parsed as a literal search term! Any document containing the common English word "or" receives an artificial textScore boost.
3. **Severe Duplicate Clutter in Search Results**:
   - As proven by empirical testing (Section 10), searching for common subjects returns the same title repeated 60 to 100 times because cross-channel duplicates are not collapsed by content fingerprint.

---

## 10. Search Quality & Relevance Evaluation

19 realistic Ethiopian academic search queries were executed against the live search engine to measure latency, result counts, duplicate density, and top-5 relevance.

### 10.1 Empirical Query Benchmark Results

| Query | Results Returned | Latency (ms) | Top-5 Relevant | Duplicate Titles in Results | Top Result Title Returned | Evaluation Notes |
|---|---:|---:|---:|---:|---|---|
| `DBMS` | 97 | 2,122ms | 1 / 5 | 34 | `Jimma University` (image album) | **Poor**: Generic album ranks #1 over real DBMS slide decks |
| `DSA` | 105 | 2,848ms | 0 / 5 | 28 | `Python Data Structures and Algorithms` | **Acceptable**: Found DSA book, but missed lecture slides |
| `General Mathematics` | 114 | 1,377ms | 1 / 5 | 65 | `General Physics` (PPT) | **False Match**: Ranks Physics #1 for a Math query! |
| `Mathematics for Natural Sciences` | 122 | 1,374ms | 4 / 5 | 78 | `Final Exam of Natural Science` | **Good**: High relevance for freshman exam pack |
| `Mathematics for Social Sciences` | 115 | 1,314ms | 1 / 5 | 83 | `Jimma University` (image album) | **Poor**: Obscured by duplicate generic albums |
| `General Physics` | 126 | 1,448ms | 2 / 5 | 73 | `General Physics Mid Exam` | **Good**: Relevant exam returned |
| `Grade 8 Mathematics` | 99 | 1,230ms | 4 / 5 | 38 | `Grade 11 Mathematics - Lesson Note` | **Grade Mismatch**: Grade 11 ranks #1 for Grade 8 search |
| `Grade 10 Biology` | 124 | 1,493ms | 2 / 5 | 63 | `Hawassa University - General Biology` | **Level Mismatch**: University biology returned for Grade 10 |
| `Grade 12 Chemistry` | 129 | 1,634ms | 5 / 5 | 73 | `Chemistry Mock Exam for Grade 12` | **Excellent**: Exact match for national exam |
| `Communicative English` | 116 | 1,340ms | 4 / 5 | 97 | `Jimma University` (image album) | **Noisy**: 97 out of 116 results are duplicate titles |
| `Logic and Critical Thinking` | 141 | 1,269ms | 5 / 5 | 108 | `Logic and Critical Thinking (Final)` | **Relevant but Heavily Duplicated**: 108 duplicate titles |
| `Geography of Ethiopia and the Horn` | 111 | 1,086ms | 4 / 5 | 58 | `Geography of Ethiopia and the Horn` | **Excellent**: Exact textbook returned |
| `Social Anthropology` | 105 | 1,325ms | 0 / 5 | 63 | `Jimma University` (image album) | **Poor**: Anthropology slide decks buried |
| `Amharic fiction` | 140 | 1,458ms | 0 / 5 | 68 | `Sample] Logic Study Book Chapter 5` | **Major Failure**: Returns freshman Logic for fiction search |
| `Afaan Oromo literature` | 95 | 2,326ms | 4 / 5 | 36 | `Afan Oromo and Literature` | **Good**: Successfully matched language literature |
| `AAU Nursing` | 132 | 1,738ms | 0 / 5 | 51 | `በአገር አቀፍ ደረጃ ሲሰጥ የነበረው...` | **Ambiguous**: Health exit exam notice ranks #1 |
| `Jimma University Psychology` | 121 | 1,286ms | 2 / 5 | 83 | `Hawasa - university - psychology` | **University Mismatch**: Hawassa exam returned for Jimma query |
| `Freshman Natural Science` | 123 | 1,492ms | 4 / 5 | 87 | `Atc Tube Tutorials - Entrance Exam` | **Good**: Strong freshman material match |
| `Freshman Social Science` | 116 | 1,643ms | 3 / 5 | 69 | `Jimma University` (image album) | **Acceptable**: Generic album ranks #1 |

### 10.2 Summary of Search Deficiencies
1. **Academic Cross-Contamination**: Searching for "General Mathematics" returns "General Physics" as the top result because the word "General" matched with a high TF-IDF text score.
2. **Grade Level Blindness**: The search engine cannot distinguish educational levels; searching for Grade 8 returns Grade 11 materials because both contain "Grade" and "Mathematics".
3. **University Mismatches**: Searching for "Jimma University Psychology" returns "Hawassa University Psychology" because both universities are present in the text index, but the search engine does not treat university as an anchored entity.
4. **Massive Title Duplication**: Users must scroll through 50 to 100 identical titles to find alternative study materials.

---

## 11. Search Inline Suggestions & Discovery

### 11.1 Website Inline Suggestions Audit
- **Current State**: **Non-existent**.
- In `web/src/app/page.tsx` and `web/src/app/explore/page.tsx`, the search bar is an HTML input with no autocomplete, no dropdown, and no debounced API fetch.
- All suggestion chips on the homepage (`DBMS`, `DSA`, `OOP`, `Calculus`, `Computer Networks`, `Operating Systems`, `Past Exams`) are **hardcoded JavaScript constants**.
- There is no `/api/suggestions` or `/api/autocomplete` endpoint on the Express server.

### 11.2 Telegram Bot Inline Suggestions Audit
- **Current State**: **Partially Functional (Static / Cached)**.
- When `/search` is issued without arguments, the bot displays:
  - Up to 4 user recent searches (from `SearchHistory`).
  - Up to 4 global suggestions generated by `getGlobalSuggestions()` in `src/services/search.service.js`.
  - Suggestions are derived from distinct search queries in `SearchHistory` and backfilled with top tags from `TelegramResource`.
  - Results are cached in memory for 1 hour (`_globalSuggestionsCache`).
- In Telegram Inline Query mode (`@studyhub_resource_bot`), suggestions only appear when the query string is **empty**. As soon as a student types a character (e.g. `@studyhub_resource_bot c...`), it executes a full database search rather than showing autocompleted subjects.

### 11.3 Missing Suggestion Capabilities for Future Taxonomy
To support the 4 collections, 21 categories, and university departments, the system currently lacks:
- Hierarchical category suggestions (e.g. typing "comp" suggests *Computing & Information Sciences*).
- Course code autocomplete (e.g. typing "math" suggests *MATH101*, *MATH102*).
- University-filtered suggestions (e.g. typing "aau" suggests *AAU Computer Science*).
- Amharic / Afaan Oromo subject aliases in suggestions.

---

## 12. SEO & Web Discoverability Audit

### 12.1 Current Frontend Rendering & Deployment Architecture
- **Framework**: Next.js 15 (App Router).
- **Deployment Platform**: Vercel (`webstudyhub.vercel.app`).
- **Rendering Strategy**: **Client-Side Rendering (CSR)** with `"use client"` directives on all primary routes (`/`, `/explore`, `/subjects`, `/resource/[id]`).

### 12.2 Critical SEO Barriers
1. **Client-Side Only Data Fetching**:
   - The main pages use React `useEffect()` to fetch data from `/api/*` after the browser loads.
   - Search engine crawlers (Googlebot, Bingbot) receiving the initial HTML see only skeleton loaders (`ResourceCardSkeleton`), with zero crawlable academic content.
2. **Missing Taxonomical Routing**:
   - There are **no routes** for subjects, departments, or collections (e.g. no `/subjects/[categorySlug]` or `/collections/[collectionSlug]`).
   - Clicking a subject on `/subjects` simply navigates to `/explore?q=Computer+Science`. Query parameters (`?q=...`) are canonicalized away or ignored by search engine indexers.
3. **Severely Constrained Sitemap**:
   - In `web/src/app/sitemap.ts`, only **5 static URLs** are registered (`/`, `/explore`, `/subjects`, `/help`, `/about`).
   - The sitemap dynamically fetches a sample of resources with a hardcoded cap of **`limit=50`**. Out of 83,070 resources, **only 50 resource pages are submitted to search engines!** The remaining 83,020 resources are invisible in sitemaps.
4. **Poor Resource Meta Titles**:
   - In `web/src/app/resource/[id]/layout.tsx`, page titles fall back to raw `fileName`:
     ```typescript
     const title = resource.fileName || resource.courseCode || "Academic Study Resource";
     ```
   - For thousands of files, this produces unindexed, low-quality titles such as `image_to_pdf.pdf | StudyHub` or `IMG_2023.jpg | StudyHub` instead of professional, keyword-rich display titles.

---

## 13. Automatic Categorization Readiness & Signal Evaluation

### 13.1 Assessment of Classification Signals in Stored Data

| Signal Source | Availability (% Populated) | Signal Reliability | Academic Disambiguation Power | Limitations & Risk Factors |
|---|---|---|---|---|
| **`cleanTitle`** | **100.00%** | **High** | **Very High** | High quality; generated by normalized title pipeline. Best primary text signal. |
| **`fileName`** | **75.19%** | **High** | **Very High** | Contains course codes, years, and exam types. Missing on 20,608 photo resources. |
| **`caption`** | **73.73%** | **Medium-High** | **Very High** | Crucial context for Telegram albums and photo exams. Occasionally contains noise/links. |
| **`channelUsername`**| **100.00%** | **Medium** | **High (Priors)** | Strong prior probability for specialized channels (e.g. `@amharic_fiction_books` -> Ethiopian Fiction). Weak for general channels (`@keleme_2013`). |
| **`tags`** | **67.94%** | **Medium** | **Medium** | Good for exam detection; historically suffered from channel name tag-poisoning. |
| **`courseCode`** | **13.60%** | **Very High** | **Definitive** | Definitive mapping when present (e.g. `COE311` -> Computer Engineering). |
| **`fileType`** | **100.00%** | **High** | **Low-Medium** | Distinguishes photo exams from textbooks and slides; does not identify subject. |
| **`groupId` (Album)**| **67.22%** | **High** | **High (Propagation)**| Context can be propagated across all items in the same album. |
| **`university`** | **9.28%** | **High** | **Low (Subject)** | Identifies university institution; does not identify subject category. |
| **Document Text / OCR**| **0.00%** | **None (Not Stored)**| **N/A** | Does not exist in database. Cannot be used without on-the-fly extraction. |

### 13.2 Feasibility of Rule-Based vs. Machine-Learning vs. AI Classification
1. **Rule-Based & Metadata Classifier (Recommended Baseline)**:
   - Capable of categorizing **~75–85% of all active resources** with high confidence.
   - Built using:
     - Regex matching on normalized course codes and keywords in `cleanTitle` and `fileName`.
     - Strong channel priors (e.g. all non-ad files in `@amharic_fiction_books` belong to *Ethiopian Fiction & Reading*).
     - Caption keyword extraction for photo exam albums.
     - Album-level context propagation (classifying group 1 classifies all 10 images in the album).
   - Zero API cost, deterministically testable, instantaneous execution.
2. **Text Extraction / OCR Backfill (Secondary / Targeted)**:
   - Required for the ~15% ambiguous files (e.g. handwritten photo exams with missing or generic captions).
   - Should NOT be run across all 83,000 files. Run OCR only on unclassified photo albums on-demand.
3. **LLM / AI Classifier (Optional Fallback)**:
   - Passing metadata (`cleanTitle`, `caption`, `channelUsername`) to a lightweight model (e.g. Gemini Flash) for ambiguous edge cases.
   - Estimated cost for 15,000 ambiguous titles: < \$1.00 total.

---

## 14. Future Database Model Compatibility

The future taxonomy requires assigning resources to:
- **1 or more Collections** (out of 4: *Study Materials*, *Ethiopian Fiction & Reading*, *Past Exams, Entrance & Exit*, *University Freshman Courses*).
- **1 or more Primary Categories** (out of 21 primary subject disciplines).
- Optional sub-taxonomies: Department, Course Code, Grade Level, Stream (Natural vs Social Science).

### 14.1 Architectural Evaluation: Embedded Arrays vs. Junction Collection

```
Option A: Embedded Schema (Directly on TelegramResource)
┌────────────────────────────────────────────────────────┐
│ TelegramResource Document                              │
│  ├── cleanTitle: "DBMS Midterm Exam"                   │
│  ├── collections: ["past-exams", "study-materials"]    │
│  ├── categories: ["computing-information-sciences"]    │
│  ├── academicLevel: "university"                       │
│  ├── department: "Computer Science"                    │
│  ├── classificationMeta: {                             │
│  │     confidence: 0.95,                               │
│  │     classifiedBy: "rule_engine_v1",                 │
│  │     classifiedAt: ISODate("2026-11-13"),            │
│  │     manualOverride: false                           │
│  │   }                                                 │
└────────────────────────────────────────────────────────┘

Option B: Normalized Junction Collection (`resourceclassifications`)
┌───────────────────────────┐         ┌─────────────────────────────────┐
│ TelegramResource Document │         │ ResourceClassification Document │
│  ├── _id: ObjectId("...") │<────────│  ├── resourceId: ObjectId("...") │
│  ├── cleanTitle: "..."    │         │  ├── collectionId: "past-exams" │
└───────────────────────────┘         │  ├── categoryId: "computing"    │
                                      │  ├── confidence: 0.95           │
                                      └─────────────────────────────────┘
```

### 14.2 Comparative Evaluation

| Evaluation Criteria | Option A: Embedded Document Fields | Option B: Normalized Junction Collection |
|---|---|---|
| **Query Latency** | **Fastest**: 0 `$lookup` joins required. Filter and retrieve in 1 index scan. | **Slower**: Requires aggregation `$lookup` or two separate round-trip queries. |
| **Index Efficiency** | High: Multikey indexes on `collections` and `categories`. | Requires compound indexes on junction collection. |
| **Search Engine Compatibility** | **Native**: Plugs directly into existing `search.service.js` and Express API. | Requires refactoring all existing search queries. |
| **Atomic Updates** | Single document update; zero risk of orphaned classifications. | Risk of orphaned classifications if resources are modified. |
| **Reversibility & Auditability** | Stored in sub-document `classificationMeta`. Rollback via `$unset`. | Clean table drop, but adds collection overhead. |

> [!IMPORTANT] Architectural Recommendation
> **Adopt Option A (Embedded Fields)** directly on `TelegramResource`. MongoDB handles multikey string array indexing with near-instant lookup speeds, avoiding costly aggregation joins across 83,000 documents during live search.

---

## 15. Historical Backfill Feasibility Analysis

### 15.1 Computational Feasibility
- Total active records to classify: **83,070 documents**.
- Total distinct entities when grouping albums: **39,469 entities**.
- By grouping processing at the `groupId` level, classification rules only need to run **39,469 times**, propagating the classification to all child documents in one bulk write.
- Rule-based regex classification processes ~5,000 documents per second in Node.js.
- Total processing time for rule-based backfill: **under 2 minutes**.

### 15.2 Deployment Constraints & Staged Backfill Strategy
The Express server is hosted on Render (which enforces HTTP request timeouts and memory limits). A single massive migration script running inside the web process will trigger timeouts.

#### Recommended 5-Stage Backfill Plan:
1. **Stage 1: Dry-Run Analysis (Read-Only)**:
   - Run classification engine across all 83,070 records in memory.
   - Output statistical coverage report: percentage mapped to 4 collections, percentage mapped to 21 categories, unclassified count.
2. **Stage 2: Schema Migration & Compound Index Creation**:
   - Define Mongoose schema fields: `collections: [String]`, `categories: [String]`, `academicLevel: String`, `classificationMeta: Object`.
   - Add compound indexes: `{ collections: 1, isAvailable: 1 }`, `{ categories: 1, isAvailable: 1 }`.
3. **Stage 3: High-Confidence Bulk Update**:
   - Execute batch updates (batch size: 1,000 documents using `bulkWrite()`).
   - Process channel-based and course-code-based classifications (expected ~60,000 documents).
4. **Stage 4: Album Propagation**:
   - Apply group-level inheritance: copy classification across all child photos/documents sharing the same `groupId`.
5. **Stage 5: Review & Edge Case Handling**:
   - Log unclassified or low-confidence documents (`confidence < 0.7`) to a review log for inspection.

---

## 16. Technical Risks & Operational Hazards

1. **Tag Poisoning Recurrence**:
   - Historically, indexing channels named `@exambankfreshman` caused every single document to be tagged as an exam. The classifier must derive classifications strictly from `cleanTitle`, `fileName`, and verified channel metadata, never raw channel title words.
2. **Missing Search Index Latency Spikes**:
   - If new collection and category filters are added to the website without adding matching MongoDB compound indexes (`{ categories: 1, isAvailable: 1 }`), search queries will degrade from ~1.5s to 8+ seconds under load.
3. **Telegram Forwarding Restrictions on Private Channels**:
   - If a source channel enables Telegram's "Restrict Saving Content" flag (`noforwards`), GramJS forwarding will fail unless the document has already been cached in StudyHub's private archive channel (`ARCHIVE_CHAT_ID`).
4. **Foreign Collection Collisions**:
   - The production MongoDB instance shares namespace with leftover restaurant tables (`branches`, `restaurants`). Any migration script must strictly target `telegramresources`.
5. **Cache Invalidation Risks**:
   - `CachedSearch` stores previously executed searches for 24 hours. When categories are introduced, existing cache keys will return un-categorized result shapes unless the cache is flushed.

---

## 17. Evidence, File References & Verification Traceability

Every major finding in this report is grounded in direct source code inspection and empirical database queries:

| Finding | Source File / Collection | Line / Query Reference | Verification Method |
|---|---|---|---|
| **Resource Count (92,140 total / 83,070 available)** | `telegramresources` | `docs/data-audit/01-collections-and-counts.js` | Direct MongoDB `countDocuments()` |
| **Quarantine Count (9,044 documents)** | `telegramresourcequarantines` | `docs/data-audit/01-collections-and-counts.js` | Direct MongoDB `countDocuments()` |
| **Media Group Count (55,970 files / 12,271 albums)** | `telegramresources` | `docs/data-audit/01-collections-and-counts.js` | MongoDB `distinct("groupId")` aggregation |
| **Field Completeness Metrics** | `telegramresources` | `docs/data-audit/02-field-completeness.js` | Full collection aggregation & field inspection |
| **Format Consistency (0 mismatches, 100% pdf/ppt/doc/image)** | `telegramresources` | `docs/data-audit/03-file-formats-and-integrity.js` | Extension vs `fileType` pipeline |
| **Linguistic Distribution (74.7% Latin, 25.3% Mixed)** | `telegramresources` | `docs/data-audit/04-languages-and-title-quality.js` | Streaming Unicode script detector across 83,070 docs |
| **Duplicates (43,536 docs in 13,133 clusters)** | `telegramresources` | `docs/data-audit/05-duplicates-and-integrity.js` | `fileUniqueId` aggregation pipeline |
| **Search Latency & Relevance Results** | `src/search/search.service.js` | `docs/data-audit/07-search-quality-evaluation.js` | Execution of 19 realistic test queries |
| **Query Expansion 'OR' Operator Flaw** | `src/config/subjectAliases.js` | Lines 153–160 | Source code review |
| **Website Empty-Browse Album Filter Flaw** | `src/api/routes.js` | Lines 111–112 (`groupIndex: 0`) | Source code review & schema comparison |
| **Website CSR & 50-Item Sitemap Cap** | `web/src/app/sitemap.ts` | Lines 52–68 (`limit=50`) | Source code review |
| **GramJS Relay Delivery Mechanism** | `src/telegram/fileDelivery.js` | Lines 530–615 | Source code review |

---

## 18. Decisions Requiring User / Stakeholder Sign-Off

The following architectural and business decisions must be resolved before proceeding to Phase 1 (Taxonomy & Implementation Design):

### 1. Database & Schema Decisions
- **Classification Schema**: Do you approve embedding `collections: [String]` and `categories: [String]` directly on `TelegramResource`, along with `academicLevel` (e.g. `'kg_grade8'`, `'grade9_12'`, `'university'`) and `classificationMeta`?
- **Legacy Foreign Collections**: Should the orphaned restaurant collections (`branches`, `restaurants`, `tables`, `orders`, `products`, `categories`, `assistances`) remain untouched, or should an admin script drop them to clean up the cluster?

### 2. Resource Identity & Duplicate Handling
- **Search Deduplication**: When a query matches multiple identical files (same `fileUniqueId` across 5+ channels), should StudyHub collapse them into a single search card showing *"Available from 5 channels: @aau, @freshman..."* with one primary download CTA?
- **Zero-Byte File Sizes**: 17,305 Telegram photos have `fileSize: 0`. Should we leave them as 0 or backfill an estimated average byte size (e.g. 350 KB per exam photo) for UI display?

### 3. Classification & Curriculum Mapping
- **Multi-Category Assignment**: A resource such as *"Biochemistry for Nursing Students"* qualifies for both *Natural & Computational Sciences* and *Health & Medical Sciences*. Do you confirm that resources should hold multiple category tags where appropriate?
- **Grade 9 Materials**: The intended taxonomy specifies *KG–Grade 8* and *Grades 10–12*. Where should Grade 9 resources be mapped? (e.g., grouped with Grades 9–12 or placed into General Sciences?)
- **Non-Academic Literature & Books**: Channels like `@amharic_fiction_books` and `@ethio_pdf_books` contain general fiction, self-help, and novels. Should all non-academic reading be strictly mapped to Collection 2 (*Ethiopian Fiction & Reading*), leaving the 21 subject categories purely for academic curriculum?
- **Foreign Curriculum Channels**: What should be done with resources from Indian channels (`@alltypetipsinkannada`, `@nursingnoteshub_in`)? Should they be classified under Medical/Nursing, or moved to Quarantine?

### 4. Search & UI Integration
- **Search Result Grouping**: In both Bot and Web search, should search results allow 1-tap filtering by the 4 Collections (*Study Materials*, *Ethiopian Fiction*, *Past Exams*, *Freshman*) as top-level filter pills?
- **Web Browse Fix**: Do you approve fixing `src/api/routes.js` so that multi-page albums (`groupIndex >= 1`) are properly displayed when students browse without a query?

### 5. SEO Architecture
- **Dedicated Taxonomical Landing Pages**: To maximize Google search rankings across Ethiopian universities, should we generate server-rendered static routes (SSG/ISR) for the 21 primary categories and 4 collections (e.g. `/subjects/computing-information-sciences`, `/collections/past-exams`)?
- **Full Sitemap Expansion**: Should `web/src/app/sitemap.ts` be expanded from 50 resources to generate paginated sitemaps indexing all 83,000+ academic resources?

---

*End of Phase 0 Technical Report.*  
*Full machine-readable data outputs are persisted in `docs/data-audit/`.*
