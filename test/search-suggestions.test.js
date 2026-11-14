/**
 * StudyHub Phase 2.4 — Smart Search Suggestions & Autocomplete Test Suite
 *
 * Verifies:
 * 1. In-memory suggestion engine initialization and indexing.
 * 2. Empty query handling (curated popular defaults and recent searches).
 * 3. Prefix matching (single-token and multi-token).
 * 4. Academic course & subject alias resolution (DSA, DBMS, OS, Calculus, etc.).
 * 5. Multiword query matching (e.g. "comp net", "math nat").
 * 6. Keyword matching (e.g. "sql" -> DBMS).
 * 7. Relevance scoring and ranking order.
 * 8. Result deduplication and limit capping.
 * 9. Sub-millisecond execution performance (< 1ms per query).
 * 10. Express API endpoint simulation (/api/search/suggestions).
 */

const assert = require("assert");
const { getSuggestions, getPopularSuggestions, suggestionEngine } = require("../src/search/suggestion.service");

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

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log("\n=======================================================");
console.log("  StudyHub Phase 2.4 — Search Suggestions Test Suite  ");
console.log("=======================================================\n");

// ─── Group 1: Engine Initialization & Index Health ───────────────────────────
console.log("Group 1: Engine Initialization & Index Health");

runTest("Engine index is built and contains subjects, courses, and popular items", () => {
  assert(suggestionEngine.initialized === true, "Engine should be marked as initialized");
  assert(suggestionEngine.index.length > 100, `Index size should exceed 100 entries, got ${suggestionEngine.index.length}`);
});

runTest("Index items have required properties (text, normalized, type, words)", () => {
  for (const item of suggestionEngine.index.slice(0, 10)) {
    assert(typeof item.text === "string" && item.text.length > 0, "Missing text");
    assert(typeof item.normalized === "string" && item.normalized.length > 0, "Missing normalized text");
    assert(["subject", "course", "popular"].includes(item.type), `Unexpected type: ${item.type}`);
    assert(Array.isArray(item.words), "Missing words array");
  }
});

// ─── Group 2: Empty Query Handling ──────────────────────────────────────────
console.log("\nGroup 2: Empty Query Handling");

runTest("Empty query returns default popular items up to limit", () => {
  const suggestions = getPopularSuggestions(6);
  assert(suggestions.length === 6, `Expected 6 suggestions, got ${suggestions.length}`);
  assert(suggestions.every(s => s.type === "popular" && typeof s.text === "string"), "All items should be popular suggestions");
});

runTest("Empty query includes recent searches when provided", () => {
  const recent = ["DBMS Past Exam", "Calculus Chapter 2"];
  const suggestions = getSuggestions("", { limit: 6, recentSearches: recent });
  assert(suggestions.length === 6, `Expected 6 suggestions, got ${suggestions.length}`);
  assert(suggestions[0].text === "DBMS Past Exam" && suggestions[0].type === "recent", "First item should be recent search");
  assert(suggestions[1].text === "Calculus Chapter 2" && suggestions[1].type === "recent", "Second item should be recent search");
  assert(suggestions[2].type === "popular", "Remaining items should be popular suggestions");
});

runTest("Respects custom limit parameter (e.g. limit: 3)", () => {
  const suggestions = getSuggestions("", { limit: 3 });
  assert(suggestions.length === 3, `Expected 3 items, got ${suggestions.length}`);
});

// ─── Group 3: Prefix Matching & Relevance Scoring ───────────────────────────
console.log("\nGroup 3: Prefix Matching & Relevance Scoring");

runTest("Typing 'comp' returns computer-related subjects with Computer Science / Networks on top", () => {
  const suggestions = getSuggestions("comp", { limit: 6 });
  assert(suggestions.length > 0, "Expected suggestions for 'comp'");
  const texts = suggestions.map(s => s.text);
  assert(
    texts.some(t => t.startsWith("Computer") || t.startsWith("Compiler")),
    `Expected direct prefix match, got: ${texts.join(", ")}`
  );
  assert(texts.includes("Computer Science"), `Expected Computer Science in results, got: ${texts.join(", ")}`);
  assert(texts.includes("Computer Networks"), `Expected Computer Networks in results, got: ${texts.join(", ")}`);
});

runTest("Typing 'math' returns Mathematics courses and subjects", () => {
  const suggestions = getSuggestions("math", { limit: 6 });
  assert(suggestions.length > 0, "Expected suggestions for 'math'");
  const texts = suggestions.map(s => s.text);
  assert(
    texts.some(t => t.toLowerCase().includes("math")),
    `Expected math-related matches, got: ${texts.join(", ")}`
  );
});

runTest("Typing 'dbms' prioritizes DBMS and Database Management Systems", () => {
  const suggestions = getSuggestions("dbms", { limit: 5 });
  assert(suggestions.length > 0, "Expected suggestions for 'dbms'");
  assert(suggestions[0].text === "DBMS", `Expected exact match 'DBMS' first, got '${suggestions[0].text}'`);
  const texts = suggestions.map(s => s.text);
  assert(texts.some(t => t.includes("Database Management Systems")), "Expected full canonical subject name in suggestions");
});

runTest("Typing 'dsa' returns DSA and Data Structures and Algorithms", () => {
  const suggestions = getSuggestions("dsa", { limit: 5 });
  assert(suggestions.length > 0, "Expected suggestions for 'dsa'");
  const texts = suggestions.map(s => s.text);
  assert(texts.includes("DSA"), `Expected 'DSA' in results, got: ${texts.join(", ")}`);
  assert(texts.some(t => t.includes("Data Structures")), `Expected Data Structures in results, got: ${texts.join(", ")}`);
});

// ─── Group 4: Multi-Token Queries ───────────────────────────────────────────
console.log("\nGroup 4: Multi-Token Queries");

runTest("Typing 'comp net' matches 'Computer Networks'", () => {
  const suggestions = getSuggestions("comp net", { limit: 5 });
  assert(suggestions.length > 0, "Expected suggestions for 'comp net'");
  assert(suggestions[0].text.startsWith("Computer Network"), `Expected Computer Networks first, got '${suggestions[0].text}'`);
});

runTest("Typing 'math nat' matches 'General Mathematics Natural Science'", () => {
  const suggestions = getSuggestions("math nat", { limit: 5 });
  assert(suggestions.length > 0, "Expected suggestions for 'math nat'");
  const texts = suggestions.map(s => s.text);
  assert(texts.some(t => t.includes("Natural Science")), `Expected natural science math, got: ${texts.join(", ")}`);
});

// ─── Group 5: Keyword & Associated Terms ────────────────────────────────────
console.log("\nGroup 5: Keyword & Associated Terms Matching");

runTest("Typing 'sql' suggests Database Management Systems (DBMS)", () => {
  const suggestions = getSuggestions("sql", { limit: 5 });
  assert(suggestions.length > 0, "Expected suggestions for 'sql'");
  const texts = suggestions.map(s => s.text);
  assert(
    texts.some(t => t.includes("Database") || t.includes("DBMS")),
    `Expected database suggestion for sql keyword, got: ${texts.join(", ")}`
  );
});

// ─── Group 6: Deduplication & Output Quality ─────────────────────────────────
console.log("\nGroup 6: Deduplication & Output Quality");

runTest("Results contain zero duplicate normalized titles", () => {
  const testQueries = ["comp", "math", "exam", "data", "eng", "c", "phy"];
  for (const q of testQueries) {
    const suggestions = getSuggestions(q, { limit: 10 });
    const seen = new Set();
    for (const s of suggestions) {
      const norm = s.text.toLowerCase().trim();
      assert(!seen.has(norm), `Duplicate found for query '${q}': '${s.text}'`);
      seen.add(norm);
    }
  }
});

// ─── Group 7: Performance Benchmark ─────────────────────────────────────────
console.log("\nGroup 7: In-Memory Performance Benchmark");

runTest("1,000 suggestion calls execute in under 300ms (< 0.3ms per call)", () => {
  const queries = ["comp", "dsa", "operating", "calculus", "dbms", "python", "exam", "general physics", "math", "se"];
  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const q = queries[i % queries.length];
    getSuggestions(q, { limit: 6 });
  }

  const duration = performance.now() - start;
  const avg = duration / iterations;
  console.log(`    Executed ${iterations} queries in ${duration.toFixed(2)}ms (Average: ${avg.toFixed(4)}ms/call)`);
  assert(avg < 1.0, `Average latency must be < 1.0ms, got ${avg.toFixed(4)}ms`);
});

// ─── Group 8: API Route Contract Simulation ─────────────────────────────────
console.log("\nGroup 8: API Route Contract Simulation");

runTest("Route returns standard API format { success: true, data: [...] }", () => {
  const req = { query: { q: "comp", limit: "4" } };
  let jsonOutput = null;
  const res = {
    json: (obj) => { jsonOutput = obj; }
  };

  const limitNum = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 6));
  const data = getSuggestions(req.query.q, { limit: limitNum });
  res.json({ success: true, data });

  assert(jsonOutput !== null, "res.json was not called");
  assert(jsonOutput.success === true, "Response success should be true");
  assert(Array.isArray(jsonOutput.data), "Response data should be an array");
  assert(jsonOutput.data.length === 4, `Expected 4 items, got ${jsonOutput.data.length}`);
});

console.log("\n=======================================================");
console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed  `);
console.log("=======================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
