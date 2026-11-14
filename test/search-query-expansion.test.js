/**
 * test/search-query-expansion.test.js
 * 
 * PHASE 2.1 — REGRESSION & VERIFICATION TEST SUITE
 * Verifies MongoDB text search query expansion, subject alias recognition,
 * multiword alias preservation, and zero OR-token introduction.
 */

const assert = require("assert");
const { expandQuery, SUBJECT_ALIASES } = require("../src/config/subjectAliases");
const { correctTypos } = require("../src/search/typoCorrector");

function runUnitTests() {
  console.log("=================================================================");
  console.log("RUNNING PHASE 2.1 QUERY EXPANSION REGRESSION UNIT TESTS");
  console.log("=================================================================\n");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}\n`);
    }
  }

  // TEST A: Input "dbms exam"
  test("Test A: Input 'dbms exam'", () => {
    const res = expandQuery("dbms exam");

    // 1. DBMS aliases resolve correctly
    assert(res.appliedAliases.includes("dbms"), "Expected appliedAliases to include 'dbms'");

    // 2. Exam remains present
    assert(/\bexam\b/i.test(res.expanded), "Expected 'exam' to remain present in expanded query");

    // 3. No standalone OR operator generated
    assert(!/\bOR\b/.test(res.expanded), `Expected query NOT to contain standalone OR token, got: "${res.expanded}"`);

    // 4. Expanded query includes canonical database term
    assert(/\bdatabase\b/i.test(res.expanded), "Expected expanded query to include canonical term 'database'");

    // 5. Structure matches contract
    assert.strictEqual(res.original, "dbms exam");
    assert.strictEqual(res.expanded, "dbms database exam");
  });

  // TEST B: Input "dsa ppt"
  test("Test B: Input 'dsa ppt'", () => {
    const res = expandQuery("dsa ppt");

    // 1. Data Structures and Algorithms aliases are recognized
    assert(res.appliedAliases.includes("dsa"), "Expected appliedAliases to include 'dsa'");

    // 2. PPT remains present
    assert(/\bppt\b/i.test(res.expanded), "Expected 'ppt' to remain present in expanded query");

    // 3. No artificial OR token is introduced
    assert(!/\bOR\b/.test(res.expanded), `Expected query NOT to contain standalone OR token, got: "${res.expanded}"`);

    // 4. Canonical data structures term is included
    assert(/data structures/i.test(res.expanded), "Expected 'data structures' to be present");
    assert.strictEqual(res.expanded, "dsa data structures ppt");
  });

  // TEST C: Input "mathematics for natural sciences"
  test("Test C: Input 'mathematics for natural sciences'", () => {
    const res = expandQuery("mathematics for natural sciences");

    // 1. Complete multiword subject is recognized
    assert(res.appliedAliases.includes("mathNat"), "Expected appliedAliases to include 'mathNat'");

    // 2. Phrase is not unnecessarily fragmented into misleading alternatives
    assert.strictEqual(res.expanded, "mathematics for natural sciences");

    // 3. No OR token
    assert(!/\bOR\b/.test(res.expanded), "Expected no OR token");
  });

  // TEST D: Input "computer networks final exam"
  test("Test D: Input 'computer networks final exam'", () => {
    const res = expandQuery("computer networks final exam");

    // 1. Original intent is preserved
    assert(/computer networks/i.test(res.expanded), "Expected 'computer networks' to be present");
    assert(/\bfinal\b/i.test(res.expanded), "Expected 'final' to be present");
    assert(/\bexam\b/i.test(res.expanded), "Expected 'exam' to be present");

    // 2. Subject alias recognized
    assert(res.appliedAliases.includes("cn") || res.appliedAliases.includes("compnet"), "Expected cn or compnet in appliedAliases");

    // 3. No duplicate nested expansion or OR tokens
    assert(!/\bOR\b/.test(res.expanded), `Expected no OR token, got: "${res.expanded}"`);
    assert(!/[()]/.test(res.expanded), `Expected no parentheses artifacts, got: "${res.expanded}"`);
  });

  // TEST E: Input without known aliases
  test("Test E: Ordinary search without known aliases ('quantum mechanics lecture 3')", () => {
    const query = "quantum mechanics lecture 3";
    const res = expandQuery(query);

    // 1. Ordinary searches continue working normally
    assert.strictEqual(res.expanded, query);
    assert.deepStrictEqual(res.appliedAliases, []);
    assert.strictEqual(res.original, query);
  });

  // TEST F: Empty and whitespace queries
  test("Test F: Empty and whitespace query handling", () => {
    const resEmpty = expandQuery("");
    assert.strictEqual(resEmpty.expanded, "");
    assert.deepStrictEqual(resEmpty.appliedAliases, []);

    const resSpaces = expandQuery("     ");
    assert.strictEqual(resSpaces.expanded, "");
    assert.deepStrictEqual(resSpaces.appliedAliases, []);

    const resNull = expandQuery(null);
    assert.strictEqual(resNull.expanded, "");
    assert.deepStrictEqual(resNull.appliedAliases, []);

    const resUndefined = expandQuery(undefined);
    assert.strictEqual(resUndefined.expanded, "");
    assert.deepStrictEqual(resUndefined.appliedAliases, []);
  });

  // BONUS TEST G: Typo correction integration
  test("Test G: Typo correction pipeline integration ('dbsm exam' -> 'dbms database exam')", () => {
    const typo = correctTypos("dbsm exam");
    assert.strictEqual(typo.corrected, "dbms exam");

    const res = expandQuery(typo.corrected);
    assert.strictEqual(res.expanded, "dbms database exam");
    assert(res.appliedAliases.includes("dbms"));
  });

  // BONUS TEST H: Natural occurrences of the word 'or' in user queries
  test("Test H: Natural occurrences of 'or' in queries ('oromo literature', 'vector or matrix')", () => {
    const res1 = expandQuery("oromo literature");
    assert.strictEqual(res1.expanded, "oromo literature");

    const res2 = expandQuery("vector or matrix");
    assert.strictEqual(res2.expanded, "vector or matrix");
  });

  // BONUS TEST I: Multiple distinct subjects in query
  test("Test I: Multiple distinct subjects in query ('dsa and dbms exam')", () => {
    const res = expandQuery("dsa and dbms exam");
    assert(res.appliedAliases.includes("dsa"), "Expected dsa in appliedAliases");
    assert(res.appliedAliases.includes("dbms"), "Expected dbms in appliedAliases");
    assert.strictEqual(res.expanded, "dsa data structures and dbms database exam");
    assert(!/\bOR\b/.test(res.expanded), "No artificial OR operator");
  });

  console.log(`\nUnit Tests Summary: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    throw new Error(`Unit tests failed: ${total - passed} failures.`);
  }
}

async function runIsolatedIntegrationTests() {
  console.log("=================================================================");
  console.log("RUNNING PHASE 2.1 ISOLATED MONGODB INTEGRATION TESTS");
  console.log("Database: mongodb://127.0.0.1:27017 / studyhub_isolated_restore_test_20261113");
  console.log("=================================================================\n");

  const { MongoClient } = require("mongodb");
  const localUri = "mongodb://127.0.0.1:27017";

  // SAFETY ASSERTION: Guarantee isolated test database
  if (localUri.includes("mongodb.net") || localUri.includes("rfdlc8z")) {
    throw new Error("FATAL: Attempted to run integration test against production MongoDB Atlas!");
  }

  let client;
  try {
    client = new MongoClient(localUri, { family: 4, serverSelectionTimeoutMS: 5000 });
    await client.connect();
    const db = client.db("studyhub_isolated_restore_test_20261113");
    const col = db.collection("telegramresources");

    const totalDocs = await col.countDocuments({});
    console.log(`Connected to isolated test database (Documents: ${totalDocs.toLocaleString()}).\n`);

    const testQueries = [
      { id: "A", input: "dbms exam" },
      { id: "B", input: "dsa ppt" },
      { id: "C", input: "mathematics for natural sciences" },
      { id: "D", input: "computer networks final exam" },
      { id: "E", input: "quantum mechanics lecture notes" }
    ];

    for (const t of testQueries) {
      const expansion = expandQuery(t.input);
      const cleanSearch = expansion.expanded.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();

      const startTime = Date.now();
      const count = await col.countDocuments({ $text: { $search: cleanSearch } });
      const topHits = await col.find(
        { $text: { $search: cleanSearch } },
        { score: { $meta: "textScore" }, projection: { fileName: 1, caption: 1, isAvailable: 1 } }
      ).sort({ score: { $meta: "textScore" } }).limit(3).toArray();
      const durationMs = Date.now() - startTime;

      console.log(`Test ${t.id} Integration:`);
      console.log(`  Input:        "${t.input}"`);
      console.log(`  Expanded:     "${expansion.expanded}"`);
      console.log(`  Clean Search: "${cleanSearch}"`);
      console.log(`  Matches:      ${count.toLocaleString()} (Execution: ${durationMs}ms)`);
      topHits.forEach((h, i) => {
        const title = h.fileName || h.caption?.substring(0, 45) || "Untitled";
        console.log(`    ${i + 1}. ${title}`);
      });
      console.log("");
    }

    console.log("Integration Tests Summary: All queries executed cleanly on MongoDB 8.0 without errors.\n");
  } catch (err) {
    console.error("Integration test failed:", err.message);
    throw err;
  } finally {
    if (client) await client.close();
  }
}

async function main() {
  runUnitTests();
  await runIsolatedIntegrationTests();
  console.log("ALL PHASE 2.1 REGRESSION AND INTEGRATION TESTS COMPLETED SUCCESSFULLY.");
}

main().catch(err => {
  console.error("Tests failed:", err);
  process.exit(1);
});
