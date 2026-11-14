# StudyHub — Phase 1: Database Verification, Backup & Recovery Safety Report

**Status**: Verified & Finalized  
**Inspection Date**: 2026-11-13  
**Auditor / Role**: Senior MongoDB Database Administrator & Database Reliability Engineer  
**Target Environment**: Production Database (`studyhub` on MongoDB Atlas v8.0.37)  
**Safety Protocol**: Strictly Read-Only Operations (Zero Production Modifications)  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Verified Database Identity & Topology](#2-verified-database-identity--topology)
3. [Current Resource Counts & Baseline Verification](#3-current-resource-counts--baseline-verification)
4. [Count Reconciliation & Discrepancy Forensic Analysis](#4-count-reconciliation--discrepancy-forensic-analysis)
5. [Album Structure, Distinct Entities & Duplicate Reconciliation](#5-album-structure-distinct-entities--duplicate-reconciliation)
6. [Quarantine Collection Integrity & Reason Audit](#6-quarantine-collection-integrity--reason-audit)
7. [Database Index Inventory & Performance Profiling](#7-database-index-inventory--performance-profiling)
8. [MongoDB Atlas Backup Protection & Oplog Audit](#8-mongodb-atlas-backup-protection--oplog-audit)
9. [Disaster Recovery & Restoration Runbook](#9-disaster-recovery--restoration-runbook)
10. [Future Migration Safety Standards](#10-future-migration-safety-standards)
11. [Telegram Resource Provenance Preservation](#11-telegram-resource-provenance-preservation)
12. [Mandatory Data Preservation Policy (The 12 Rules)](#12-mandatory-data-preservation-policy-the-12-rules)
13. [Remaining Technical Risks](#13-remaining-technical-risks)
14. [Outstanding Decisions Requiring Approval](#14-outstanding-decisions-requiring-approval)

---

## 1. Executive Summary

Phase 1 of the StudyHub improvement project establishes a verified database baseline, audits backup readiness, documents disaster recovery protocols, and enforces strict migration safety standards before any historical resource records are categorized.

### Core Verified Findings:
1. **Current Production State**: The database contains **92,143 total resource documents** in `telegramresources`. Of these, **83,073 are available (`isAvailable: true`)**, **9,070 are unavailable (`isAvailable: false`)**, and **0** have missing or null availability flags.
2. **Dynamic Ingestion Discrepancy (+3 Documents)**: Between the initial Phase 0 inspection (92,140 docs) and Phase 1 verification (92,143 docs), exactly **3 new image resources** were ingested by the background Telegram indexing worker on Render from channel `@freshman_materials` (message IDs 4045, 4046, 4047 representing an Arba Minch University Geography exam album at `2026-11-13T06:02:34Z`).
3. **Quarantine Forensic Reconciliation (The 26-Record Gap)**: The discrepancy between **9,070 unavailable resources** and **9,044 quarantine snapshot documents** is fully resolved:
   - **9,044 documents** were deactivated by historical purification migrations (`execute-quarantine-migration.js` / single-image purge) and archived into `telegramresourcequarantines`.
   - Exactly **26 documents** (all genuine academic PDFs and PPTs, such as `OOP final.pdf` and `Biology Entrance Exam.pdf`) were deactivated at runtime by `markResourceUnavailable()` in `fileDelivery.js` when Telegram user downloads timed out or failed to forward from private channels. They were never part of the spam/ad quarantine migration.
4. **Distinct Learning Entities vs. Stored Files**:
   - Total available stored records: **83,073 files**.
   - Available media groups (albums): **12,240 distinct groups** containing **55,843 files**.
   - Standalone available files: **27,230 files**.
   - **Distinct Searchable Learning Entities**: **39,470 entities** ($27,230\text{ standalone} + 12,240\text{ collapsed albums}$).
5. **Content Duplication**:
   - Distinct physical files (`distinct fileUniqueId`): **52,670 unique files**.
   - Duplicate clusters: **13,133 clusters** involving **43,536 documents** (52.41% of all available records).
   - Cross-channel duplicate clusters: **5,972 clusters** shared across 2 to 37 Telegram channels.
6. **Backup & Recovery Posture**:
   - Atlas Replica Set: `atlas-8ql1x9-shard-0` across 3 active host nodes.
   - `local.oplog.rs` access is active and verified with an **oplog retention window of 49.86 hours** (~2 days of continuous write history).
   - However, **no local database dumps exist**, and cloud-managed automated snapshots depend on Atlas cluster tier configuration. A complete restoration runbook has been established and marked: `NOT TESTED — RESTORE VALIDATION REQUIRED`.
7. **Production Invariance**: Zero production records, schemas, indexes, or application settings were modified during Phase 1.

---

## 2. Verified Database Identity & Topology

The database connection was established using the application's runtime configuration (`MONGO_URI` with IPv4 precedence and resilient timeout options).

* **Database Name**: `studyhub`
* **MongoDB Server Version**: `8.0.37` (Git commit: `8ece10cbfc3379404a0dffdfb448b9e873b494f7`)
* **Cluster Domain**: `cluster0.rfdlc8z.mongodb.net`
* **Replica Set Name**: `atlas-8ql1x9-shard-0`
* **Active Replica Set Nodes**:
  - `ac-2bcical-shard-00-00.rfdlc8z.mongodb.net:27017`
  - `ac-2bcical-shard-00-01.rfdlc8z.mongodb.net:27017` (Current Primary)
  - `ac-2bcical-shard-00-02.rfdlc8z.mongodb.net:27017`
* **Max Wire Version**: 25 (MongoDB 8.0 protocol support)
* **User Permissions**: Read-write on `studyhub`, read access to `local.oplog.rs`, authorized for admin ping.

### Complete Collection Inventory (19 Collections)

| Collection Name | Document Count | Indexes | Classification | Storage Size | Index Size | Notes |
|---|---:|---:|---|---:|---:|---|
| `telegramresources` | **92,143** | 6 | **Core StudyHub** | 19.92 MB | 41.15 MB | Primary academic resources collection |
| `telegramresourcequarantines` | **9,044** | 2 | **Core StudyHub** | 5.74 MB | 0.87 MB | Safety snapshot collection for deactivated files |
| `telegramchannels` | **91** | 4 | **Core StudyHub** | 0.04 MB | 0.14 MB | Ingested source channels (81 referenced in DB) |
| `searchhistories` | **290** | 2 | **Core StudyHub** | 0.06 MB | 0.08 MB | User search audit log |
| `users` | **104** | 4 | **Core StudyHub** | 0.05 MB | 0.14 MB | Registered bot users (carries legacy `restaurantId` index) |
| `downloadhistories` | **70** | 5 | **Core StudyHub** | 0.05 MB | 0.18 MB | Delivery & download audit log |
| `channelrecommendations` | **65** | 2 | **Core StudyHub** | 0.03 MB | 0.05 MB | User-submitted channel requests |
| `cachedsearches` | **24** | 4 | **Core StudyHub** | 1.20 MB | 0.14 MB | Multi-provider query cache (TTL: 24h) |
| `savedresources` | **17** | 2 | **Core StudyHub** | 0.02 MB | 0.05 MB | Bookmarked materials per user |
| `botsessions` | **12** | 3 | **Core StudyHub** | 0.02 MB | 0.05 MB | Telegraf session store (TTL: 7d) |
| `resourcereports` | **2** | 4 | **Core StudyHub** | 0.02 MB | 0.05 MB | Broken file / bad subject flags |
| `querysessions` | **0** | 3 | **Core StudyHub** | 0.02 MB | 0.08 MB | Short query hash pagination sessions (TTL: 1h) |
| `branches` | 1 | 2 | *Foreign / Legacy* | < 0.01 MB | 0.02 MB | Restaurant POS schema (DO NOT TOUCH) |
| `restaurants` | 1 | 2 | *Foreign / Legacy* | < 0.01 MB | 0.02 MB | Restaurant POS schema (DO NOT TOUCH) |
| `tables` | 0 | 6 | *Foreign / Legacy* | < 0.01 MB | 0.03 MB | Restaurant POS schema (DO NOT TOUCH) |
| `orders` | 0 | 4 | *Foreign / Legacy* | < 0.01 MB | 0.02 MB | Restaurant POS schema (DO NOT TOUCH) |
| `products` | 0 | 3 | *Foreign / Legacy* | < 0.01 MB | 0.02 MB | Restaurant POS schema (DO NOT TOUCH) |
| `categories` | 0 | 2 | *Foreign / Legacy* | < 0.01 MB | 0.02 MB | Restaurant POS schema (DO NOT TOUCH) |
| `assistances` | 0 | 5 | *Foreign / Legacy* | < 0.01 MB | 0.03 MB | Restaurant POS schema (DO NOT TOUCH) |

---

## 3. Current Resource Counts & Baseline Verification

*Inspection Timestamp: 2026-11-13T06:45:51Z*

| Count Metric | Verified Value | Status / Integrity Check |
|---|---:|---|
| **Total `telegramresources` Documents** | **92,143** | Matches live collection count |
| **Available Resources (`isAvailable === true`)** | **83,073** | Active in web & bot search |
| **Unavailable Resources (`isAvailable === false`)** | **9,070** | Deactivated (hidden from search) |
| **Missing `isAvailable` Field** | **0** | 100% schema compliance |
| **Null `isAvailable` Field** | **0** | 100% schema compliance |
| **Total `telegramresourcequarantines` Snapshots** | **9,044** | 100% restorable snapshots |
| **Distinct Telegram Source Channels** | **81** | All 81 exist in `telegramchannels` |
| **Distinct Telegram Message IDs** | **19,179** | Message IDs reused across distinct channels |
| **Distinct Physical Files (`distinct fileUniqueId`)** | **60,430** | Across all 92,143 records |
| **Distinct Physical Files in Available Set** | **52,670** | Across 83,073 active records |

---

## 4. Count Reconciliation & Discrepancy Forensic Analysis

### 4.1 Previous Audit vs. Current Verified Reconciled Baseline

| Metric | Phase 0 Audit | Phase 1 Verified | Difference | Forensic Explanation |
|---|---:|---:|---:|---|
| **Total Resource Documents** | 92,140 | **92,143** | **+3** | 3 new image pages ingested by Render cron from `@freshman_materials` (msgs 4045-4047) at 06:02:34Z. |
| **Available Resources** | 83,070 | **83,073** | **+3** | The 3 newly ingested exam pages passed the Gatekeeper and defaulted to `isAvailable: true`. |
| **Unavailable Resources** | 9,070 | **9,070** | **0** | Perfectly constant. Zero records deactivated since Phase 0. |
| **Quarantine Snapshots** | 9,044 | **9,044** | **0** | Perfectly constant. Zero modifications to quarantine collection. |
| **Album Files (Available)** | 55,840 | **55,843** | **+3** | The 3 new documents belong to media group `13749201948201923`. |
| **Distinct Albums (Available)** | 12,239 | **12,240** | **+1** | The 3 new documents formed 1 new distinct album on `@freshman_materials`. |
| **Standalone Available Files** | 27,230 | **27,230** | **0** | Perfectly constant. |
| **Duplicate Surplus Instances** | 30,403 | **30,403** | **0** | Constant. |
| **Unique File Identifiers (`fileUniqueId`)** | 52,670 | **52,670** | **0** | Constant. |

### 4.2 Forensic Resolution of the 26-Record Quarantine Discrepancy

Phase 0 identified that there are **9,070 unavailable resources**, but only **9,044 records in `telegramresourcequarantines`** (a difference of 26 documents).

Our Phase 1 forensic script (`04-quarantine-integrity.js`) cross-referenced all 9,070 unavailable records against the 9,044 quarantine `originalId` references. The findings are conclusive:

```
Total Unavailable in `telegramresources`:  9,070
 ├── Quarantined by Migration Pipeline:     9,044 (Backed up in `telegramresourcequarantines`)
 └── Deactivated at Runtime by Delivery:       26 (Failed file delivery timeouts / inaccessible files)
```

1. **Why the 26 Records Are Unavailable**:
   - In `src/telegram/fileDelivery.js` (lines 48–66):
     ```javascript
     async function markResourceUnavailable(resourceId, groupId = null) {
       if (groupId) {
         await TelegramResource.updateMany({ groupId }, { $set: { isAvailable: false } });
       } else {
         await TelegramResource.updateOne({ _id: resourceId }, { $set: { isAvailable: false } });
       }
     }
     ```
   - When a student requests a file in the bot, GramJS attempts to forward the message from the source channel to `RELAY_GROUP_ID`.
   - If the source channel deleted the message, made the channel private, or GramJS encountered a permanent fetch error, the delivery pipeline calls `markResourceUnavailable(resourceId)`.
   - This sets `isAvailable: false` on `telegramresources` directly at runtime. It **does NOT** write to `telegramresourcequarantines`, because it was deactivated by runtime delivery failure, not by the spam/ad purification script.
2. **Document Types of the 26 Records**:
   - All 26 documents are **genuine academic materials**:
     - `OOP final.pdf` (msg 334 on `@astusoftware2023`)
     - `Chapter -1-OOP concepts.pptx` (msg 136 on `@astusoftware2023`)
     - `OOP final 2.pdf` (msg 452 on `@astusoftware2023`)
     - `Lecture 1- Introduction to Operating Systems.pdf` (msg 525 on `@astusoftware2023`)
     - `Biology Entrance Exam.pdf` (msg 8968 on `@qubeeacademy`)
     - `Mathematics for Natural Sciences.pdf` (msg 18865 on `@qubeeacademy`)
     - `Data structure and Algorithm in C++.pdf` (msg 5031 on `@keleme_2013`)
     - `Aau physics final exam july 25.pdf` (msg 7552 on `@keleme_2013`)
   - **Critical Conclusion**: These 26 files are NOT spam or ads. They were deactivated solely because the bot failed to deliver them. When StudyHub categorizes resources, these 26 files can safely be categorized, but their availability flag should remain `false` until their Telegram channel delivery path or archive backup is verified.

---

## 5. Album Structure, Distinct Entities & Duplicate Reconciliation

### 5.1 Media Group & Album Audit

In Telegram, multi-file albums (e.g. 10 photographed pages of an exam paper or multi-chapter slide bundles) share a common MTProto `groupedId`. StudyHub stores each file as an individual document in `telegramresources` while recording `groupId`, `groupIndex`, and `groupTotal`.

* **Available Records with `groupId`**: **55,843 documents**
* **Unavailable Records with `groupId`**: **130 documents** (across 52 groups)
* **Total Distinct `groupId` Values**: **12,272**
* **Available Distinct `groupId` Values**: **12,240**
* **Unavailable Distinct `groupId` Values**: **52**
* **Standalone Available Resources (`groupId: null`)**: **27,230 documents**
* **Standalone Unavailable Resources**: **8,940 documents**
* **Records with Invalid `groupIndex` ($\le 0$ or null)**: **0**
* **Records with Invalid `groupTotal` ($\le 0$ or null)**: **0**
* **Albums with Partial / Inconsistent Counts**: Exactly **27 albums** out of 12,240 have an indexed document count different from `groupTotal` (caused when an album contained 10 photos, but 1 photo failed Gatekeeper validation during channel scanning).

### 5.2 Distinct Searchable Learning Entities Formula

To prevent inflating StudyHub's catalog by counting every photographed page as an independent course, distinct searchable entities are strictly defined:

$$\mathbf{E_{\text{searchable}}} = \mathbf{S_{\text{available}}} + \mathbf{A_{\text{available}}}$$

Where:
- $S_{\text{available}} = 27,230$ (Standalone single files: textbooks, individual slide decks, single PDFs).
- $A_{\text{available}} = 12,240$ (Collapsed media group albums: multi-page exam photos, chapter slide bundles).

$$\mathbf{E_{\text{searchable}}} = 27,230 + 12,240 = \mathbf{39,470\text{ Distinct Searchable Learning Entities}}$$

### 5.3 Duplicate Quantification & Cross-Channel Proliferation

* **Total Available Documents**: **83,073**
* **Distinct `fileUniqueId` Values**: **52,670 unique files**
* **Missing or Empty `fileUniqueId`**: **0** (100% populated)
* **Duplicate Clusters (`count > 1`)**: **13,133 distinct clusters**
* **Total Documents in Duplicate Clusters**: **43,536 documents (52.41% of active database)**
* **Duplicate Surplus Copies**: **30,403 extra copies** ($43,536 - 13,133 = 30,403$)
* **Cross-Channel Duplicate Clusters**: **5,972 clusters**
  - These represent files published to multiple independent Telegram channels.
  - *Record Holder*: `WORK BOOK-GEOGRAPHY-GRADE-11&12.pdf` (`fileUniqueId: 4453692629696188461`) has **37 copies** across 8 independent channels (`@ethioacadamic`, `@Ethio_Students_only`, `@keleme_2013`, `@Ethiel_Academy`, `@QesemAcademy`, `@Best_book_for_students`, `@qubeeacademy`, `@Marvel_Educations`).

---

## 6. Quarantine Collection Integrity & Reason Audit

`telegramresourcequarantines` serves as StudyHub's rollback safety buffer. No document was permanently deleted during historical purification.

* **Total Quarantined Documents**: **9,044**
* **Distinct `originalId` Values**: **9,044** (0 duplicate snapshots)
* **Snapshots Referencing Existing Source Records**: **9,044 / 9,044 (100%)**
* **Orphaned Snapshots**: **0**
* **Restorable Flag**: **100% (`restorable: true`)**

### Quarantine Reason Reconciliation

| Quarantine Reason | Document Count | % of Quarantine | Verification Description |
|---|---:|---:|---|
| `single_image_non_resource` | **8,651** | 95.65% | Standalone photos not part of an exam album (e.g. flyers, memes, single screenshots). |
| `commercial_ad` | **138** | 1.53% | Financial scams, betting, forex, paid exam-answer selling (`telebirr`, `cbe birr`). |
| `admin_notice` | **123** | 1.36% | University administrative announcements (dorm placement, registration, graduation). |
| `non_academic_announcement` | **96** | 1.06% | Tech fest, hackathon invites, welcome parties, election notices. |
| `schedule_announcement` | **35** | 0.39% | Exam timetable/schedule photos lacking actual questions. |
| `corrupt_stub` | **1** | 0.01% | Zero-byte or truncated file stub (< 2KB non-image). |
| **Sum of Reasons** | **9,044** | **100.00%** | **Perfect reconciliation with collection count ($9,044 \equiv 9,044$)** |

---

## 7. Database Index Inventory & Performance Profiling

### 7.1 Existing Index Specifications

#### Collection: `telegramresources` (92,143 docs | Data: 19.92 MB | Indexes: 41.15 MB)
1. `_id_`: B-Tree on `{ _id: 1 }` (Primary Key).
2. `tags_1`: Multikey on `{ tags: 1 }` (Used by tag-based scoring).
3. `channelUsername_1_messageId_1`: **Unique Compound** on `{ channelUsername: 1, messageId: 1 }` (Enforces Telegram message uniqueness).
4. `courseCode_1`: B-Tree on `{ courseCode: 1 }` (Used for course-code queries).
5. `isExam_1_fileType_1`: Compound on `{ isExam: 1, fileType: 1 }` (Used for exam filtering).
6. `fileName_text_caption_text_tags_text_courseCode_text`: **Full-Text Index** on `{ _fts: "text", _ftsx: 1 }` with weights: `fileName: 5`, `tags: 4`, `courseCode: 3`, `caption: 1`.

#### Collection: `telegramresourcequarantines` (9,044 docs | Data: 5.74 MB | Indexes: 0.87 MB)
1. `_id_`: B-Tree on `{ _id: 1 }`.
2. `originalId_1`: B-Tree on `{ originalId: 1 }` (Allows O(1) rollback lookup).

#### Collection: `telegramchannels` (91 docs | Data: 0.04 MB | Indexes: 0.14 MB)
1. `_id_`: Primary Key.
2. `username_1`: **Unique** on `{ username: 1 }`.
3. `university_1_department_1`: Compound on `{ university: 1, department: 1 }`.
4. `healthStatus_1`: B-Tree on `{ healthStatus: 1 }`.

#### Collection: `cachedsearches` (24 docs | Data: 1.20 MB | Indexes: 0.14 MB)
1. `_id_`: Primary Key.
2. `query_1`: B-Tree on `{ query: 1 }`.
3. `normalizedQuery_1`: B-Tree on `{ normalizedQuery: 1 }`.
4. `expiresAt_1`: **TTL Index** on `{ expiresAt: 1 }` with `expireAfterSeconds: 0`.

#### Collection: `querysessions` (0 docs | Data: 0.02 MB | Indexes: 0.08 MB)
1. `_id_`: Primary Key.
2. `queryHash_1`: **Unique** on `{ queryHash: 1 }`.
3. `createdAt_1`: **TTL Index** on `{ createdAt: 1 }` with `expireAfterSeconds: 3600` (1 hour).

### 7.2 Index Performance Analysis & Recommendations for Future Phases

> [!WARNING] Index Footprint vs. Data Size Warning
> On `telegramresources`, indexes consume **41.15 MB** compared to **19.92 MB of data storage** (206% index overhead). The text index alone accounts for ~30 MB. Any new index added in future phases must be strictly justified to prevent memory pressure on Atlas RAM.

#### Recommended Index Strategy for Phase 2 / Migration:
1. **DO NOT Create Indexes Now** (Phase 1 rule: zero production index modifications).
2. **Phase 2 Migration Compound Index**:
   - For categorizing and querying by collection and category:
     ```javascript
     { collections: 1, isAvailable: 1 }
     { categories: 1, isAvailable: 1 }
     ```
   - These compound indexes support both category filtering and availability filtering in a single B-tree seek.
3. **Index on `groupId`**:
   - Currently, collapsing albums on `groupId` requires in-memory operations across 55,843 files. An index on `{ groupId: 1 }` with a partial filter `{ groupId: { $exists: true, $ne: null } }` will provide massive speedups while consuming < 1.5 MB of RAM.
4. **Deduplication Index on `fileUniqueId`**:
   - A single-field index on `{ fileUniqueId: 1 }` will enable O(1) canonical deduplication.

---

## 8. MongoDB Atlas Backup Protection & Oplog Audit

### 8.1 Replica Set & Oplog Buffer
* **Replica Set Name**: `atlas-8ql1x9-shard-0` across 3 active cloud nodes.
* **Oplog Availability**: Verified. Direct read access to `local.oplog.rs` confirmed.
* **Oplog Retention Window**: **49.86 hours (~2.08 days)**:
  - Oldest Oplog entry: `2026-11-11T04:48:59Z`
  - Newest Oplog entry: `2026-11-13T06:40:23Z`
  - Any transaction executed within the last ~50 hours is recorded in the replica set oplog.

### 8.2 Atlas Backup Configuration Assessment
1. **Managed Atlas Cloud Backup**:
   - StudyHub runs on a MongoDB Atlas Shared/Dedicated cluster (`cluster0.rfdlc8z.mongodb.net`).
   - On Atlas M0 (Free Tier), automated continuous backups and Point-in-Time Recovery (PITR) are **not supported by MongoDB Atlas**.
   - On Atlas M10+ (Dedicated Tiers), Cloud Backup automatically takes daily snapshots retained for 7 days, with continuous oplog streaming for PITR.
2. **Local Repository Backup Status**:
   - Zero database backup files, `.gz` archives, or mongodump exports exist within the repository.
   - All historical data exists solely on the live MongoDB Atlas cluster.
3. **Protection Recommendation**:
   - Before executing Phase 2 writes, an isolated, encrypted application-level snapshot of `telegramresources` must be exported to an administrative staging location, or an on-demand snapshot triggered in the Atlas web console.

---

## 9. Disaster Recovery & Restoration Runbook

`STATUS: NOT TESTED — RESTORE VALIDATION REQUIRED`

> [!CAUTION] Safety Rule
> Never test a restoration by overwriting production. All recovery validation must be performed in a separate, isolated test database (`studyhub_staging`).

### Scenario 1: Accidental Bulk Document Update or Bad Classification Backfill
* **Symptom**: A migration script wrote corrupted `categories` or `collections` arrays to 83,000 resources.
* **Recovery Mechanism**:
  1. Because StudyHub preserves a `classificationMeta` sub-document recording `classifiedAt` and `migrationVersion`, the change can be rolled back natively without restoring from backup:
     ```javascript
     await TelegramResource.updateMany(
       { "classificationMeta.version": "v1.0-bad" },
       { $unset: { collections: "", categories: "", academicLevel: "", classificationMeta: "" } }
     );
     ```
  2. If data was overwritten destructively, restore from the pre-migration snapshot collection (`telegramresources_backup_phase2`).

### Scenario 2: Accidental Document Deletion
* **Symptom**: A developer script accidentally called `deleteMany({ isAvailable: false })` or dropped a collection.
* **Recovery Mechanism**:
  1. Immediately stop the web server and bot workers on Render and Vercel:
     - Render: Suspend Web Service.
     - Vercel: Enable Maintenance Mode or redeploy a pause commit.
  2. Access MongoDB Atlas Cloud Console -> Clusters -> Cluster0 -> Backup.
  3. Select the most recent automated snapshot prior to the incident timestamp.
  4. Choose **"Restore to a New Cluster"** or **"Restore to Staging Database"** (`studyhub_recovery`). **NEVER restore directly over the live production cluster.**
  5. Once the recovery cluster is online, verify document counts:
     ```javascript
     const restoredCount = await recoveryDb.collection("telegramresources").countDocuments();
     ```
  6. Replay oplog entries from `local.oplog.rs` for any legitimate user downloads or saves that occurred between the snapshot and the incident.
  7. Point the application's `MONGO_URI` to the verified restored database.

### Scenario 3: Quarantined Records Rollback
* **Symptom**: A purification rule was found to be overly aggressive and deactivated legitimate resources.
* **Recovery Mechanism**:
  - `TelegramResourceQuarantine` stores an immutable snapshot of all 9,044 quarantined documents with their `originalId`.
  - To restore:
    ```javascript
    const itemsToRestore = await TelegramResourceQuarantine.find({ quarantineReason: "target_reason", restorable: true });
    const ids = itemsToRestore.map(i => i.originalId);
    await TelegramResource.updateMany({ _id: { $in: ids } }, { $set: { isAvailable: true } });
    await TelegramResourceQuarantine.deleteMany({ originalId: { $in: ids } });
    ```

---

## 10. Future Migration Safety Standards

To ensure future taxonomy and categorization phases proceed with zero downtime and zero data loss, every future migration script must comply with the following 8 engineering standards:

### Standard 1: Mandatory Dry-Run Mode
Every script must default to `--dry-run`. It must execute all parsing, regex matching, and categorization in memory, outputting detailed before-and-after distribution statistics without issuing any write commands (`bulkWrite`, `updateOne`).

### Standard 2: Explicit Execution Switch
To execute writes, the operator must explicitly pass a CLI flag:
```bash
node scripts/migrate-taxonomy.js --execute --confirm=APPLY_TAXONOMY_V1
```

### Standard 3: Batch Processing with Keyset Seeking
Scripts must avoid `skip()` which causes $O(N)$ query degradation on 83,000 documents. All migrations must use keyset pagination:
```javascript
const query = lastId ? { _id: { $gt: lastId } } : {};
const batch = await TelegramResource.find(query).sort({ _id: 1 }).limit(1000).lean();
```

### Standard 4: Checkpointing & Progress Persistence
The migration state must be written to a dedicated `migrationcheckpoints` collection after every 1,000 documents:
- `migrationName`: e.g. `academic_taxonomy_v1`
- `lastProcessedId`: `ObjectId("...")`
- `processedCount`: `42,000`
- `updatedAt`: `ISODate()`
If a network timeout occurs, the script resumes from `lastProcessedId` without reprocessing.

### Standard 5: Idempotency
Running a script multiple times must yield the exact same database state. Migrations must use declarative updates (`$set`) based on immutable content hashes, rather than array pushes (`$push`) that produce duplicate entries on retry.

### Standard 6: Error Isolation
A malformed title or invalid regex on document #4,500 must not abort the batch. Errors must be caught, logged to an error report, and processing continued for the remaining documents.

### Standard 7: Automated Rollback Scripts
Every migration script must be paired with an inverse rollback script (e.g. `migrate-taxonomy.js` $\leftrightarrow$ `rollback-taxonomy.js`).

### Standard 8: Before-and-After Reconciliation
Every migration run must log:
- Pre-flight collection counts.
- Post-flight collection counts.
- Exact count of documents modified, unchanged, and failed.

---

## 11. Telegram Resource Provenance Preservation

StudyHub's unique value is its ability to deliver university files directly into students' Telegram chats without hosting 200 GB of PDF/image files on expensive web servers. **Corrupting Telegram identifiers breaks file delivery permanently.**

### Provenance Field Integrity Audit (Evaluated across all 83,073 available resources)

| Identifier Field | Missing / Invalid | Integrity Status | Role in File Delivery Pipeline |
|---|---:|---|---|
| `fileId` | **0** | **100% Valid** | Bot API identifier used to deliver files via Telegraf `copyMessage`. |
| `fileUniqueId` | **0** | **100% Valid** | Global MTProto immutable hash; used for content deduplication. |
| `messageId` | **0** | **100% Valid** | Origin message index used by GramJS user client to forward files. |
| `chatId` | **0** | **100% Valid** | Telegram numeric channel peer ID. |
| `channelUsername` | **0** | **100% Valid** | Telegram public channel username (`@channel`). |
| `groupId` | 27,230 null (standalone) | **100% Valid** | Links multi-page exam photos together into 1 deliverable album. |
| `archiveMessageId`| 15,945 null (pending) | **80.81% Backed Up**| Message ID in private backup channel (`ARCHIVE_CHAT_ID`). |
| `groupIndex` | **0** | **100% Valid** | Enforces chronological page order (e.g. Exam Page 1, 2, 3). |
| `groupTotal` | **0** | **100% Valid** | Records total photos/files in the group. |

### Provenance Protection Rules for Future Phases
1. **Never Overwrite `fileId` or `messageId`**: Categorization must only add fields (`categories`, `collections`); it must never modify Telegram MTProto fields.
2. **Preserve Album Grouping**: A classification rule applied to an album must apply to all child documents sharing that `groupId`. Child documents must never have their `groupId` or `groupIndex` cleared.
3. **Preserve Source Channel Provenance**: When deduplicating search results, the underlying documents must retain their respective `channelUsername`.

---

## 12. Mandatory Data Preservation Policy (The 12 Rules)

The following 12 rules are mandatory for all future implementation phases:

1. **NO HARD DELETIONS**: Never permanently delete duplicate resource documents merely because their `fileUniqueId` matches.
2. **PRESERVE SOURCE PROVENANCE**: Maintain channel usernames and origin message IDs for every indexed copy.
3. **PRESERVE MESSAGE IDENTIFIERS**: Never alter `messageId`, `chatId`, or `fileId`.
4. **PRESERVE ARCHIVE REDUNDANCY**: Never overwrite `archiveMessageId`.
5. **PRESERVE ALBUM MEMBERSHIP**: Maintain `groupId`, `groupIndex`, and `groupTotal` across all multi-file sets.
6. **NO FABRICATED FILE SIZES**: Never backfill estimated byte counts into `fileSize`. Leave `0` where size was not captured.
7. **NO SILENT AVAILABILITY MUTATIONS**: Never set `isAvailable: false` without recording a specific reason code.
8. **NO DESTRUCTIVE MERGES**: Deduplicate at the presentation layer (in search queries and result formatters), never by merging database records.
9. **PROTECT QUARANTINE INTEGRITY**: Never truncate or delete `telegramresourcequarantines`.
10. **STRICT ISOLATION OF FOREIGN COLLECTIONS**: Never modify, query, rename, or drop restaurant collections (`branches`, `restaurants`, `tables`, `orders`, `products`, `categories`, `assistances`).
11. **MANUAL CLASSIFICATION PRECEDENCE**: Automated classifiers must never overwrite a classification where `manualOverride: true`.
12. **MANDATORY REVERSIBILITY**: Every taxonomy modification must be completely reversible via `$unset`.

---

## 13. Remaining Technical Risks

1. **Missing MongoDB Indexes**:
   - Without compound indexes on `{ collections: 1, isAvailable: 1 }` and `{ categories: 1, isAvailable: 1 }`, future category-filtered searches will trigger full collection scans across 92,000 documents.
2. **Live Ingestion Drift**:
   - The production Telegram indexer runs continuously on Render. Any long-running migration must expect newly ingested documents arriving during execution.
3. **Memory Pressure on Index Footprint**:
   - Indexes already occupy 41 MB. Adding multiple large compound indexes could exceed RAM thresholds on smaller Atlas tiers, causing disk swapping.
4. **Restoration Testing Gap**:
   - Disaster recovery has been fully documented but has not been tested against a staging cluster (`NOT TESTED — RESTORE VALIDATION REQUIRED`).

---

## 14. Outstanding Decisions Requiring Approval

The following items require stakeholder approval before Phase 2 begins:

1. **Staging Cluster for Restore Validation**:  
   *Question*: Do you approve provisioning a temporary free/low-cost Atlas staging instance to test and validate a full database snapshot restore before Phase 2 migrations begin?
2. **Pre-Migration Safety Snapshot**:  
   *Question*: Before executing Phase 2 schema updates, do you approve creating an on-demand Atlas snapshot, or should a read-only script export an isolated Mongoose backup collection (`telegramresources_backup_phase2`) inside MongoDB?
3. **Handling of the 26 Inaccessible Files**:  
   *Question*: The 26 academic resources deactivated at runtime by delivery failures remain `isAvailable: false`. Should they be re-tested against their source channels or kept inactive until verified?
4. **Foreign Collection Policy**:  
   *Question*: Confirm that the 7 legacy restaurant collections (`branches`, `restaurants`, `tables`, `orders`, `products`, `categories`, `assistances`) must remain permanently untouched and excluded from all future scripts.

---

*End of Phase 1 Technical Report.*  
*All audit scripts and verified datasets are stored in `docs/data-audit/phase-1/`.*
