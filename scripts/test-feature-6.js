const assert = require("assert");
const { getZeroResultSuggestions } = require("../src/search/typoCorrector");
const templates = require("../src/telegram/templates");

console.log("=== Testing Feature 6: Smart 'Did you mean...' Suggestions on 0 results ===");

// 1. Test Typo Correction Engine
const sug1 = getZeroResultSuggestions("calcullus", 3);
assert.ok(sug1.includes("calculus"), "Should suggest 'calculus' for 'calcullus'");
console.log("✔ Typo 'calcullus' ->", sug1);

const sug2 = getZeroResultSuggestions("phsyics exam", 3);
assert.ok(sug2.includes("physics exam"), "Should suggest 'physics exam' for 'phsyics exam'");
console.log("✔ Typo 'phsyics exam' ->", sug2);

const sug3 = getZeroResultSuggestions("dbsm notes", 3);
assert.ok(sug3.includes("dbms notes"), "Should suggest 'dbms notes' for 'dbsm notes'");
console.log("✔ Typo 'dbsm notes' ->", sug3);

const sug4 = getZeroResultSuggestions("advanced database systems 2023 questions", 3);
assert.ok(sug4.some(s => s.includes("database")), "Should relax long query to core subject");
console.log("✔ Long query relaxation ->", sug4);

// 2. Test renderNoResults Output & Keyboard
const mockSuggestions = [
  { query: "physics exam", hash: "a1b2c3d4" },
  { query: "calculus", hash: "e5f6g7h8" }
];

const result = templates.renderNoResults("phsyics eaxm", mockSuggestions);
assert.ok(result.text.includes("No direct matches for"), "Should state no direct matches");
assert.ok(result.text.includes("Did you mean one of these"), "Should prompt Did you mean");
assert.strictEqual(result.keyboard.length, 2, "Should have 2 suggestion buttons");
assert.strictEqual(result.keyboard[0][0].callback_data, "qsearch_a1b2c3d4");
assert.ok(result.keyboard[0][0].text.includes("physics exam"));

// Check Telegram callback 64-byte limit
result.keyboard.forEach(row => {
  row.forEach(btn => {
    assert.ok(btn.callback_data.length <= 64, `Callback too long: ${btn.callback_data}`);
  });
});
console.log("✔ renderNoResults UI markup and callback bounds verified");

// 3. Test String conversion backward compatibility
const str = String(result);
assert.strictEqual(typeof str, "string");
assert.ok(str.includes("No direct matches"));
console.log("✔ String coercion backward-compatibility verified");

console.log("\nALL FEATURE 6 TESTS PASSED SUCCESSFULLY! 🚀");
