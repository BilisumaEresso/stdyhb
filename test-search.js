require("dotenv").config();
const mongoose = require("mongoose");
const searchService = require("./src/search/search.service");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ DB connected");

  // Sync indexes to ensure text index is built before querying
  const TelegramResource = require("./src/db/models/TelegramResource");
  await TelegramResource.syncIndexes();
  console.log("✅ Indexes synchronized");

  // Clear search cache to ensure fresh results
  const CachedSearch = require("./src/db/models/CachedSearch");
  await CachedSearch.deleteMany({});
  console.log("✅ Cache cleared");

  // Create a mock user since searchResources expects one
  const mockUser = { _id: "mock_user_id", telegramId: 12345 };

  const queries = ["dbms exam", "management", "networking"];

  for (const q of queries) {
    console.log(`\n================================`);
    console.log(`Testing query: "${q}"`);
    console.log(`================================`);
    
    const results = await searchService.searchResources(q, mockUser);
    
    console.log(`\nResults returned: ${results.length}`);
    results.forEach((r, i) => {
      console.log(`  ${i + 1}. [${r.score}] ${r.title.substring(0, 50)} (${r.source} - ${r.type})`);
      if (r.tags && r.tags.length > 0) {
        console.log(`     Tags: ${r.tags.join(", ")}`);
      }
    });
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(console.error);
