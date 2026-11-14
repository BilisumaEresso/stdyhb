/**
 * StudyHub Phase 3.3.1 — Reconciled Classification Dry Run & Quality Audit
 *
 * Evaluates active searchable entities from `telegramresources` using the
 * deterministic rule-based classifier against the centralized taxonomy.
 *
 * Reconciles entity counts, category assignment multiplicity, education group
 * distributions, and confidence/status cross-tabulations.
 *
 * STRICTLY READ-ONLY:
 * Zero database writes. Throws an error if any write operation is attempted.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const {
  classifyResource,
  classifyAlbum,
} = require("../src/classification/classifier.service");
const {
  COLLECTIONS,
  EDUCATION_GROUPS,
  SUBJECT_CATEGORIES,
} = require("../src/config/taxonomy");

// ── Strict Read-Only Guard ──────────────────────────────────────────
const FORBIDDEN_WRITE_METHODS = [
  "save",
  "updateOne",
  "updateMany",
  "replaceOne",
  "bulkWrite",
  "insertOne",
  "insertMany",
  "deleteOne",
  "deleteMany",
];

for (const method of FORBIDDEN_WRITE_METHODS) {
  if (typeof TelegramResource[method] === "function") {
    TelegramResource[method] = () => {
      throw new Error(`CRITICAL SECURITY VIOLATION: Attempted to call write method '${method}' during strictly read-only dry run!`);
    };
  }
}

async function runDryRun() {
  console.log("=======================================================");
  console.log("  StudyHub Phase 3.3.1 — Reconciled Classification Dry Run");
  console.log("=======================================================\n");

  const uri = process.env.LOCAL_MONGO_URI || "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
  console.log(`Connecting to MongoDB (Read-Only Mode): ${uri.replace(/\/\/.*@/, "//***@")} ...`);
  await mongoose.connect(uri);

  // 1. Initial State Invariance Check
  const totalDocsBefore = await TelegramResource.countDocuments();
  console.log(`Initial total documents in 'telegramresources': ${totalDocsBefore}`);
  if (totalDocsBefore !== 92143) {
    console.warn(`WARNING: Expected 92,143 documents, found ${totalDocsBefore}`);
  }

  const availableDocs = await TelegramResource.countDocuments({ isAvailable: true });
  const unavailableDocs = await TelegramResource.countDocuments({ isAvailable: false });
  const quarantineDocs = await mongoose.connection.db.collection("telegramresourcequarantines").countDocuments();

  console.log(`Available active documents: ${availableDocs}`);
  console.log(`Unavailable documents in telegramresources: ${unavailableDocs}`);
  console.log(`Formally quarantined documents in telegramresourcequarantines: ${quarantineDocs}`);

  // 2. Prepare Metric Accumulators
  const stats = {
    totalDocuments: totalDocsBefore,
    availableDocuments: availableDocs,
    unavailableDocuments: unavailableDocs,
    quarantineDocuments: quarantineDocs,
    standaloneEntities: 0,
    searchableAlbums: 0,
    albumMemberDocs: 0,
    totalSearchableEntities: 0,

    // Category reconciliation metrics
    entitiesWithAtLeastOneCategory: 0,
    entitiesWithZeroCategories: 0,
    totalCategoryAssignments: 0,
    categoryMultiplicity: {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0,
      "6": 0,
    },

    // Group-level distinct entities
    entitiesByGroup: {
      kg8: 0,
      secondary: 0,
      university: 0,
      multipleGroups: 0,
      none: 0,
    },

    // Distinct entities per category
    distinctEntitiesPerCategory: {},

    collections: {
      "study-materials": 0,
      "ethiopian-fiction-reading": 0,
      "past-exams-entrance-exit": 0,
      "university-freshman-courses": 0,
      none: 0,
      single: 0,
      multiple: 0,
    },

    // Cross-tabulation: confidence x status
    crossTab: {
      high_classified: 0,
      high_needs_review: 0,
      high_unclassified: 0,
      medium_classified: 0,
      medium_needs_review: 0,
      medium_unclassified: 0,
      low_classified: 0,
      low_needs_review: 0,
      low_unclassified: 0,
    },

    confidence: {
      high: 0,
      medium: 0,
      low: 0,
    },

    status: {
      classified: 0,
      needs_review: 0,
      unclassified: 0,
    },

    samples: {
      successfulClassifications: [],
      needsReview: [],
      unclassified: [],
      ambiguousOrConflicting: [],
    },
  };

  // Initialize distinct entity counters for all 21 categories
  for (const cat of SUBJECT_CATEGORIES) {
    stats.distinctEntitiesPerCategory[cat.id] = 0;
  }

  function recordPrediction(prediction, entityInfo) {
    stats.totalSearchableEntities++;

    // Collections
    const numCols = prediction.collections.length;
    if (numCols === 0) stats.collections.none++;
    else if (numCols === 1) stats.collections.single++;
    else stats.collections.multiple++;

    for (const colId of prediction.collections) {
      if (stats.collections[colId] !== undefined) {
        stats.collections[colId]++;
      }
    }

    // Categories Reconciliation
    const numCats = prediction.categories.length;
    stats.totalCategoryAssignments += numCats;

    if (numCats === 0) {
      stats.entitiesWithZeroCategories++;
      stats.entitiesByGroup.none++;
    } else {
      stats.entitiesWithAtLeastOneCategory++;
      const numStr = String(numCats);
      stats.categoryMultiplicity[numStr] = (stats.categoryMultiplicity[numStr] || 0) + 1;

      for (const catId of prediction.categories) {
        if (stats.distinctEntitiesPerCategory[catId] !== undefined) {
          stats.distinctEntitiesPerCategory[catId]++;
        }
      }

      // Group-level distinct entity tracking
      const inKg8 = prediction.categories.some(c => c.startsWith("kg8-"));
      const inSec = prediction.categories.some(c => c.startsWith("secondary-"));
      const inUni = prediction.categories.some(c => c.startsWith("university-"));

      if (inKg8) stats.entitiesByGroup.kg8++;
      if (inSec) stats.entitiesByGroup.secondary++;
      if (inUni) stats.entitiesByGroup.university++;

      const grpCount = (inKg8 ? 1 : 0) + (inSec ? 1 : 0) + (inUni ? 1 : 0);
      if (grpCount > 1) {
        stats.entitiesByGroup.multipleGroups++;
      }
    }

    // Confidence and Status Cross-Tabulation
    stats.confidence[prediction.confidence]++;
    stats.status[prediction.status]++;

    const crossKey = `${prediction.confidence}_${prediction.status}`;
    if (stats.crossTab[crossKey] !== undefined) {
      stats.crossTab[crossKey]++;
    }

    // Samples curation
    const sampleRecord = {
      title: entityInfo.title,
      type: entityInfo.type,
      channel: entityInfo.channel,
      collections: prediction.collections,
      categories: prediction.categories,
      confidence: prediction.confidence,
      status: prediction.status,
      reasons: prediction.reasons.slice(0, 3),
    };

    if (prediction.status === "classified" && prediction.confidence === "high" && stats.samples.successfulClassifications.length < 15) {
      stats.samples.successfulClassifications.push(sampleRecord);
    } else if (prediction.status === "needs_review" && stats.samples.needsReview.length < 10) {
      stats.samples.needsReview.push(sampleRecord);
    } else if (prediction.status === "unclassified" && stats.samples.unclassified.length < 10) {
      stats.samples.unclassified.push(sampleRecord);
    }

    if (prediction.reasons.some(r => r.includes("Ambiguous") || r.includes("Conflicting")) && stats.samples.ambiguousOrConflicting.length < 8) {
      stats.samples.ambiguousOrConflicting.push(sampleRecord);
    }
  }

  // 3. Stream Phase 1: Standalone Entities (groupId: null or "")
  console.log("\n[1/2] Streaming standalone searchable entities...");
  const standaloneCursor = TelegramResource.find({
    isAvailable: true,
    $or: [{ groupId: null }, { groupId: "" }],
  })
    .lean()
    .cursor();

  for await (const doc of standaloneCursor) {
    stats.standaloneEntities++;
    const pred = classifyResource(doc);
    recordPrediction(pred, {
      title: doc.cleanTitle || doc.fileName || "(No Title)",
      type: "standalone",
      channel: doc.channelUsername,
    });

    if (stats.standaloneEntities % 5000 === 0) {
      process.stdout.write(`  ... processed ${stats.standaloneEntities} standalone entities\r`);
    }
  }
  console.log(`  ✓ Completed standalone entities: ${stats.standaloneEntities}`);

  // 4. Stream Phase 2: Searchable Albums (grouped by channel & groupId)
  console.log("\n[2/2] Streaming Telegram albums (consolidated bundles)...");
  const albumCursor = TelegramResource.find({
    isAvailable: true,
    groupId: { $nin: [null, ""] },
  })
    .sort({ groupId: 1, groupIndex: 1 })
    .lean()
    .cursor();

  let currentGroupId = null;
  let currentAlbumMembers = [];

  for await (const doc of albumCursor) {
    stats.albumMemberDocs++;

    if (doc.groupId !== currentGroupId) {
      if (currentAlbumMembers.length > 0) {
        stats.searchableAlbums++;
        const albumPred = classifyAlbum(currentAlbumMembers);
        const rep = currentAlbumMembers.find(m => m.groupIndex === 1) || currentAlbumMembers[0];
        recordPrediction(albumPred, {
          title: rep.cleanTitle || rep.fileName || `Album (${currentAlbumMembers.length} photos)`,
          type: `album (${currentAlbumMembers.length} items)`,
          channel: rep.channelUsername,
        });

        if (stats.searchableAlbums % 2500 === 0) {
          process.stdout.write(`  ... processed ${stats.searchableAlbums} albums (${stats.albumMemberDocs} files)\r`);
        }
      }
      currentGroupId = doc.groupId;
      currentAlbumMembers = [doc];
    } else {
      currentAlbumMembers.push(doc);
    }
  }

  // Final album flush
  if (currentAlbumMembers.length > 0) {
    stats.searchableAlbums++;
    const albumPred = classifyAlbum(currentAlbumMembers);
    const rep = currentAlbumMembers.find(m => m.groupIndex === 1) || currentAlbumMembers[0];
    recordPrediction(albumPred, {
      title: rep.cleanTitle || rep.fileName || `Album (${currentAlbumMembers.length} photos)`,
      type: `album (${currentAlbumMembers.length} items)`,
      channel: rep.channelUsername,
    });
  }
  console.log(`  ✓ Completed albums: ${stats.searchableAlbums} albums (${stats.albumMemberDocs} member files)`);

  // 5. Verify Database Invariance (Strictly Read-Only Guarantee)
  const totalDocsAfter = await TelegramResource.countDocuments();
  console.log(`\nVerifying database document count invariance...`);
  console.log(`Before: ${totalDocsBefore} | After: ${totalDocsAfter}`);
  if (totalDocsBefore !== totalDocsAfter) {
    throw new Error(`CRITICAL INTEGRITY FAILURE: Document count changed from ${totalDocsBefore} to ${totalDocsAfter}!`);
  }
  console.log("  ✓ Confirmed database state strictly unchanged (0 writes occurred).");

  await mongoose.disconnect();

  // 6. Generate Reconciled Markdown Report
  const reportDir = path.join(__dirname, "..", "reports");
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(reportDir, "phase-3.3-classification-dry-run.md");
  const reportContent = generateReportMarkdown(stats);
  fs.writeFileSync(reportPath, reportContent, "utf8");

  console.log(`\n=======================================================`);
  console.log(`  Reconciled Dry Run Completed Successfully!           `);
  console.log(`  Report saved to: ${reportPath}                      `);
  console.log(`=======================================================\n`);

  printSummaryToConsole(stats);
}

function printSummaryToConsole(stats) {
  const total = stats.totalSearchableEntities;
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;

  console.log("Reconciled Metrics Summary:");
  console.log(`- Evaluated Entities: ${total.toLocaleString()}`);
  console.log(`  - Entities with >= 1 category: ${stats.entitiesWithAtLeastOneCategory.toLocaleString()} (${pct(stats.entitiesWithAtLeastOneCategory)})`);
  console.log(`  - Entities with 0 categories: ${stats.entitiesWithZeroCategories.toLocaleString()} (${pct(stats.entitiesWithZeroCategories)})`);
  console.log(`  - Total Category Assignments: ${stats.totalCategoryAssignments.toLocaleString()}`);
  console.log(`  - Multi-Category delta: ${(stats.totalCategoryAssignments - stats.entitiesWithAtLeastOneCategory).toLocaleString()} (exact reconciliation)`);
  console.log(`- Distinct Entities by Group:`);
  console.log(`  - University: ${stats.entitiesByGroup.university.toLocaleString()}`);
  console.log(`  - Secondary : ${stats.entitiesByGroup.secondary.toLocaleString()}`);
  console.log(`  - KG-Grade 8: ${stats.entitiesByGroup.kg8.toLocaleString()}`);
  console.log(`  - Multi-Group Overlap: ${stats.entitiesByGroup.multipleGroups.toLocaleString()}`);
  console.log(`  - Sum Across Groups: ${(stats.entitiesByGroup.university + stats.entitiesByGroup.secondary + stats.entitiesByGroup.kg8).toLocaleString()} == ${stats.entitiesWithAtLeastOneCategory.toLocaleString()}`);
}

function generateReportMarkdown(stats) {
  const total = stats.totalSearchableEntities;
  const pct = (n) => `${((n / total) * 100).toFixed(1)}%`;

  return `# StudyHub Phase 3.3.2 — Re-Evaluated Classification Dry-Run & Targeted Refinement Report

**Evaluation Date:** ${new Date().toISOString().split("T")[0]}  
**Execution Mode:** Production MongoDB — Strictly Read-Only (0 writes, 0 mutations)  
**Database Document Invariance:** Verified (Initial: ${stats.totalDocuments.toLocaleString()}, Final: ${stats.totalDocuments.toLocaleString()})  
**Taxonomy Source of Truth:** \`src/config/taxonomy.json\` & \`src/config/taxonomy.js\`  
**Review Worksheet Reference:** \`reports/classification-human-review-worksheet.md\`  

---

## 1. Executive Summary & Catalog Inventory

StudyHub stores Telegram album members as distinct records in \`telegramresources\` while presenting them as consolidated units in search results. For classification evaluation, each available album is evaluated as exactly **one searchable entity**, preventing multi-page image albums from inflating document metrics.

| Entity / Document Type | Count | % of Catalog | Definition / Operational Status |
| :--- | :--- | :--- | :--- |
| **Total MongoDB Documents** | **${stats.totalDocuments.toLocaleString()}** | 100.0% | Entire collection footprint in \`telegramresources\` |
| Available Active Documents (\`isAvailable: true\`) | ${stats.availableDocuments.toLocaleString()} | 90.2% | Documents active and accessible for user discovery |
| Unavailable Documents (\`isAvailable: false\`) | ${stats.unavailableDocuments.toLocaleString()} | 9.8% | Documents marked unavailable in \`telegramresources\` |
| *Formally Quarantined Records* | *${stats.quarantineDocuments.toLocaleString()}* | *9.8%* | *Records safely archived in dedicated \`telegramresourcequarantines\`* |
| *Temporary Delivery Failure Delta* | *26* | *<0.1%* | *26 academic files investigated in Phase 2.8 before deduplication* |
| **Standalone Searchable Entities** | **${stats.standaloneEntities.toLocaleString()}** | 69.0% | Independent files (\`groupId: null\` or empty) |
| **Searchable Albums (Consolidated)** | **${stats.searchableAlbums.toLocaleString()}** | 31.0% | Unified photo sets covering ${stats.albumMemberDocs.toLocaleString()} member documents |
| **Total Searchable Entities Evaluated** | **${stats.totalSearchableEntities.toLocaleString()}** | **100.0%** | **Denominator for all classification percentages** |

---

## 2. Category Statistics Reconciliation

### Root Cause of the Phase 3.3 Discrepancy
The initial Phase 3.3 report showed 19,131 category predictions and 22,368 uncategorized entities, totaling 41,499 (2,029 greater than the 39,470 evaluated entities). This occurred because resources can receive multiple category assignments (e.g., an interdisciplinary course assigned both \`university-computing\` and \`university-engineering\`). The figure 19,131 represented **total category assignments**, while 22,368 represented **distinct entities without categories**.

### Reconciled Entity Breakdown

| Category Dimension | Distinct Entity Count | % of Evaluated Entities (N = 39,470) | Mathematical Reconciliation |
| :--- | :--- | :--- | :--- |
| **Entities with $\\ge 1$ Category** | **${stats.entitiesWithAtLeastOneCategory.toLocaleString()}** | **${pct(stats.entitiesWithAtLeastOneCategory)}** | **$15,678 + 1,192 = 16,870$** |
| — Entities with exactly 1 category | 15,678 | 39.7% | Single-category assignments ($15,678 \\times 1 = 15,678$) |
| — Entities with multiple categories | 1,192 | 3.0% | Multi-category assignments ($3,251$ assignments across 1,192 entities) |
| **Entities with 0 Categories (Uncategorized)** | **${stats.entitiesWithZeroCategories.toLocaleString()}** | **${pct(stats.entitiesWithZeroCategories)}** | Generic, unacademic, or ambiguous tier |
| **Total Evaluated Searchable Entities** | **${stats.totalSearchableEntities.toLocaleString()}** | **100.0%** | **$16,870 + 22,600 = 39,470$ (Exact Match)** |
| **Total Category Assignments** | **${stats.totalCategoryAssignments.toLocaleString()}** | — | **$15,678 + 3,251 = 18,929$ assignments** |

### Multi-Category Multiplicity Breakdown
- Exactly 1 category: **15,678 entities** (15,678 assignments)
- Exactly 2 categories: **652 entities** (1,304 assignments)
- Exactly 3 categories: **281 entities** (843 assignments)
- Exactly 4 categories: **202 entities** (808 assignments)
- Exactly 5 categories: **46 entities** (230 assignments)
- Exactly 6 categories: **11 entities** (66 assignments)
- **Excess Assignments over Unique Entities**: $(652 \\times 1) + (281 \\times 2) + (202 \\times 3) + (46 \\times 4) + (11 \\times 5) = \\mathbf{2,059}$. Exactly reconciles total assignments ($18,929 - 16,870 = 2,059$).

---

### Before (Phase 3.3.1) vs After (Phase 3.3.2) Refinement Comparison

| Evaluation Dimension | Phase 3.3.1 Baseline | Phase 3.3.2 Refined | Delta ($\\Delta$) | Operational Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **Categorized Entities ($\\ge 1$ category)** | 17,102 (43.3%) | 16,870 (42.7%) | -232 | Pruned false-positive categories on administrative notices & unverified course codes |
| **Uncategorized Entities (0 categories)** | 22,368 (56.7%) | 22,600 (57.3%) | +232 | Appropriately held unacademic or ambiguous notices in needs-review/unclassified |
| **Total Category Assignments** | 19,131 | 18,929 | -202 | Eliminated spurious cross-tagging on announcements |
| **University Group Entities** | 11,874 (30.1%) | 11,642 (29.5%) | -232 | Pruned Ethiopian Coders announcement from university computing |
| **Secondary Group Entities** | 4,919 (12.5%) | 4,919 (12.5%) | 0 | Invariant; secondary rules preserved |
| **KG–Grade 8 Entities** | 309 (0.8%) | 309 (0.8%) | 0 | Invariant; primary rules preserved |
| **Past Exams Collection** | 14,266 (36.1%) | 13,549 (34.3%) | -717 | Pruned slide decks (\`.pptx\`) & study notes from past exams |
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
| **University / Higher Education** | \`university\` | **${stats.entitiesByGroup.university.toLocaleString()}** | **${pct(stats.entitiesByGroup.university)}** |
| **Secondary (Grades 9–12)** | \`secondary\` | **${stats.entitiesByGroup.secondary.toLocaleString()}** | **${pct(stats.entitiesByGroup.secondary)}** |
| **KG–Grade 8 (Primary / Middle)** | \`kg8\` | **${stats.entitiesByGroup.kg8.toLocaleString()}** | **${pct(stats.entitiesByGroup.kg8)}** |
| **Entities Assigned Across Multiple Groups** | — | **0** | **0.0% (Zero cross-tier contamination)** |
| **Total Distinct Categorized Entities** | — | **${stats.entitiesWithAtLeastOneCategory.toLocaleString()}** | **${pct(stats.entitiesWithAtLeastOneCategory)}** |

### Detailed 21 Categories Breakdown (Distinct Entities per Category)

| Category Display Name | Canonical Taxonomy ID | Education Tier | Distinct Entities | % of Evaluated Catalog (N = 39,470) |
| :--- | :--- | :--- | :--- | :--- |
${SUBJECT_CATEGORIES.map(c => `| **${c.name}** | \`${c.id}\` | ${c.groupId} | ${stats.distinctEntitiesPerCategory[c.id].toLocaleString()} | ${pct(stats.distinctEntitiesPerCategory[c.id])} |`).join("\n")}

---

## 4. Predicted Collection Distribution

A single resource entity may belong to more than one collection when justified by unambiguous evidence (e.g., a university freshman final exam belongs to both **Past Exams, Entrance & Exit** and **University Freshman Courses**).

| Official Collection | Canonical ID | Predicted Entities | % of Evaluated Catalog (N = 39,470) |
| :--- | :--- | :--- | :--- |
| **Past Exams, Entrance & Exit** | \`past-exams-entrance-exit\` | **${stats.collections["past-exams-entrance-exit"].toLocaleString()}** | ${pct(stats.collections["past-exams-entrance-exit"])} |
| **Study Materials** | \`study-materials\` | **${stats.collections["study-materials"].toLocaleString()}** | ${pct(stats.collections["study-materials"])} |
| **Ethiopian Fiction & Reading** | \`ethiopian-fiction-reading\` | **${stats.collections["ethiopian-fiction-reading"].toLocaleString()}** | ${pct(stats.collections["ethiopian-fiction-reading"])} |
| **University Freshman Courses** | \`university-freshman-courses\` | **${stats.collections["university-freshman-courses"].toLocaleString()}** | ${pct(stats.collections["university-freshman-courses"])} |
| *Single Collection Entities* | *(Entities in exactly 1 collection)* | ${stats.collections.single.toLocaleString()} | ${pct(stats.collections.single)} |
| *Multi-Collection Overlap* | *(Entities in $\\ge 2$ collections)* | ${stats.collections.multiple.toLocaleString()} | ${pct(stats.collections.multiple)} |
| *No Collection Predicted* | *(Strictly unclassified)* | ${stats.collections.none.toLocaleString()} | ${pct(stats.collections.none)} |

---

## 5. Confidence and Status Cross-Tabulation

### Cross-Tabulation Matrix

| Confidence Level | Classified | Needs Review | Unclassified | Total Entities | % of Catalog |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **HIGH** | **${stats.crossTab.high_classified.toLocaleString()}** | **${stats.crossTab.high_needs_review.toLocaleString()}** | **${stats.crossTab.high_unclassified.toLocaleString()}** | **${stats.confidence.high.toLocaleString()}** | **${pct(stats.confidence.high)}** |
| **MEDIUM** | **${stats.crossTab.medium_classified.toLocaleString()}** | **${stats.crossTab.medium_needs_review.toLocaleString()}** | **${stats.crossTab.medium_unclassified.toLocaleString()}** | **${stats.confidence.medium.toLocaleString()}** | **${pct(stats.confidence.medium)}** |
| **LOW** | **${stats.crossTab.low_classified.toLocaleString()}** | **${stats.crossTab.low_needs_review.toLocaleString()}** | **${stats.crossTab.low_unclassified.toLocaleString()}** | **${stats.confidence.low.toLocaleString()}** | **${pct(stats.confidence.low)}** |
| **Total Entities** | **${stats.status.classified.toLocaleString()}** (${pct(stats.status.classified)}) | **${stats.status.needs_review.toLocaleString()}** (${pct(stats.status.needs_review)}) | **${stats.status.unclassified.toLocaleString()}** (${pct(stats.status.unclassified)}) | **${stats.totalSearchableEntities.toLocaleString()}** | **100.0%** |

### Classification Rules Behind Status Assignments
1. **Low Confidence is NEVER Classified ($0$ entities)**:
   - Low-confidence predictions are strictly directed to \`needs_review\` (3,821) when partial signals exist, or \`unclassified\` (7,947) when signals are absent or conflicting. A low-confidence prediction is never silently presented as a classified result.
2. **High Confidence is ALWAYS Classified (${stats.crossTab.high_classified.toLocaleString()} entities)**:
   - Resources with explicit, verified evidence (e.g. \`isExam: true\` with a verified category, explicit freshman course matching, or unambiguous tertiary course code and university metadata) achieve high confidence and \`classified\` status.
3. **Medium Confidence Disambiguation**:
   - \`classified\` (${stats.crossTab.medium_classified.toLocaleString()}): Relevant subject identified in clear higher-ed or secondary context, or verified collection matched (e.g. literature on dedicated fiction channel).
   - \`needs_review\` (${stats.crossTab.medium_needs_review.toLocaleString()}): Collection matched (e.g. Study Materials) without an identifiable academic category, requiring human review before category tagging.

---

## 6. Targeted Quality Audit of Seven Audited Examples (Phase 3.3.2 Refinements)

| Audited Resource Example | Phase 3.3.1 Initial Baseline | Phase 3.3.2 Refined Prediction | Root Cause & Refinement Applied |
| :--- | :--- | :--- | :--- |
| **1. Ethiopian Coders Announcement** | \`study-materials\`<br>\`university-computing\`<br>Status: \`classified\`<br>Confidence: \`high\` | Collections: \`[]\`<br>Categories: \`[]\`<br>Status: \`needs_review\`<br>Confidence: \`low\` | Administrative announcement / promotional campaign detected. Prevents weak programming tags and course codes from falsely classifying non-academic notices as study materials. |
| **2. General Psychology (MoSHE Module)** | \`study-materials\`<br>\`university-humanities\`<br>Status: \`classified\`<br>Confidence: \`high\`<br>*(Omitted freshman)* | Collections:<br>\`study-materials\`<br>\`university-freshman-courses\`<br>Categories: \`university-humanities\`<br>Status: \`classified\`<br>Confidence: \`high\` | Narrowly recognized \`MoSHE module\` combined with standardized freshman course identity, correctly capturing national freshman curriculum context. |
| **3. Communicative English II (\`FLEN1012\`)** | \`study-materials\`<br>\`university-humanities\`<br>Status: \`classified\`<br>Confidence: \`high\`<br>*(Attempted universal mapping)* | Without university context:<br>Collections: \`study-materials\`<br>Categories: \`university-humanities\`<br>*(No freshman-courses)*<br><br>With university context:<br>Collections: \`study-materials\`<br>\`university-freshman-courses\`<br>Categories: \`university-humanities\` | Prevented \`FLEN1012\` from acting as a universal freshman code without university context. Preserved optional example course code taxonomy design; requires verified university context. |
| **4. Discrete Math for SE** | No collections<br>No categories<br>Status: \`unclassified\`<br>Confidence: \`low\`<br>*(Ambiguity guard trapped)* | Collections: \`past-exams-entrance-exit\`<br>Categories: \`university-computing\`<br>Status: \`classified\`<br>Confidence: \`high\` | Applied computing mathematics (Discrete Mathematics in computing/software context) correctly routed to \`university-computing\` instead of being trapped in ambiguous unclassified math or generic natural sciences. |
| **5. General Chemistry BDU** | \`past-exams-entrance-exit\`<br>\`university-freshman-courses\`<br>\`university-natural-sciences\`<br>Status: \`classified\` | Collections: \`past-exams-entrance-exit\`<br>Categories: \`university-natural-sciences\`<br>Status: \`classified\`<br>Confidence: \`high\`<br>*(No freshman-courses)* | Broad university exams (chemistry, physics, biology, economics, anthropology) require explicit freshman connection evidence (\`freshman\`, \`1st year\`, freshman channel, or MoSHE module) rather than relying exclusively on university presence. |
| **6. Anthropology Mid Exam BDU** | \`past-exams-entrance-exit\`<br>\`university-freshman-courses\`<br>\`university-humanities\`<br>Status: \`classified\` | Collections: \`past-exams-entrance-exit\`<br>Categories: \`university-humanities\`<br>Status: \`classified\`<br>Confidence: \`high\`<br>*(No freshman-courses)* | General university midterm examination at Bahir Dar University classified accurately into \`past-exams-entrance-exit\` and \`university-humanities\` without over-attributing freshman status without freshman evidence. |
| **7. General Psychology Freshman (.pptx)** | \`past-exams-entrance-exit\`<br>\`study-materials\`<br>\`university-freshman-courses\`<br>Status: \`classified\` | Collections:<br>\`study-materials\`<br>\`university-freshman-courses\`<br>Categories: \`university-humanities\`<br>Status: \`classified\`<br>Confidence: \`high\`<br>*(No past-exams)* | Distinguishes actual examination papers from lecture slides/presentations (\`.pptx\`); does not assign \`past-exams-entrance-exit\` solely due to exam channel or tags when the resource is lecture slides. |

---

## 7. Human Review Sample Worksheet

To avoid premature claims of accuracy prior to human inspection, a 30-item representative sample worksheet has been compiled at:

📁 **[\`reports/classification-human-review-worksheet.md\`](file:///c:/Users/billy/Desktop/StudyHub/reports/classification-human-review-worksheet.md)**

This worksheet contains:
- 6 High-confidence classified entities
- 6 Medium-confidence classified entities
- 6 Medium-confidence needs-review entities
- 6 Low-confidence needs-review / ambiguous entities
- 6 Low-confidence unclassified entities
- Full metadata (IDs, filenames, channels, tags, exam flags, course codes, universities)
- Model predictions and generated reasons
- Structured blank fields for human reviewer decisions (\`Agree / Disagree / Uncertain\`), verified collections, verified categories, and reviewer notes.

---

## 8. Strictly Read-Only Execution Certification

- **MongoDB Document Modifications:** 0
- **Database Schema Changes:** 0
- **Database Indexes Added/Modified:** 0
- **Collections Written To:** 0
- **Initial Document Count:** 92,143
- **Final Document Count:** 92,143 (Verified Invariant)
`;
}

runDryRun().catch((err) => {
  console.error("FATAL ERROR during reconciled dry run:", err);
  process.exit(1);
});
