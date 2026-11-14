/**
 * test/academic-taxonomy.test.js
 *
 * STUDYHUB PHASE 3.1 — CENTRALIZED ETHIOPIAN ACADEMIC TAXONOMY
 * Comprehensive Validation Test Suite
 *
 * Verifies:
 * 1. Exactly 4 collections with valid IDs and descriptions.
 * 2. Exactly 21 primary subject categories with unique IDs.
 * 3. Every category belongs to a valid education group (kg8, secondary, university).
 * 4. Collection IDs and category IDs are unique and well-formatted.
 * 5. Search aliases resolve to valid taxonomy targets (category, course, collection).
 * 6. Natural Science and Social Science streams are distinct with appropriate courses (13 courses each).
 * 7. Freshman course aliases resolve to valid courses (18 unique courses).
 * 8. Zero conflicting alias destinations across normalized keys.
 * 9. Grade 9 supported under secondary education without creating a 22nd primary category.
 * 10. Existing subjectAliases.js keywords and aliases remain compatible.
 * 11. Backend (src/) and Frontend (web/) import identical taxonomy configuration.
 * 12. Database document count invariance (strictly 92,143 documents).
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// Load backend taxonomy module
const taxonomyHelper = require("../src/config/taxonomy");
const {
  TAXONOMY,
  COLLECTIONS,
  EDUCATION_GROUPS,
  EDUCATION_GRADES,
  SUBJECT_CATEGORIES,
  FRESHMAN_STREAMS,
  FRESHMAN_COURSES,
  ALIASES,
  getCollection,
  getEducationGroup,
  getEducationGrade,
  getSubjectCategory,
  getCategoriesByGroup,
  getFreshmanStream,
  getFreshmanCoursesByStream,
  getFreshmanCourse,
  resolveAlias,
  isValidCollectionId,
  isValidCategoryId,
  isValidGroupId,
  isValidStreamId,
  isValidCourseId
} = taxonomyHelper;

// Load existing subjectAliases module to test compatibility
const { expandQuery, SUBJECT_ALIASES } = require("../src/config/subjectAliases");

let totalTests = 0;
let passedTests = 0;

function runSyncTest(name, fn) {
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
  console.log("  StudyHub Phase 3.1 — Academic Taxonomy Test Suite    ");
  console.log("=======================================================\n");

  // ─── Test 1: Exactly 4 Collections ──────────────────────────────────────────
  runSyncTest("Test 1: Exactly 4 collections with valid IDs and descriptions", () => {
    assert.strictEqual(COLLECTIONS.length, 4, `Expected exactly 4 collections, found ${COLLECTIONS.length}`);

    const expectedCollectionIds = [
      "study-materials",
      "ethiopian-fiction-reading",
      "past-exams-entrance-exit",
      "university-freshman-courses"
    ];

    const actualIds = COLLECTIONS.map(c => c.id);
    for (const expId of expectedCollectionIds) {
      assert(actualIds.includes(expId), `Missing expected collection ID: ${expId}`);
      const col = getCollection(expId);
      assert(col, `getCollection(${expId}) returned null`);
      assert(col.name && col.name.trim().length > 0, `Collection ${expId} missing name`);
      assert(col.description && col.description.trim().length > 0, `Collection ${expId} missing description`);
      assert(col.icon && col.icon.trim().length > 0, `Collection ${expId} missing icon`);
      assert(Array.isArray(col.aliases) && col.aliases.length > 0, `Collection ${expId} missing aliases`);
      assert(Array.isArray(col.documentTypes) && col.documentTypes.length > 0, `Collection ${expId} missing documentTypes`);
    }

    // Verify study-materials replaces old "textbooks" naming and has relevant document types
    const studyMats = getCollection("study-materials");
    assert.strictEqual(studyMats.name, "Study Materials");
    assert(studyMats.documentTypes.includes("textbook"), "study-materials should include textbooks");
    assert(studyMats.documentTypes.includes("module"), "study-materials should include modules");
    assert(studyMats.documentTypes.includes("lecture_notes"), "study-materials should include lecture notes");
    assert(studyMats.aliases.includes("textbooks"), "study-materials should retain textbooks alias for backwards compatibility");

    // Verify ethiopian-fiction-reading has language specifications
    const fiction = getCollection("ethiopian-fiction-reading");
    assert.strictEqual(fiction.name, "Ethiopian Fiction & Reading");
    assert(fiction.languages.includes("am"), "Fiction should include Amharic (am)");
    assert(fiction.languages.includes("om"), "Fiction should include Afaan Oromo (om)");
    assert(fiction.languages.includes("ti"), "Fiction should include Tigrinya (ti)");
    assert(fiction.languages.includes("so"), "Fiction should include Somali (so)");
    assert(fiction.languages.includes("aa"), "Fiction should include Afar (aa)");
    assert(fiction.languages.includes("en"), "Fiction should include English (en)");

    // Verify past-exams-entrance-exit includes midterms, finals, exit and entrance exams
    const exams = getCollection("past-exams-entrance-exit");
    assert.strictEqual(exams.name, "Past Exams, Entrance & Exit");
    assert(exams.documentTypes.includes("midterm"), "Exams should include midterm");
    assert(exams.documentTypes.includes("final"), "Exams should include final");
    assert(exams.documentTypes.includes("exit_exam"), "Exams should include exit_exam");
    assert(exams.documentTypes.includes("entrance_exam"), "Exams should include entrance_exam");

    // Verify university-freshman-courses defines streams
    const freshman = getCollection("university-freshman-courses");
    assert.strictEqual(freshman.name, "University Freshman Courses");
    assert(freshman.streams.includes("natural-science"), "Freshman collection should include natural-science stream");
    assert(freshman.streams.includes("social-science"), "Freshman collection should include social-science stream");
  });

  // ─── Test 2: Exactly 21 Primary Subject Categories ──────────────────────────
  runSyncTest("Test 2: Exactly 21 primary subject categories with approved names and unique IDs", () => {
    assert.strictEqual(SUBJECT_CATEGORIES.length, 21, `Expected exactly 21 subject categories, found ${SUBJECT_CATEGORIES.length}`);

    const expectedCategoryNames = {
      "kg8-languages-literacy": "Languages & Literacy",
      "kg8-mathematics": "Mathematics",
      "kg8-general-science": "General & Environmental Science",
      "kg8-social-studies-geography": "Social Studies & Geography",
      "kg8-history-civics": "History, Civics & Moral Education",
      "kg8-ict-technology": "ICT & Basic Technology",
      "kg8-arts-health-pe": "Arts, Music, Health & Physical Education",
      "secondary-languages": "English & Ethiopian Languages",
      "secondary-mathematics": "Mathematics",
      "secondary-physics": "Physics",
      "secondary-chemistry": "Chemistry",
      "secondary-biology": "Biology & Life Sciences",
      "secondary-social-sciences": "Social Sciences",
      "secondary-applied-technology": "Applied Science & Technology",
      "university-computing": "Computing & Information Sciences",
      "university-engineering": "Engineering & Built Environment",
      "university-natural-sciences": "Natural & Computational Sciences",
      "university-health-sciences": "Health & Medical Sciences",
      "university-agriculture": "Agriculture, Veterinary & Natural Resources",
      "university-business": "Business & Economics",
      "university-humanities": "Social Sciences, Humanities, Law & Education"
    };

    const idSet = new Set();
    for (const cat of SUBJECT_CATEGORIES) {
      assert(!idSet.has(cat.id), `Duplicate category ID detected: ${cat.id}`);
      idSet.add(cat.id);

      assert(cat.id && typeof cat.id === "string", "Category must have valid string id");
      assert(cat.name && typeof cat.name === "string", `Category ${cat.id} must have valid name`);
      assert.strictEqual(
        cat.name,
        expectedCategoryNames[cat.id],
        `Category '${cat.id}' display name mismatch. Expected '${expectedCategoryNames[cat.id]}', got '${cat.name}'`
      );
      assert(cat.groupId && typeof cat.groupId === "string", `Category ${cat.id} must have valid groupId`);
      assert(cat.description && typeof cat.description === "string", `Category ${cat.id} must have valid description`);
      assert(cat.icon && typeof cat.icon === "string", `Category ${cat.id} must have valid icon`);
      assert(Array.isArray(cat.aliases) && cat.aliases.length > 0, `Category ${cat.id} must have aliases array`);
      assert(Array.isArray(cat.keywords) && cat.keywords.length > 0, `Category ${cat.id} must have keywords array`);
      assert(typeof cat.displayOrder === "number", `Category ${cat.id} must have displayOrder`);
    }
  });

  // ─── Test 3: Every Category Belongs to a Valid Education Group ──────────────
  runSyncTest("Test 3: Every category belongs to a valid education group (7 per group)", () => {
    assert.strictEqual(EDUCATION_GROUPS.length, 3, `Expected exactly 3 education groups, found ${EDUCATION_GROUPS.length}`);

    const expectedGroupIds = ["kg8", "secondary", "university"];
    const actualGroupIds = EDUCATION_GROUPS.map(g => g.id);

    for (const expG of expectedGroupIds) {
      assert(actualGroupIds.includes(expG), `Missing expected education group: ${expG}`);
      const group = getEducationGroup(expG);
      assert(group, `getEducationGroup(${expG}) returned null`);
      assert(isValidGroupId(expG), `isValidGroupId(${expG}) should be true`);

      const categoriesInGroup = getCategoriesByGroup(expG);
      assert.strictEqual(
        categoriesInGroup.length,
        7,
        `Group '${expG}' must contain exactly 7 categories, found ${categoriesInGroup.length}`
      );

      // Verify category IDs listed in group.categoryIds match actual filtered categories
      assert.strictEqual(group.categoryIds.length, 7, `Group ${expG} categoryIds array length must be 7`);
      for (const catId of group.categoryIds) {
        const cat = getSubjectCategory(catId);
        assert(cat, `Category ${catId} listed in group ${expG} does not exist`);
        assert.strictEqual(cat.groupId, expG, `Category ${catId} groupId (${cat.groupId}) does not match group ${expG}`);
      }
    }

    // Verify all 21 categories map to one of the 3 groups
    for (const cat of SUBJECT_CATEGORIES) {
      assert(
        expectedGroupIds.includes(cat.groupId),
        `Category ${cat.id} has invalid groupId: ${cat.groupId}`
      );
    }
  });

  // ─── Test 4: Collection & Category IDs Uniqueness & Formatting ──────────────
  runSyncTest("Test 4: Collection IDs and category IDs are unique and well-formatted", () => {
    const allIds = new Set();
    const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

    for (const col of COLLECTIONS) {
      assert(kebabRegex.test(col.id), `Collection ID '${col.id}' is not valid kebab-case`);
      assert(!allIds.has(col.id), `ID collision detected: '${col.id}'`);
      allIds.add(col.id);
    }

    for (const cat of SUBJECT_CATEGORIES) {
      assert(kebabRegex.test(cat.id), `Category ID '${cat.id}' is not valid kebab-case`);
      assert(!allIds.has(cat.id), `Category ID collides with collection ID: '${cat.id}'`);
      allIds.add(cat.id);
    }

    for (const grp of EDUCATION_GROUPS) {
      assert(kebabRegex.test(grp.id), `Group ID '${grp.id}' is not valid kebab-case`);
    }

    for (const crs of FRESHMAN_COURSES) {
      assert(kebabRegex.test(crs.id), `Course ID '${crs.id}' is not valid kebab-case`);
      assert(!allIds.has(crs.id), `Course ID collision detected: '${crs.id}'`);
      allIds.add(crs.id);
    }
  });

  // ─── Test 5: Search Aliases Resolve to Valid Targets ─────────────────────────
  runSyncTest("Test 5: Search aliases resolve to valid taxonomy targets", () => {
    assert(Object.keys(ALIASES).length > 0, "Taxonomy must define aliases map");

    for (const [key, entry] of Object.entries(ALIASES)) {
      assert(entry.key, `Alias entry for '${key}' missing key`);
      assert(entry.name, `Alias entry for '${key}' missing name`);
      assert(entry.targetType, `Alias entry for '${key}' missing targetType`);
      assert(entry.targetId, `Alias entry for '${key}' missing targetId`);
      assert(entry.canonicalExpansion, `Alias entry for '${key}' missing canonicalExpansion`);

      if (entry.targetType === "category") {
        assert(isValidCategoryId(entry.targetId), `Alias '${key}' points to invalid categoryId: ${entry.targetId}`);
      } else if (entry.targetType === "course") {
        assert(isValidCourseId(entry.targetId), `Alias '${key}' points to invalid courseId: ${entry.targetId}`);
      } else if (entry.targetType === "collection") {
        assert(isValidCollectionId(entry.targetId), `Alias '${key}' points to invalid collectionId: ${entry.targetId}`);
      } else {
        assert.fail(`Invalid targetType '${entry.targetType}' in alias '${key}'`);
      }
    }

    // Spot-check core alias lookups
    const dbmsAlias = resolveAlias("dbms");
    assert(dbmsAlias, "resolveAlias('dbms') should return entry");
    assert.strictEqual(dbmsAlias.targetType, "category");
    assert.strictEqual(dbmsAlias.targetId, "university-computing");
    assert.strictEqual(dbmsAlias.canonicalExpansion, "database");

    const dsaAlias = resolveAlias("dsa");
    assert(dsaAlias, "resolveAlias('dsa') should return entry");
    assert.strictEqual(dsaAlias.targetType, "category");
    assert.strictEqual(dsaAlias.targetId, "university-computing");
    assert.strictEqual(dsaAlias.canonicalExpansion, "data structures");

    const osAlias = resolveAlias("os");
    assert(osAlias, "resolveAlias('os') should return entry");
    assert.strictEqual(osAlias.targetType, "category");
    assert.strictEqual(osAlias.targetId, "university-computing");

    const cnAlias = resolveAlias("cn");
    assert(cnAlias, "resolveAlias('cn') should return entry");
    assert.strictEqual(cnAlias.targetType, "category");
    assert.strictEqual(cnAlias.targetId, "university-computing");

    const mathNatAlias = resolveAlias("mathNat");
    assert(mathNatAlias, "resolveAlias('mathNat') should return entry");
    assert.strictEqual(mathNatAlias.targetType, "course");
    assert.strictEqual(mathNatAlias.targetId, "freshman-math-natural");
  });

  // ─── Test 6: Natural Science and Social Science Streams ─────────────────────
  runSyncTest("Test 6: Natural Science and Social Science streams are distinct with 13 courses each", () => {
    assert.strictEqual(FRESHMAN_STREAMS.length, 2, "Expected exactly 2 freshman streams");

    const natStream = getFreshmanStream("natural-science");
    const socStream = getFreshmanStream("social-science");

    assert(natStream, "natural-science stream must exist");
    assert(socStream, "social-science stream must exist");

    assert.strictEqual(natStream.courseIds.length, 13, `natural-science must have 13 courses, got ${natStream.courseIds.length}`);
    assert.strictEqual(socStream.courseIds.length, 13, `social-science must have 13 courses, got ${socStream.courseIds.length}`);

    // Natural Science designated courses
    const expectedNatCourses = [
      "freshman-math-natural",
      "freshman-physics",
      "freshman-biology",
      "freshman-chemistry",
      "freshman-psychology",
      "freshman-logic",
      "freshman-english",
      "freshman-geography",
      "freshman-history",
      "freshman-anthropology",
      "freshman-emerging-tech",
      "freshman-civics",
      "freshman-fitness"
    ];

    for (const cId of expectedNatCourses) {
      assert(natStream.courseIds.includes(cId), `natural-science missing course: ${cId}`);
    }

    // Social Science designated courses
    const expectedSocCourses = [
      "freshman-math-social",
      "freshman-economics",
      "freshman-psychology",
      "freshman-logic",
      "freshman-english",
      "freshman-geography",
      "freshman-anthropology",
      "freshman-entrepreneurship",
      "freshman-global-trends",
      "freshman-emerging-tech",
      "freshman-inclusiveness",
      "freshman-civics",
      "freshman-fitness"
    ];

    for (const cId of expectedSocCourses) {
      assert(socStream.courseIds.includes(cId), `social-science missing course: ${cId}`);
    }

    // Stream-specific distinct courses check
    assert(natStream.courseIds.includes("freshman-math-natural"));
    assert(!socStream.courseIds.includes("freshman-math-natural"));

    assert(socStream.courseIds.includes("freshman-math-social"));
    assert(!natStream.courseIds.includes("freshman-math-social"));

    assert(natStream.courseIds.includes("freshman-physics"));
    assert(!socStream.courseIds.includes("freshman-physics"));

    assert(socStream.courseIds.includes("freshman-economics"));
    assert(!natStream.courseIds.includes("freshman-economics"));

    assert(socStream.courseIds.includes("freshman-entrepreneurship"));
    assert(!natStream.courseIds.includes("freshman-entrepreneurship"));

    assert(socStream.courseIds.includes("freshman-global-trends"));
    assert(!natStream.courseIds.includes("freshman-global-trends"));

    assert(socStream.courseIds.includes("freshman-inclusiveness"));
    assert(!natStream.courseIds.includes("freshman-inclusiveness"));

    // Common courses check
    const common = ["freshman-psychology", "freshman-logic", "freshman-english", "freshman-geography", "freshman-anthropology", "freshman-emerging-tech", "freshman-civics", "freshman-fitness"];
    for (const cId of common) {
      assert(natStream.courseIds.includes(cId), `Common course ${cId} missing in natural stream`);
      assert(socStream.courseIds.includes(cId), `Common course ${cId} missing in social stream`);
    }
  });

  // ─── Test 7: Freshman Course Aliases Resolve to Valid Courses ────────────────
  runSyncTest("Test 7: Freshman course aliases resolve to valid courses (18 courses)", () => {
    assert.strictEqual(FRESHMAN_COURSES.length, 18, `Expected exactly 18 unique freshman courses, got ${FRESHMAN_COURSES.length}`);

    for (const course of FRESHMAN_COURSES) {
      assert(course.id, "Course must have id");
      assert(course.name, `Course ${course.id} must have name`);
      // Unverified course codes downgraded to optional university-specific metadata
      assert(Array.isArray(course.exampleCourseCodes), `Course ${course.id} must have exampleCourseCodes array`);
      assert(course.universityMetadata && course.universityMetadata.note, `Course ${course.id} must have universityMetadata.note`);
      // Zero universal hardcoded semester assignments
      assert(!course.semester, `Course ${course.id} must not have universal hardcoded semester`);
      assert(Array.isArray(course.streams) && course.streams.length > 0, `Course ${course.id} must have streams`);
      assert(isValidCategoryId(course.categoryRef), `Course ${course.id} has invalid categoryRef: ${course.categoryRef}`);
      assert(Array.isArray(course.aliases) && course.aliases.length > 0, `Course ${course.id} must have aliases`);
      assert(Array.isArray(course.keywords) && course.keywords.length > 0, `Course ${course.id} must have keywords`);
      assert(course.canonicalExpansion, `Course ${course.id} must have canonicalExpansion`);

      // Verify each stream ID is valid
      for (const stId of course.streams) {
        assert(isValidStreamId(stId), `Course ${course.id} lists invalid streamId: ${stId}`);
      }
    }

    // Test course retrieval by alias
    const mathNat = getFreshmanCourse("math 1011");
    assert(mathNat, "getFreshmanCourse('math 1011') should return course");
    assert.strictEqual(mathNat.id, "freshman-math-natural");

    const phys = getFreshmanCourse("phys 1011");
    assert(phys, "getFreshmanCourse('phys 1011') should return course");
    assert.strictEqual(phys.id, "freshman-physics");

    const logic = getFreshmanCourse("phil 1011");
    assert(logic, "getFreshmanCourse('phil 1011') should return course");
    assert.strictEqual(logic.id, "freshman-logic");

    const emtech = getFreshmanCourse("emtech");
    assert(emtech, "getFreshmanCourse('emtech') should return course");
    assert.strictEqual(emtech.id, "freshman-emerging-tech");

    // Verify Communicative English Language Skills course
    const englishCourse = getFreshmanCourse("freshman-english");
    assert(englishCourse, "freshman-english course must exist");
    assert.strictEqual(englishCourse.name, "Communicative English Language Skills");

    // Test getFreshmanCoursesByStream
    const natList = getFreshmanCoursesByStream("natural-science");
    assert.strictEqual(natList.length, 13);
    const socList = getFreshmanCoursesByStream("social-science");
    assert.strictEqual(socList.length, 13);
  });

  // ─── Test 8: Zero Conflicting Alias Destinations Across Normalized Keys ──────
  runSyncTest("Test 8: Zero conflicting alias destinations across normalized keys", () => {
    const normalizedMap = new Map();

    for (const [key, entry] of Object.entries(ALIASES)) {
      const allKeyVariants = [key, ...(entry.aliases || [])];
      for (const v of allKeyVariants) {
        const norm = v.toLowerCase().trim();
        const dest = `${entry.targetType}:${entry.targetId}`;

        if (normalizedMap.has(norm)) {
          const existingDest = normalizedMap.get(norm);
          assert.strictEqual(
            existingDest,
            dest,
            `Conflicting alias collision: '${norm}' maps to '${existingDest}' and '${dest}'`
          );
        } else {
          normalizedMap.set(norm, dest);
        }
      }
    }
  });

  // ─── Test 9: Grade 9 Supported Under Secondary Education ────────────────────
  runSyncTest("Test 9: Grade 9 supported under secondary education without creating a 22nd primary category", () => {
    // Exactly 21 categories
    assert.strictEqual(SUBJECT_CATEGORIES.length, 21, "Primary categories must remain strictly 21");

    // No category should have id "grade-9" or "grade9"
    const grade9Cat = SUBJECT_CATEGORIES.find(c => c.id.includes("grade-9") || c.id.includes("grade9"));
    assert(!grade9Cat, "Grade 9 must NOT be an independent primary subject category");

    // Grade 9 must be present in educationGrades
    const grade9 = getEducationGrade("grade-9");
    assert(grade9, "getEducationGrade('grade-9') must return grade entry");
    assert.strictEqual(grade9.groupId, "secondary", "Grade 9 groupId must be 'secondary'");
    assert(grade9.levels && grade9.levels.includes(9), "Grade 9 levels must include 9");

    // Secondary group gradeIds includes grade-9
    const secondaryGroup = getEducationGroup("secondary");
    assert(secondaryGroup.gradeIds.includes("grade-9"), "secondary group gradeIds must include 'grade-9'");
  });

  // ─── Test 10: Existing subjectAliases.js Compatibility ──────────────────────
  runSyncTest("Test 10: Existing subjectAliases.js keywords and aliases remain compatible", () => {
    assert(SUBJECT_ALIASES, "SUBJECT_ALIASES must be exported by subjectAliases.js");
    assert(typeof expandQuery === "function", "expandQuery must be exported by subjectAliases.js");

    // Test core queries from Phase 2.1 - 2.3
    const q1 = expandQuery("dbms exam");
    assert(q1.appliedAliases.includes("dbms"), "Expected appliedAliases to include 'dbms'");
    assert(/\bdatabase\b/i.test(q1.expanded), "Expected canonical term 'database'");
    assert(!/\bOR\b/.test(q1.expanded), "Expected NO OR token");

    const q2 = expandQuery("dsa final");
    assert(q2.appliedAliases.includes("dsa"), "Expected appliedAliases to include 'dsa'");
    assert(/\bdata structures\b/i.test(q2.expanded), "Expected canonical term 'data structures'");
    assert(!/\bOR\b/.test(q2.expanded), "Expected NO OR token");

    const q3 = expandQuery("general mathematics");
    assert(q3.appliedAliases.includes("mathNat"), "Expected appliedAliases to include 'mathNat'");
    assert(!/\bOR\b/.test(q3.expanded), "Expected NO OR token");

    const q4 = expandQuery("computer networks mid exam");
    assert(q4.appliedAliases.includes("cn") || q4.appliedAliases.includes("compnet"), "Expected network alias");
    assert(!/\bOR\b/.test(q4.expanded), "Expected NO OR token");
  });

  // ─── Test 11: Backend (src/) and Frontend (web/) Import Identical Taxonomy ──
  runSyncTest("Test 11: Backend (src/) and Frontend (web/) import identical taxonomy configuration", () => {
    const taxonomyJsonPath = path.join(__dirname, "../src/config/taxonomy.json");
    assert(fs.existsSync(taxonomyJsonPath), "src/config/taxonomy.json must exist on disk");

    const rawJson = JSON.parse(fs.readFileSync(taxonomyJsonPath, "utf-8"));
    assert.strictEqual(rawJson.collections.length, 4, "JSON collections must have 4 items");
    assert.strictEqual(rawJson.subjectCategories.length, 21, "JSON subjectCategories must have 21 items");
    assert.strictEqual(rawJson.educationGroups.length, 3, "JSON educationGroups must have 3 items");
    assert.strictEqual(rawJson.freshmanStreams.length, 2, "JSON freshmanStreams must have 2 items");
    assert.strictEqual(rawJson.freshmanCourses.length, 18, "JSON freshmanCourses must have 18 items");

    // Check frontend wrapper file existence
    const frontendTsPath = path.join(__dirname, "../web/src/lib/taxonomy.ts");
    assert(fs.existsSync(frontendTsPath), "web/src/lib/taxonomy.ts must exist on disk");
    const tsContent = fs.readFileSync(frontendTsPath, "utf-8");
    assert(tsContent.includes('import rawTaxonomy from "../../../src/config/taxonomy.json"'), "Frontend must import canonical taxonomy.json");

    // Ensure backend taxonomy helper matches JSON directly
    assert.deepStrictEqual(TAXONOMY.collections, rawJson.collections);
    assert.deepStrictEqual(TAXONOMY.subjectCategories, rawJson.subjectCategories);
    assert.deepStrictEqual(TAXONOMY.educationGroups, rawJson.educationGroups);
    assert.deepStrictEqual(TAXONOMY.freshmanStreams, rawJson.freshmanStreams);
    assert.deepStrictEqual(TAXONOMY.freshmanCourses, rawJson.freshmanCourses);
  });

  // ─── Test 12: Database Document Count Invariance (Strictly 92,143) ───────────
  await runAsyncTest("Test 12: Database document count invariance (strictly 92,143 documents)", async () => {
    const TEST_DB_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
    await mongoose.connect(TEST_DB_URI);

    const docCount = await mongoose.connection.db.collection("telegramresources").countDocuments();
    console.log(`    Verified collection document count: ${docCount.toLocaleString()}`);

    assert.strictEqual(
      docCount,
      92143,
      `Database document count MUST be strictly 92,143. Found: ${docCount}`
    );

    await mongoose.disconnect();
  });

  // Summary
  console.log("\n=======================================================");
  console.log(`  Academic Taxonomy Tests Completed: ${passedTests}/${totalTests} Passed`);
  console.log("=======================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
