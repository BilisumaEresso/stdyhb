require("dotenv").config();
const mongoose = require("mongoose");
const searchService = require("../src/search/search.service");
const CachedSearch = require("../src/db/models/CachedSearch");
const TelegramResource = require("../src/db/models/TelegramResource");

async function runComprehensiveVerification() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("================================================================================");
  console.log("🔍 COMPREHENSIVE DEDUPLICATION & SEARCH VERIFICATION");
  console.log("================================================================================\n");

  // Clear cache to ensure end-to-end fresh pipeline
  await CachedSearch.deleteMany({});
  console.log("✅ CachedSearch flushed.\n");

  const testQueries = ["logic exam", "psychology", "maths"];

  for (const query of testQueries) {
    console.log(`----------------------------------------------------------------`);
    console.log(`🔎 Testing Search Query: "${query}"`);
    console.log(`----------------------------------------------------------------`);
    const results = await searchService.searchResources(query, null);
    console.log(`Total results: ${results.length}`);

    // Check for any exact (fileName + fileSize) duplicates in the results
    const fileSeen = new Map();
    let dupeCount = 0;
    const dupesList = [];

    results.forEach((r, idx) => {
      const fn = (r.fileName || "").trim().toLowerCase();
      const fs = Number(r.fileSize) || 0;
      if (fn && fs > 0) {
        const key = `${fn}::${fs}`;
        if (fileSeen.has(key)) {
          dupeCount++;
          dupesList.push({ key, firstIdx: fileSeen.get(key), secondIdx: idx });
        } else {
          fileSeen.set(key, idx);
        }
      }
    });

    console.log(`Exact duplicate files in search results: ${dupeCount}`);
    if (dupeCount > 0) {
      console.log("  ⚠️ Duplicates found:", dupesList);
    } else {
      console.log("  ✅ Zero duplicate files found in results!");
    }

    console.log(`\nTop 5 Results for "${query}":`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`  [${i + 1}] "${r.title}"`);
      console.log(`      Ch: @${r.channelUsername} | Type: ${r.type} | Score: ${r.score.toFixed(1)}`);
      console.log(`      File: "${r.fileName || 'N/A'}" (${r.fileSize || 0} bytes)`);
      if (r.alternativeSources && r.alternativeSources.length > 0) {
        console.log(`      🔄 Alternative Sources (${r.channelCount} channels): ${r.alternativeSources.map(s => '@' + s.channelUsername).join(', ')}`);
      }
    });
    console.log("");
  }

  // Check Database Integrity
  console.log("----------------------------------------------------------------");
  console.log("📊 Database Integrity Summary");
  console.log("----------------------------------------------------------------");
  const totalAvailable = await TelegramResource.countDocuments({ isAvailable: true });
  const totalPruned = await TelegramResource.countDocuments({ isAvailable: false });
  const commercialSpamCount = await TelegramResource.countDocuments({
    $or: [
      { caption: /ExamClass_RegBot/i },
      { caption: /FreshmanMasterClassBot/i },
      { caption: /AVACOIN/i }
    ]
  });

  console.log(`Total active available resources in DB: ${totalAvailable}`);
  console.log(`Total pruned duplicate/spam resources in DB: ${totalPruned}`);
  console.log(`Commercial/crypto spam resources remaining: ${commercialSpamCount} (Must be 0)`);

  await mongoose.disconnect();
  console.log("\n✅ Comprehensive verification complete!");
}
runComprehensiveVerification().catch(console.error);
