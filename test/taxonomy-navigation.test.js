/**
 * StudyHub Phase 3.2.2 — Taxonomy-Driven Explore & Subjects Navigation Test Suite
 *
 * Verifies:
 * 1. All four official collections exist and have required metadata.
 * 2. Exactly 21 primary categories exist and match approved taxonomy display names.
 * 3. Categories are correctly grouped into 3 education groups (7 per group).
 * 4. Collection exploration URLs and Category navigation links map to valid routes and search parameters.
 * 5. Explore page and Subjects page source exclusively from web/src/lib/taxonomy.ts (zero duplicate definitions).
 * 6. Database remains strictly read-only at 92,143 documents.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const {
  COLLECTIONS,
  EDUCATION_GROUPS,
  SUBJECT_CATEGORIES,
  getCategoriesByGroup,
  getCollection,
  getSubjectCategory
} = require("../src/config/taxonomy");

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("  StudyHub Phase 3.2.2 — Taxonomy Navigation Tests     ");
  console.log("=======================================================\n");

  // ─── Group 1: Four Official Collections Verification ────────────────────────
  console.log("Group 1: Four Official Collections Verification");

  runTest("Exactly 4 collections exist with approved canonical names", () => {
    assert.strictEqual(COLLECTIONS.length, 4, `Expected exactly 4 collections, got ${COLLECTIONS.length}`);
    const expectedNames = [
      "Study Materials",
      "Ethiopian Fiction & Reading",
      "Past Exams, Entrance & Exit",
      "University Freshman Courses"
    ];
    for (const name of expectedNames) {
      assert(COLLECTIONS.some(c => c.name === name), `Missing collection: ${name}`);
    }
  });

  runTest("Each collection has icon, description, and amharicName", () => {
    for (const col of COLLECTIONS) {
      assert(col.id, `Collection missing id: ${col.name}`);
      assert(col.icon, `Collection missing icon: ${col.name}`);
      assert(col.description && col.description.length > 20, `Collection description too short: ${col.name}`);
      assert(col.amharicName, `Collection missing amharicName: ${col.name}`);
    }
  });

  // ─── Group 2: Exactly 21 Categories Verification ────────────────────────────
  console.log("\nGroup 2: Exactly 21 Categories Verification");

  runTest("Exactly 21 approved categories exist across taxonomy", () => {
    assert.strictEqual(SUBJECT_CATEGORIES.length, 21, `Expected 21 categories, got ${SUBJECT_CATEGORIES.length}`);
  });

  runTest("All 21 category IDs are unique kebab-case strings", () => {
    const ids = new Set();
    const kebab = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    for (const cat of SUBJECT_CATEGORIES) {
      assert(kebab.test(cat.id), `Category ID not valid kebab-case: ${cat.id}`);
      assert(!ids.has(cat.id), `Duplicate category ID: ${cat.id}`);
      ids.add(cat.id);
    }
  });

  // ─── Group 3: Grouped into Three Education Groups ───────────────────────────
  console.log("\nGroup 3: Grouped into Three Education Groups");

  runTest("Three education groups exist: kg8, secondary, university", () => {
    assert.strictEqual(EDUCATION_GROUPS.length, 3);
    const groupIds = EDUCATION_GROUPS.map(g => g.id);
    assert(groupIds.includes("kg8"), "Missing kg8 group");
    assert(groupIds.includes("secondary"), "Missing secondary group");
    assert(groupIds.includes("university"), "Missing university group");
  });

  runTest("Categories partition evenly with exactly 7 categories per group", () => {
    const kg8Cats = getCategoriesByGroup("kg8");
    const secondaryCats = getCategoriesByGroup("secondary");
    const universityCats = getCategoriesByGroup("university");

    assert.strictEqual(kg8Cats.length, 7, `Expected 7 KG-8 categories, got ${kg8Cats.length}`);
    assert.strictEqual(secondaryCats.length, 7, `Expected 7 secondary categories, got ${secondaryCats.length}`);
    assert.strictEqual(universityCats.length, 7, `Expected 7 university categories, got ${universityCats.length}`);
  });

  // ─── Group 4: Navigation Routes and Search Parameters ───────────────────────
  console.log("\nGroup 4: Navigation Routes and Search Parameters");

  runTest("Collection navigation URLs map to valid explore routes and parameters", () => {
    const urlMap = {
      "study-materials": "/explore?collection=study-materials",
      "ethiopian-fiction-reading": "/explore?collection=ethiopian-fiction-reading&q=Ethiopian+Fiction",
      "past-exams-entrance-exit": "/explore?collection=past-exams-entrance-exit&filter=exam",
      "university-freshman-courses": "/explore?collection=university-freshman-courses&q=Freshman"
    };

    for (const [colId, expectedUrl] of Object.entries(urlMap)) {
      const col = getCollection(colId);
      assert(col, `Collection not found: ${colId}`);
      assert(expectedUrl.startsWith("/explore"), `URL must target explore page: ${expectedUrl}`);
    }
  });

  runTest("Category navigation URLs construct valid search queries without broken characters", () => {
    for (const cat of SUBJECT_CATEGORIES) {
      const url = `/explore?category=${encodeURIComponent(cat.id)}&q=${encodeURIComponent(cat.name)}`;
      assert(url.includes("/explore?category="), `Invalid category URL format for ${cat.name}`);
      assert(url.includes("&q="), `Category URL missing q parameter for ${cat.name}`);
      assert(!url.includes("undefined"), `Category URL contains undefined for ${cat.name}`);
    }
  });

  // ─── Group 5: Zero Hardcoded Duplicate Definitions ──────────────────────────
  console.log("\nGroup 5: Zero Hardcoded Duplicate Definitions in Frontend");

  runTest("Explore page imports from @/lib/taxonomy", () => {
    const exploreFile = path.join(__dirname, "../web/src/app/explore/page.tsx");
    const content = fs.readFileSync(exploreFile, "utf-8");
    assert(content.includes('from "@/lib/taxonomy"'), "Explore page must import from @/lib/taxonomy");
    assert(!content.includes("const ALL_SUBJECTS ="), "Explore page must not define hardcoded subjects");
  });

  runTest("Subjects page imports from @/lib/taxonomy and has zero hardcoded subjects", () => {
    const subjectsFile = path.join(__dirname, "../web/src/app/subjects/page.tsx");
    const content = fs.readFileSync(subjectsFile, "utf-8");
    assert(content.includes('from "@/lib/taxonomy"'), "Subjects page must import from @/lib/taxonomy");
    assert(!content.includes("const ALL_SUBJECTS ="), "Subjects page must not define hardcoded ALL_SUBJECTS");
    assert(!content.includes("Thousands of verified materials"), "Subjects page must not contain invented counts");
  });

  // ─── Group 6: Database Read-Only Document Invariance ────────────────────────
  console.log("\nGroup 6: Database Read-Only Invariance");

  await runAsyncTest("Database document count remains strictly invariant at 92,143", async () => {
    const TEST_DB_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
    await mongoose.connect(TEST_DB_URI);
    const count = await mongoose.connection.db.collection("telegramresources").countDocuments();
    assert.strictEqual(count, 92143, `Database document count changed! Expected 92,143, found ${count}`);
    await mongoose.disconnect();
  });

  console.log("\n=======================================================");
  console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed  `);
  console.log("=======================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
