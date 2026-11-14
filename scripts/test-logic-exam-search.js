require("dotenv").config();
const mongoose = require("mongoose");
const searchService = require("../src/search/search.service");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== Testing Search for 'logic exam' ===");
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
run().catch(console.error);
