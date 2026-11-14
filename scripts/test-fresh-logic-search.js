require("dotenv").config();
const mongoose = require("mongoose");
const CachedSearch = require("../src/db/models/CachedSearch");
const searchService = require("../src/search/search.service");

async function testFreshSearch() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Clearing CachedSearch...");
  const deleted = await CachedSearch.deleteMany({});
  console.log(`Deleted ${deleted.deletedCount} cached searches.`);

  console.log("\n=== Testing Search for 'logic exam' (Fresh) ===");
  const results = await searchService.searchResources("logic exam", null);
  console.log(`Total results returned: ${results.length}`);
  console.log("\nTop 15 results for 'logic exam':");
  results.slice(0, 15).forEach((r, i) => {
    console.log(`[${i + 1}] ID: ${r._id}`);
    console.log(`    Title: "${r.title}" | Ch: @${r.channelUsername} | Type: ${r.type}`);
    console.log(`    File: "${r.fileName || 'N/A'}" | Size: ${r.fileSize} bytes`);
    console.log(`    GroupId: ${r.groupId || 'null'} | isGrouped: ${r._isGrouped || false} | groupSize: ${r.groupSize || 1}`);
    console.log(`    Score: ${r.score} | Url: ${r.url}`);
    console.log(`    Caption: "${(r.caption || '').replace(/\r?\n/g, ' ').slice(0, 80)}..."\n`);
  });

  await mongoose.disconnect();
}
testFreshSearch().catch(console.error);
