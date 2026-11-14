/**
 * StudyHub Phase 3.2.1 — Taxonomy-Driven Search Suggestions Test Suite
 *
 * Verifies:
 * 1. Approved category display names are recognized.
 * 2. Category aliases resolve to their correct canonical categories.
 * 3. Freshman course names and aliases resolve correctly.
 * 4. Natural Science vs Social Science mathematics remain strictly distinct.
 * 5. Legacy aliases continue working (dbms, dsa, cn, os, se, coa, ai).
 * 6. Existing curated suggestions remain available (e.g., DBMS Exam, DSA Final Exam).
 * 7. Website and Telegram integrations retain expected response shapes.
 * 8. Empty queries and short queries retain existing fallback behavior.
 */

const assert = require("assert");
const { getSuggestions, getPopularSuggestions, suggestionEngine } = require("../src/search/suggestion.service");
const {
  COLLECTIONS,
  SUBJECT_CATEGORIES,
  FRESHMAN_COURSES
} = require("../src/config/taxonomy");

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log("\n=======================================================");
console.log("  StudyHub Phase 3.2.1 — Taxonomy Suggestions Test     ");
console.log("=======================================================\n");

// ─── Group 1: Approved Category Display Names Recognition ───────────────────
console.log("Group 1: Approved Category Display Names Recognition");

runTest("All 4 official collection names exist and can be suggested", () => {
  for (const col of COLLECTIONS) {
    const suggestions = getSuggestions(col.name, { limit: 5 });
    assert(suggestions.length > 0, `No suggestions found for collection: ${col.name}`);
    assert.strictEqual(suggestions[0].text, col.name, `Expected exact match for collection: ${col.name}`);
    assert.strictEqual(suggestions[0].subjectKey, col.id, `SubjectKey mismatch for collection: ${col.name}`);
  }
});

runTest("All 21 approved category canonical display names are recognized", () => {
  for (const cat of SUBJECT_CATEGORIES) {
    const suggestions = getSuggestions(cat.name, { limit: 5 });
    assert(suggestions.length > 0, `No suggestions found for category: ${cat.name}`);
    assert.strictEqual(suggestions[0].text, cat.name, `Expected category name ${cat.name} as top result`);
  }
});

// ─── Group 2: Category Aliases Resolve to Correct Canonical Categories ───────
console.log("\nGroup 2: Category Aliases Resolve to Correct Canonical Categories");

runTest("Computing aliases resolve to 'Computing & Information Sciences'", () => {
  const suggestions = getSuggestions("computing", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Computing & Information Sciences"), `Expected Computing & Information Sciences in ${texts.join(", ")}`);
});

runTest("Natural sciences aliases resolve to 'Natural & Computational Sciences'", () => {
  const suggestions = getSuggestions("natural science", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Natural & Computational Sciences"), `Expected Natural & Computational Sciences in ${texts.join(", ")}`);
});

runTest("Health aliases resolve to 'Health & Medical Sciences'", () => {
  const suggestions = getSuggestions("health sciences", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Health & Medical Sciences"), `Expected Health & Medical Sciences in ${texts.join(", ")}`);
});

runTest("Business aliases resolve to 'Business & Economics'", () => {
  const suggestions = getSuggestions("business and economics", { limit: 5 });
  assert(suggestions.length > 0, "No suggestions for 'business and economics'");
  assert.strictEqual(suggestions[0].text, "Business & Economics");
});

runTest("Architecture aliases resolve to 'Engineering & Built Environment'", () => {
  const suggestions = getSuggestions("architecture", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Engineering & Built Environment"), `Expected Engineering & Built Environment in ${texts.join(", ")}`);
});

// ─── Group 3: Freshman Course Names and Aliases ─────────────────────────────
console.log("\nGroup 3: Freshman Course Names and Aliases Resolution");

runTest("All 18 freshman courses can be queried by name", () => {
  for (const course of FRESHMAN_COURSES) {
    const suggestions = getSuggestions(course.name, { limit: 5 });
    assert(suggestions.length > 0, `No suggestions found for course: ${course.name}`);
    assert.strictEqual(suggestions[0].text, course.name, `Expected exact match for course: ${course.name}`);
  }
});

runTest("Course code alias 'flen 1011' resolves to 'Communicative English Language Skills'", () => {
  const suggestions = getSuggestions("flen 1011", { limit: 3 });
  assert(suggestions.length > 0, "No suggestions for 'flen 1011'");
  assert.strictEqual(suggestions[0].text, "Communicative English Language Skills");
});

runTest("Geography alias 'geog 1011' resolves to 'Geography of Ethiopia and the Horn'", () => {
  const suggestions = getSuggestions("geog 1011", { limit: 3 });
  assert(suggestions.length > 0, "No suggestions for 'geog 1011'");
  assert.strictEqual(suggestions[0].text, "Geography of Ethiopia and the Horn");
});

runTest("History alias 'hist 1011' resolves to 'History of Ethiopia and the Horn'", () => {
  const suggestions = getSuggestions("hist 1011", { limit: 3 });
  assert(suggestions.length > 0, "No suggestions for 'hist 1011'");
  assert.strictEqual(suggestions[0].text, "History of Ethiopia and the Horn");
});

runTest("Logic alias 'critical thinking' resolves to 'Logic and Critical Thinking'", () => {
  const suggestions = getSuggestions("critical thinking", { limit: 3 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Logic and Critical Thinking"), `Expected Logic and Critical Thinking in ${texts.join(", ")}`);
});

runTest("Civics alias 'mcve' or 'civics' resolves to 'Moral and Civic Education'", () => {
  const suggestions = getSuggestions("mcve", { limit: 3 });
  assert.strictEqual(suggestions[0].text, "Moral and Civic Education");
});

runTest("Emerging tech alias 'emtech' resolves to 'Introduction to Emerging Technologies'", () => {
  const suggestions = getSuggestions("emtech", { limit: 3 });
  assert.strictEqual(suggestions[0].text, "Introduction to Emerging Technologies");
});

runTest("Inclusiveness alias 'snie' resolves to 'Inclusiveness'", () => {
  const suggestions = getSuggestions("snie", { limit: 3 });
  assert.strictEqual(suggestions[0].text, "Inclusiveness");
});

// ─── Group 4: Natural Science vs Social Science Mathematics ─────────────────
console.log("\nGroup 4: Natural Science vs Social Science Mathematics Distinction");

runTest("'math nat' prioritizes Mathematics for Natural Sciences without matching Social Sciences", () => {
  const suggestions = getSuggestions("math nat", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert.strictEqual(texts[0], "Mathematics for Natural Sciences", `Top result must be Natural Sciences math, got ${texts[0]}`);
  assert(!texts.includes("Mathematics for Social Sciences"), "Social Sciences math must NOT match 'math nat'");
});

runTest("'math soc' prioritizes Mathematics for Social Sciences without matching Natural Sciences", () => {
  const suggestions = getSuggestions("math soc", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert.strictEqual(texts[0], "Mathematics for Social Sciences", `Top result must be Social Sciences math, got ${texts[0]}`);
  assert(!texts.includes("Mathematics for Natural Sciences"), "Natural Sciences math must NOT match 'math soc'");
});

runTest("Course code 'math 1011' resolves to Natural Sciences math", () => {
  const suggestions = getSuggestions("math 1011", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Mathematics for Natural Sciences"), `Expected Natural Sciences math for Math 1011, got ${texts.join(", ")}`);
  assert(!texts.includes("Mathematics for Social Sciences"), "Social Sciences math must NOT match 'math 1011'");
});

runTest("Course code 'math 1012' resolves to Social Sciences math", () => {
  const suggestions = getSuggestions("math 1012", { limit: 5 });
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("Mathematics for Social Sciences"), `Expected Social Sciences math for Math 1012, got ${texts.join(", ")}`);
  assert(!texts.includes("Mathematics for Natural Sciences"), "Natural Sciences math must NOT match 'math 1012'");
});

// ─── Group 5: Legacy Aliases Continue Working ───────────────────────────────
console.log("\nGroup 5: Legacy Aliases Continue Working");

const legacyAcronyms = [
  { query: "dbms", expectedAcronym: "DBMS", expectedCanonical: "Database Management Systems" },
  { query: "dsa", expectedAcronym: "DSA", expectedCanonical: "Data Structures and Algorithms" },
  { query: "cn", expectedAcronym: "CN", expectedCanonical: "Computer Networks" },
  { query: "os", expectedAcronym: "OS", expectedCanonical: "Operating Systems" },
  { query: "se", expectedAcronym: "SE", expectedCanonical: "Software Engineering" },
  { query: "coa", expectedAcronym: "COA", expectedCanonical: "Computer Organization" },
  { query: "ai", expectedAcronym: "AI", expectedCanonical: "Artificial Intelligence" }
];

for (const { query, expectedAcronym, expectedCanonical } of legacyAcronyms) {
  runTest(`Legacy alias '${query}' yields '${expectedAcronym}' as #1 and contains '${expectedCanonical}'`, () => {
    const suggestions = getSuggestions(query, { limit: 5 });
    assert(suggestions.length > 0, `No suggestions for ${query}`);
    assert.strictEqual(suggestions[0].text, expectedAcronym, `Expected ${expectedAcronym} as rank 1, got ${suggestions[0].text}`);
    const texts = suggestions.map(s => s.text);
    assert(texts.some(t => t.includes(expectedCanonical)), `Expected ${expectedCanonical} in suggestions: ${texts.join(", ")}`);
  });
}

// ─── Group 6: Existing Curated Suggestions Remain Available ─────────────────
console.log("\nGroup 6: Existing Curated Suggestions Remain Available");

const curatedTests = [
  { query: "dbms exam", expected: "DBMS Exam" },
  { query: "dsa final", expected: "DSA Final Exam" },
  { query: "calculus i", expected: "Calculus I Past Exam" },
  { query: "physics mid", expected: "General Physics Mid Exam" }
];

for (const { query, expected } of curatedTests) {
  runTest(`Curated query '${query}' surfaces '${expected}'`, () => {
    const suggestions = getSuggestions(query, { limit: 5 });
    const texts = suggestions.map(s => s.text);
    assert(texts.includes(expected), `Expected ${expected} in results for ${query}: ${texts.join(", ")}`);
  });
}

// ─── Group 7: Website and Telegram Integration Shapes ───────────────────────
console.log("\nGroup 7: Website and Telegram Integration Shapes");

runTest("Suggestions items strictly adhere to { text, type, subjectKey } contract", () => {
  const suggestions = getSuggestions("comp", { limit: 10 });
  assert(suggestions.length > 0, "No suggestions for 'comp'");
  for (const s of suggestions) {
    assert(typeof s.text === "string" && s.text.length > 0, "Invalid text property");
    assert(["subject", "course", "popular", "recent"].includes(s.type), `Invalid type property: ${s.type}`);
    if (s.subjectKey) {
      assert(typeof s.subjectKey === "string", "subjectKey should be string if present");
    }
  }
});

runTest("Simulated Express API endpoint returns standard { success: true, data: [...] }", () => {
  const req = { query: { q: "math", limit: "5" } };
  let jsonOutput = null;
  const res = { json: (obj) => { jsonOutput = obj; } };

  const limitNum = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));
  const data = getSuggestions(req.query.q, { limit: limitNum });
  res.json({ success: true, data });

  assert(jsonOutput !== null, "res.json was not executed");
  assert.strictEqual(jsonOutput.success, true);
  assert(Array.isArray(jsonOutput.data));
  assert.strictEqual(jsonOutput.data.length, 5);
});

runTest("Simulated Telegram Inline query returns array with limit capping", () => {
  const inlineSuggestions = getSuggestions("phy", { limit: 3 });
  assert(Array.isArray(inlineSuggestions));
  assert(inlineSuggestions.length <= 3);
  assert(inlineSuggestions.every(s => typeof s.text === "string" && s.text.length > 0));
});

// ─── Group 8: Empty and Short Query Fallback Behavior ───────────────────────
console.log("\nGroup 8: Empty and Short Query Fallback Behavior");

runTest("Empty query returns recent searches followed by canonical popular items", () => {
  const recent = ["Calculus Chapter 2", "Exit Exam Guide"];
  const suggestions = getSuggestions("", { limit: 6, recentSearches: recent });
  assert.strictEqual(suggestions.length, 6);
  assert.strictEqual(suggestions[0].text, "Calculus Chapter 2");
  assert.strictEqual(suggestions[0].type, "recent");
  assert.strictEqual(suggestions[1].text, "Exit Exam Guide");
  assert.strictEqual(suggestions[1].type, "recent");
  assert.strictEqual(suggestions[2].type, "popular");
});

runTest("Empty query without recent searches returns canonical popular defaults", () => {
  const suggestions = getPopularSuggestions(8);
  assert.strictEqual(suggestions.length, 8);
  assert(suggestions.every(s => s.type === "popular"));
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("DBMS Exam"));
  assert(texts.includes("DSA Final Exam"));
  assert(texts.includes("Computing & Information Sciences"));
});

runTest("1-letter queries execute gracefully without errors", () => {
  for (const char of ["a", "c", "m", "p", "e", "s"]) {
    const suggestions = getSuggestions(char, { limit: 5 });
    assert(Array.isArray(suggestions));
    assert(suggestions.length <= 5);
  }
});

runTest("Limit capping clamps to maximum of 20 items", () => {
  const suggestions = getSuggestions("e", { limit: 100 });
  assert(suggestions.length <= 20, `Expected max 20 items, got ${suggestions.length}`);
});

runTest("Output contains zero duplicate normalized titles across all test queries", () => {
  const queries = ["comp", "math", "exam", "ethiopia", "science", "dsa", "c", "eng", "net"];
  for (const q of queries) {
    const suggestions = getSuggestions(q, { limit: 20 });
    const seen = new Set();
    for (const item of suggestions) {
      const norm = item.text.toLowerCase().trim();
      assert(!seen.has(norm), `Duplicate title detected for '${q}': '${item.text}'`);
      seen.add(norm);
    }
  }
});

console.log("\n=======================================================");
console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed  `);
console.log("=======================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
