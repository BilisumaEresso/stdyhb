const assert = require("assert");
const suggestionService = require("../src/search/suggestion.service");

console.log("=== TESTING SEARCH SUGGESTIONS LIMIT & SCROLL READINESS ===");

// 1. Test suggestionService with limit 10
const suggestions10 = suggestionService.getSuggestions("exam", { limit: 10 });
console.log(`Found ${suggestions10.length} suggestions for query "exam" (requested limit: 10)`);
assert.ok(suggestions10.length >= 8, "Should return at least 8 suggestions for high-frequency query 'exam'");

// 2. Test taxonomy-aware query
const dbmsSuggestions = suggestionService.getSuggestions("dbms", { limit: 10 });
console.log(`Found ${dbmsSuggestions.length} suggestions for query "dbms":`, dbmsSuggestions.map(s => s.text));
assert.ok(dbmsSuggestions.length >= 1, "Should find DBMS suggestions");

// 3. Test empty query (popular queries)
const defaultSuggestions = suggestionService.getSuggestions("", { limit: 10 });
console.log(`Found ${defaultSuggestions.length} default suggestions for empty query`);
assert.strictEqual(defaultSuggestions.length, 10, "Should return exactly 10 default popular suggestions");

console.log("✅ All suggestion backend tests passed successfully!");
