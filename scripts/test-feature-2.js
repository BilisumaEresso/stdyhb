require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const searchService = require("../src/services/search.service");
const templates = require("../src/telegram/templates");
const SearchHistory = require("../src/db/models/SearchHistory");
const QuerySession = require("../src/db/models/QuerySession");

async function runTests() {
  console.log("=== Testing Feature 2: Clickable Recent Searches & Dynamic Suggestions ===");
  await mongoose.connect(process.env.MONGO_URI);

  const testUserId = new mongoose.Types.ObjectId();

  try {
    // 1. Test Dynamic Global Suggestions (Empty State)
    const globalSuggestions = await searchService.getGlobalSuggestions(4);
    console.log("✔ Global suggestions derived from DB:", globalSuggestions);
    assert.ok(Array.isArray(globalSuggestions), "Global suggestions should be an array");
    assert.ok(globalSuggestions.length > 0 && globalSuggestions.length <= 4, "Should return up to 4 suggestions");

    // 2. Test User Search Recording and Distinct Recent Searches
    await searchService.saveSearchHistory(testUserId, "operating systems");
    await searchService.saveSearchHistory(testUserId, "data structures");
    await searchService.saveSearchHistory(testUserId, "operating systems"); // Duplicate
    await searchService.saveSearchHistory(testUserId, "dbms exam final");

    const recentSearches = await searchService.getUserRecentSearches(testUserId, 4);
    console.log("✔ Distinct user recent searches:", recentSearches);
    assert.strictEqual(recentSearches.length, 3, "Duplicates must be collapsed");
    assert.strictEqual(recentSearches[0], "dbms exam final", "Most recent search should be first");
    assert.strictEqual(recentSearches[1], "operating systems", "Second most recent");
    assert.strictEqual(recentSearches[2], "data structures", "Third most recent");

    // 3. Test Prompt Generation with Recent Searches
    const recentItems = [
      { query: "dbms exam final", hash: "a1b2c3d4" },
      { query: "operating systems", hash: "e5f6g7h8" }
    ];
    const promptWithRecent = templates.renderSearchPrompt(recentItems, []);
    assert.ok(promptWithRecent.text.includes("Recent Searches"), "Should show Recent Searches title");
    assert.ok(promptWithRecent.keyboard.some(row => row.some(btn => btn.callback_data === "clear_search_history")), "Should have Clear History button");
    
    // Check callback length limit (Telegram max 64 bytes)
    promptWithRecent.keyboard.forEach(row => {
      row.forEach(btn => {
        if (btn.callback_data) {
          assert.ok(btn.callback_data.length <= 64, `Callback data too long: ${btn.callback_data}`);
        }
      });
    });
    console.log("✔ Search prompt with recent searches verified (callbacks <= 64 bytes)");

    // 4. Test Prompt Generation for Empty State (Dynamic Suggestions)
    const sugItems = globalSuggestions.map((s, idx) => ({ query: s, hash: `sug_${idx}` }));
    const promptEmpty = templates.renderSearchPrompt([], sugItems);
    assert.ok(promptEmpty.text.includes("Popular Searches & Topics"), "Should show Popular Searches title");
    assert.ok(!promptEmpty.text.includes("Recent Searches"), "Should not show Recent Searches");
    assert.ok(promptEmpty.keyboard.length > 0, "Should have suggestion buttons");
    console.log("✔ Empty state with dynamic global suggestions verified");

    // 5. Test Clear User Search History
    await searchService.clearUserSearchHistory(testUserId);
    const afterClear = await searchService.getUserRecentSearches(testUserId, 4);
    assert.strictEqual(afterClear.length, 0, "History should be completely cleared");
    console.log("✔ Clear user search history verified");

    console.log("\nALL FEATURE 2 TESTS PASSED SUCCESSFULLY! 🚀");
  } finally {
    // Clean up test data
    await SearchHistory.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error("Feature 2 Test Error:", err);
  process.exit(1);
});
