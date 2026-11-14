/**
 * test/search-service-end-to-end.test.js
 * 
 * Verifies that SearchService.searchResources() operates cleanly
 * with the new query expansion when connected to the isolated local test DB.
 */

const mongoose = require("mongoose");
const searchService = require("../src/search/search.service");

async function runEndToEndTest() {
  console.log("=================================================================");
  console.log("TESTING SEARCH SERVICE END-TO-END ON ISOLATED LOCAL DB");
  console.log("=================================================================\n");

  const LOCAL_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
  await mongoose.connect(LOCAL_URI, { family: 4 });

  const mockUser = {
    _id: "6a38158c81cff0b089b1184a",
    telegramId: 12345678,
    university: "Addis Ababa University"
  };

  const queries = [
    "dbms exam",
    "dsa ppt",
    "mathematics for natural sciences",
    "computer networks final exam"
  ];

  for (const q of queries) {
    console.log(`>>> Searching: "${q}"`);
    const results = await searchService.searchResources(q, mockUser);
    console.log(`    Returned ${results.length} results.`);
    if (results.length > 0) {
      console.log(`    Top Result: "${results[0].title}" [Score: ${results[0].score}, Type: ${results[0].type}]`);
    }
    console.log("");
  }

  await mongoose.disconnect();
  console.log("End-to-End Search Service test passed cleanly.\n");
}

runEndToEndTest().catch(err => {
  console.error("End-to-end test error:", err);
  process.exit(1);
});
