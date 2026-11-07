require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const searchService = require("../src/search/search.service");
const { generateDisplayTitle } = require("../src/utils/titleGenerator");

async function runTests() {
  console.log("====================================================");
  console.log("🧪 COMPLETE QUALITY OVERHAUL VERIFICATION SUITE");
  console.log("====================================================\n");

  await mongoose.connect(process.env.MONGO_URI);

  // Test 1: Popularity score boost calibration
  console.log("Test 1: Calibrated ISR Popularity Boosting...");
  const dummyQuery = "physics";
  const dummyIntent = { explicitFormat: false };
  const mockHighDl = { downloadCount: 5, fileType: "pdf", tags: ["physics"] };
  const mockLowDl = { downloadCount: 0, fileType: "pdf", tags: ["physics"] };
  
  const scoreHigh = searchService.calculateTelegramScore(mockHighDl, dummyQuery, 10, dummyIntent, null);
  const scoreLow = searchService.calculateTelegramScore(mockLowDl, dummyQuery, 10, dummyIntent, null);
  const boostDiff = scoreHigh - scoreLow;

  if (boostDiff === 150) {
    console.log(`✅ Test 1 Passed: 5+ downloads receives exact +150 boost (high=${scoreHigh}, low=${scoreLow})`);
  } else {
    console.error(`❌ Test 1 Failed: boostDiff was ${boostDiff}, expected 150`);
    process.exit(1);
  }

  // Test 2: Clean title coverage in DB
  console.log("\nTest 2: Clean Title Coverage in MongoDB...");
  const missingCleanTitle = await TelegramResource.countDocuments({
    isAvailable: { $ne: false },
    $or: [{ cleanTitle: "" }, { cleanTitle: null }, { cleanTitle: { $exists: false } }]
  });
  console.log(`Active resources missing cleanTitle: ${missingCleanTitle}`);
  if (missingCleanTitle === 0) {
    console.log("✅ Test 2 Passed: 100% of active resources have cleanTitle populated.");
  } else {
    console.error(`❌ Test 2 Failed: ${missingCleanTitle} resources missing cleanTitle`);
    process.exit(1);
  }

  // Test 3: Search rankings for popular queries
  console.log("\nTest 3: Live Search Ranking & Title Quality...");
  const searchResults = await searchService.searchTelegramResources("OOP", { explicitFormat: false }, null);
  console.log(`Found ${searchResults.length} results for 'OOP'. Top 5:`);
  searchResults.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. [score=${r.score}] dl=${r.downloadCount} [${r.fileType}] "${r.title}"`);
  });

  const allTitlesClean = searchResults.slice(0, 10).every(r => {
    return !/\.(pdf|pptx?|docx?)\b/i.test(r.title) && !/@\w+/.test(r.title) && r.title.length <= 66;
  });

  if (allTitlesClean) {
    console.log("✅ Test 3 Passed: All top search results have clean, normalized titles without extensions or handles.");
  } else {
    console.error("❌ Test 3 Failed: Dirty title found in search results!");
    process.exit(1);
  }

  // Test 4: Single images count check
  console.log("\nTest 4: Integrity of Single Images vs Grouped Albums...");
  const activeSingleImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: null,
    isAvailable: { $ne: false }
  });
  const activeGroupedImages = await TelegramResource.countDocuments({
    fileType: "image",
    groupId: { $ne: null },
    isAvailable: { $ne: false }
  });

  console.log(`Active single images:  ${activeSingleImages} (Expected: 0)`);
  console.log(`Active grouped images: ${activeGroupedImages} (Expected: >17,000)`);

  if (activeSingleImages === 0 && activeGroupedImages > 17000) {
    console.log("✅ Test 4 Passed: 0 active single images, grouped exam albums 100% protected.");
  } else {
    console.error("❌ Test 4 Failed: Count mismatch!");
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log("\n====================================================");
  console.log("🎉 ALL QUALITY OVERHAUL VERIFICATION TESTS PASSED!");
  console.log("====================================================");
}

runTests().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
