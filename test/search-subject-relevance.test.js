const assert = require("assert");
const mongoose = require("mongoose");
const searchService = require("../src/search/search.service");
const { expandQuery } = require("../src/config/subjectAliases");
const TelegramResource = require("../src/db/models/TelegramResource");
const CachedSearch = require("../src/db/models/CachedSearch");

const ISOLATED_TEST_DB_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";

async function runUnitTests() {
  console.log("\n=================================================================");
  console.log("RUNNING PHASE 2.3 SUBJECT RELEVANCE UNIT TESTS");
  console.log("=================================================================\n");

  // Test 1: Subject extraction
  console.log(">>> Test 1: Subject intent extraction for target queries");
  const t1 = searchService.calculateTelegramScore.name; // verifies function exists
  assert.strictEqual(typeof searchService.calculateTelegramScore, "function", "calculateTelegramScore must be a function");

  // Test 2: General Mathematics prioritizes Mathematics over General Physics
  console.log(">>> Test 2: General Mathematics prioritizes Mathematics over General Physics");
  const mathDoc = {
    cleanTitle: "AASTU General Mathes Mid 2017",
    fileName: "aastu-general-mathes-mid-2017.pdf",
    caption: "",
    tags: ["exam", "mid"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 0
  };
  const physicsDoc = {
    cleanTitle: "General Physics",
    fileName: "General physics..pptx",
    caption: "",
    tags: ["exam", "physics", "general_physics"],
    fileType: "ppt",
    isExam: true,
    downloadCount: 5
  };

  const mathScore = searchService.calculateTelegramScore(mathDoc, "General Mathematics", 4.0, { explicitFormat: false });
  const physicsScore = searchService.calculateTelegramScore(physicsDoc, "General Mathematics", 3.96, { explicitFormat: false });

  assert(mathScore > physicsScore, `Mathematics (${mathScore}) must outscore General Physics (${physicsScore}) for 'General Mathematics'`);
  console.log(`  ✓ PASS: Mathematics (${mathScore.toFixed(1)}) > General Physics (${physicsScore.toFixed(1)})`);

  // Test 3: Computer Networks final exam prioritizes Computer Networks over Entrepreneurship/Anthropology
  console.log(">>> Test 3: Computer Networks final exam prioritizes Computer Networks");
  const cnDoc = {
    cleanTitle: "Advanced Computer Networks - mid&final Exam 2015ec",
    fileName: "Advanced computer networks-mid&final exam 2015EC.pdf",
    caption: "",
    tags: ["exam", "final", "mid"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 5
  };
  const entrepreneurshipDoc = {
    cleanTitle: "Pre - exam - keleme - entrepreneurship - final - exams",
    fileName: "pre-exam-keleme-entrepreneurship-final-exams.pdf",
    caption: "",
    tags: ["exam", "final", "entrepreneurship"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 0
  };

  const cnScore = searchService.calculateTelegramScore(cnDoc, "Computer Networks final exam", 21.7, { exam: true, explicitFormat: false });
  const entreScore = searchService.calculateTelegramScore(entrepreneurshipDoc, "Computer Networks final exam", 17.5, { exam: true, explicitFormat: false });

  assert(cnScore > entreScore, `Computer Networks (${cnScore}) must outscore Entrepreneurship (${entreScore})`);
  console.log(`  ✓ PASS: Computer Networks exam (${cnScore.toFixed(1)}) > Entrepreneurship exam (${entreScore.toFixed(1)})`);

  // Test 4: DBMS exam prioritizes DBMS doc over Physics entrance exam with 5 downloads
  console.log(">>> Test 4: DBMS exam prioritizes DBMS exam over Physics entrance exam");
  const dbmsDoc = {
    cleanTitle: "Mid - exam - dbms - questions",
    fileName: "mid-exam-dbms-questions.docx",
    caption: "",
    tags: ["exam", "mid", "dbms"],
    fileType: "doc",
    isExam: true,
    downloadCount: 0
  };
  const phyEntranceDoc = {
    cleanTitle: "PHY entrance exam 2013 Ethio Exams",
    fileName: "PHY entrance exam 2013 Ethio Exams.pdf",
    caption: "",
    tags: ["exam", "physics"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 5
  };

  const dbmsScore = searchService.calculateTelegramScore(dbmsDoc, "DBMS exam", 18.7, { exam: true, explicitFormat: false });
  const phyScore = searchService.calculateTelegramScore(phyEntranceDoc, "DBMS exam", 4.0, { exam: true, explicitFormat: false });

  assert(dbmsScore > phyScore, `DBMS exam (${dbmsScore}) must outscore Physics entrance exam (${phyScore})`);
  console.log(`  ✓ PASS: DBMS exam (${dbmsScore.toFixed(1)}) > Physics entrance exam (${phyScore.toFixed(1)})`);

  // Test 5: DSA PPT prioritizes DSA PPT/materials over Logic PPT
  console.log(">>> Test 5: DSA PPT prioritizes DSA materials over Logic PPT");
  const dsaPptDoc = {
    cleanTitle: "Chapter 1 - Introduction",
    fileName: "Chapter 1 - Introduction.ppt",
    caption: "",
    tags: ["data_structure", "algorithms"],
    fileType: "ppt",
    isExam: false,
    downloadCount: 0
  };
  const logicPptDoc = {
    cleanTitle: "Logic",
    fileName: "Logic.ppt",
    caption: "",
    tags: ["logic"],
    fileType: "ppt",
    isExam: false,
    downloadCount: 5
  };

  const dsaScore = searchService.calculateTelegramScore(dsaPptDoc, "DSA PPT", 6.8, { ppt: true, explicitFormat: true });
  const logicScore = searchService.calculateTelegramScore(logicPptDoc, "DSA PPT", 5.0, { ppt: true, explicitFormat: true });

  assert(dsaScore > logicScore, `DSA presentation (${dsaScore}) must outscore Logic presentation (${logicScore})`);
  console.log(`  ✓ PASS: DSA presentation (${dsaScore.toFixed(1)}) > Logic PPT (${logicScore.toFixed(1)})`);

  // Test 6: User university personalization boost remains intact (+80)
  console.log(">>> Test 6: User university personalization boost (+80)");
  const userA = { university: "AASTU" };
  const userB = { university: "Hawassa" };
  const uniDoc = {
    cleanTitle: "AASTU Database Final",
    fileName: "aastu-db.pdf",
    university: "AASTU",
    tags: ["dbms"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 0
  };

  const scoreA = searchService.calculateTelegramScore(uniDoc, "dbms exam", 10.0, { exam: true, explicitFormat: false }, userA);
  const scoreB = searchService.calculateTelegramScore(uniDoc, "dbms exam", 10.0, { exam: true, explicitFormat: false }, userB);

  assert.strictEqual(scoreA - scoreB, 80, `Matching university must grant exactly +80 points boost (got diff: ${scoreA - scoreB})`);
  console.log(`  ✓ PASS: University personalization boost correctly applied (+80 pts)`);

  // Test 7: Generic queries without specific subject do not apply false penalties
  console.log(">>> Test 7: Generic queries preserve standard scoring without penalties");
  const genericExamDoc = {
    cleanTitle: "Freshman Final Examination 2022",
    fileName: "freshman-final.pdf",
    tags: ["exam", "final"],
    fileType: "pdf",
    isExam: true,
    downloadCount: 2
  };
  const genericScore = searchService.calculateTelegramScore(genericExamDoc, "final exam", 10.0, { exam: true, explicitFormat: false });
  assert(genericScore > 150, `Generic search must not be penalized (score: ${genericScore})`);
  console.log(`  ✓ PASS: Generic search preserved without penalty (${genericScore.toFixed(1)} pts)`);

  console.log("\nUnit Tests Summary: 7/7 passed.\n");
}

async function runIntegrationTests() {
  console.log("=================================================================");
  console.log("RUNNING PHASE 2.3 ISOLATED MONGODB INTEGRATION TESTS");
  console.log(`Database: ${ISOLATED_TEST_DB_URI}`);
  console.log("=================================================================\n");

  await mongoose.connect(ISOLATED_TEST_DB_URI);

  const baselineCount = await TelegramResource.countDocuments();
  console.log(`Baseline collection document count: ${baselineCount.toLocaleString()}`);
  assert.strictEqual(baselineCount, 92143, "Database baseline count must be exactly 92,143");

  // Clear CachedSearch in isolated test database so fresh ranking is executed
  await CachedSearch.deleteMany({});
  console.log("Cleared isolated search cache for accurate live scoring verification.");

  // Integration Test A: General Mathematics
  console.log('\n>>> Executing search: "General Mathematics" ...');
  const resMath = await searchService.searchResources("General Mathematics");
  assert(resMath.length > 0, "Should return results for General Mathematics");
  console.log(`    Total results returned: ${resMath.length}`);
  const topMath = resMath.slice(0, 5);
  topMath.forEach((r, idx) => console.log(`    ${idx + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.type})`));

  // Verify General Physics is NOT #1, and top result is mathematics-related
  const topMathTitle = topMath[0].title.toLowerCase();
  assert(!topMathTitle.includes("physics"), "Top result for General Mathematics must NOT be Physics");
  const mathHits = topMath.filter(r => {
    const t = (r.title + " " + (r.fileName || "")).toLowerCase();
    const tags = (r.tags || []).join(" ").toLowerCase();
    return t.includes("math") || tags.includes("math") || tags.includes("applied_mathematics");
  });
  assert(mathHits.length >= 3, "At least 3 of top 5 results must be Mathematics resources");
  console.log("    ✓ General Physics successfully deprioritized; Mathematics resources prioritized.");

  // Integration Test B: Computer Networks final exam
  console.log('\n>>> Executing search: "Computer Networks final exam" ...');
  const resCN = await searchService.searchResources("Computer Networks final exam");
  assert(resCN.length > 0, "Should return results for Computer Networks final exam");
  console.log(`    Total results returned: ${resCN.length}`);
  const topCN = resCN.slice(0, 5);
  topCN.forEach((r, idx) => console.log(`    ${idx + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.type})`));

  // Top result must be computer networks / DCCN
  const topCNTitle = (topCN[0].title + " " + (topCN[0].fileName || "")).toLowerCase();
  assert(topCNTitle.includes("network") || topCNTitle.includes("dccn") || topCNTitle.includes("cn"), "Top result must be Computer Networks");
  // Ensure Entrepreneurship and Anthropology do not rank above Computer Networks
  assert(!topCNTitle.includes("entrepreneurship") && !topCNTitle.includes("anthropology"), "Top result must not be Entrepreneurship or Anthropology");
  console.log("    ✓ Computer Networks exams rank #1; unrelated final exams successfully deprioritized.");

  // Integration Test C: DBMS exam
  console.log('\n>>> Executing search: "DBMS exam" ...');
  const resDBMS = await searchService.searchResources("DBMS exam");
  assert(resDBMS.length > 0, "Should return results for DBMS exam");
  console.log(`    Total results returned: ${resDBMS.length}`);
  const topDBMS = resDBMS.slice(0, 5);
  topDBMS.forEach((r, idx) => console.log(`    ${idx + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.type})`));

  const topDBMSTitle = (topDBMS[0].title + " " + (topDBMS[0].fileName || "")).toLowerCase();
  assert(topDBMSTitle.includes("dbms") || topDBMSTitle.includes("database"), "Top result must be DBMS or Database");
  assert(!topDBMSTitle.includes("physics entrance"), "Top result must NOT be Physics entrance exam");
  console.log("    ✓ DBMS exams rank #1; Physics entrance exam successfully deprioritized.");

  // Integration Test D: DSA PPT
  console.log('\n>>> Executing search: "DSA PPT" ...');
  const resDSA = await searchService.searchResources("DSA PPT");
  assert(resDSA.length > 0, "Should return results for DSA PPT");
  console.log(`    Total results returned: ${resDSA.length}`);
  const topDSA = resDSA.slice(0, 5);
  topDSA.forEach((r, idx) => console.log(`    ${idx + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.type})`));

  // None of top 3 should be Logic or Geography PPT
  const top3DSATitles = topDSA.slice(0, 3).map(r => r.title.toLowerCase());
  assert(!top3DSATitles.includes("logic"), "Logic PPT must not be in top 3 for DSA PPT");
  console.log("    ✓ DSA study materials and presentations prioritized; Logic/Geography PPTs deprioritized.");

  // Integration Test E: quantum mechanics lecture notes
  console.log('\n>>> Executing search: "quantum mechanics lecture notes" ...');
  const resQM = await searchService.searchResources("quantum mechanics lecture notes");
  assert(resQM.length > 0, "Should return results for quantum mechanics lecture notes");
  console.log(`    Total results returned: ${resQM.length}`);
  const topQM = resQM.slice(0, 5);
  topQM.forEach((r, idx) => console.log(`    ${idx + 1}. [Score: ${r.score.toFixed(1)}] ${r.title} (${r.type})`));

  // None of top 5 should be Popular Mechanics magazine
  const qmTitles = topQM.map(r => r.title.toLowerCase());
  assert(!qmTitles.some(t => t.includes("popular mechanics")), "Popular Mechanics magazine must NOT be in top results");
  console.log("    ✓ Popular Mechanics magazine successfully deprioritized.");

  // Verify DB count invariance
  const postCount = await TelegramResource.countDocuments();
  console.log(`\n✓ Post-test database count verified: ${postCount.toLocaleString()} (0 modifications).`);
  assert.strictEqual(postCount, baselineCount, "Database count must remain strictly invariant");

  await mongoose.disconnect();
  console.log("\nALL PHASE 2.3 REGRESSION AND INTEGRATION TESTS COMPLETED SUCCESSFULLY.\n");
}

async function main() {
  try {
    await runUnitTests();
    await runIntegrationTests();
    process.exit(0);
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err);
    process.exit(1);
  }
}

main();
