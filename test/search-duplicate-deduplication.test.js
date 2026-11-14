/**
 * test/search-duplicate-deduplication.test.js
 * 
 * PHASE 2.2 — SEARCH RESULT DEDUPLICATION REGRESSION TEST SUITE
 * Verifies exact cross-channel duplicate collapsing by fileUniqueId,
 * preservation of alternative sources, album safety, and university relevance.
 */

const assert = require("assert");
const searchService = require("../src/search/search.service");

function runUnitTests() {
  console.log("=================================================================");
  console.log("RUNNING PHASE 2.2 DUPLICATE DEDUPLICATION UNIT TESTS");
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

  // Helper to build mock search result items
  function createMockResource(overrides = {}) {
    return {
      _id: "id_" + Math.random().toString(36).substring(7),
      title: "Sample Exam",
      url: "https://t.me/channel1/100",
      source: "telegram",
      type: "pdf",
      score: 100,
      fileId: "fid_100",
      fileUniqueId: "uniq_12345",
      channelUsername: "channel1",
      messageId: 100,
      chatId: 1001,
      university: "AAU",
      cleanTitle: "Sample Exam",
      fileName: "sample_exam.pdf",
      fileType: "pdf",
      fileSize: 1024000,
      downloadCount: 5,
      isExam: true,
      caption: "Sample Exam Notes",
      tags: ["exam", "notes"],
      groupId: null,
      groupIndex: 0,
      groupTotal: 1,
      archiveMessageId: 50,
      _telegramResource: true,
      ...overrides
    };
  }

  // TEST A: Same fileUniqueId across three channels returns one search result
  test("Test A: Same fileUniqueId across three channels returns one search result", () => {
    const r1 = createMockResource({ fileUniqueId: "same_unique_id", channelUsername: "chanA", messageId: 1, score: 120 });
    const r2 = createMockResource({ fileUniqueId: "same_unique_id", channelUsername: "chanB", messageId: 2, score: 90 });
    const r3 = createMockResource({ fileUniqueId: "same_unique_id", channelUsername: "chanC", messageId: 3, score: 110 });

    const deduped = searchService.deduplicateStandaloneDuplicates([r1, r2, r3]);
    assert.strictEqual(deduped.length, 1, `Expected 1 result, got ${deduped.length}`);
    assert.strictEqual(deduped[0].fileUniqueId, "same_unique_id");
  });

  // TEST B: Alternative source channels remain available in the result
  test("Test B: Alternative source channels remain available in the result", () => {
    const r1 = createMockResource({ fileUniqueId: "shared_pdf", channelUsername: "alpha", messageId: 10, score: 150 });
    const r2 = createMockResource({ fileUniqueId: "shared_pdf", channelUsername: "beta", messageId: 20, score: 100 });
    const r3 = createMockResource({ fileUniqueId: "shared_pdf", channelUsername: "gamma", messageId: 30, score: 80 });

    const [res] = searchService.deduplicateStandaloneDuplicates([r1, r2, r3]);
    assert(res, "Result should exist");
    assert.strictEqual(res.channelCount, 3, `Expected channelCount 3, got ${res.channelCount}`);
    assert.strictEqual(res.duplicateCount, 3, `Expected duplicateCount 3, got ${res.duplicateCount}`);
    assert.strictEqual(res.alternativeSources.length, 2, `Expected 2 alternativeSources, got ${res.alternativeSources.length}`);

    const altChannels = res.alternativeSources.map(s => s.channelUsername);
    assert(altChannels.includes("beta"), "Expected beta in alternatives");
    assert(altChannels.includes("gamma"), "Expected gamma in alternatives");
  });

  // TEST C: Same filename but different fileUniqueId remains as separate results
  test("Test C: Same filename but different fileUniqueId remains as separate results", () => {
    const r1 = createMockResource({ fileName: "exam.pdf", fileUniqueId: "unique_A", channelUsername: "chanA" });
    const r2 = createMockResource({ fileName: "exam.pdf", fileUniqueId: "unique_B", channelUsername: "chanB" });

    const deduped = searchService.deduplicateStandaloneDuplicates([r1, r2]);
    assert.strictEqual(deduped.length, 2, `Expected 2 distinct results, got ${deduped.length}`);
    assert.strictEqual(deduped[0].fileUniqueId, "unique_A");
    assert.strictEqual(deduped[1].fileUniqueId, "unique_B");
  });

  // TEST D: Different university sources are not incorrectly discarded
  test("Test D: Different university sources are not incorrectly discarded", () => {
    const r1 = createMockResource({ fileUniqueId: "course_pack", channelUsername: "aau_chan", university: "AAU", score: 100 });
    const r2 = createMockResource({ fileUniqueId: "course_pack", channelUsername: "astu_chan", university: "ASTU", score: 95 });

    const [res] = searchService.deduplicateStandaloneDuplicates([r1, r2]);
    assert(res.universities.includes("AAU"), "Expected AAU in universities");
    assert(res.universities.includes("ASTU"), "Expected ASTU in universities");
    assert.strictEqual(res.universities.length, 2, "Expected 2 universities preserved");
  });

  // TEST E: User university relevance boosting selects university representative
  test("Test E: User university relevance boosting prioritizes matching university", () => {
    const r1 = createMockResource({ fileUniqueId: "freshman_bio", channelUsername: "general", university: "", score: 120 });
    const r2 = createMockResource({ fileUniqueId: "freshman_bio", channelUsername: "astu_med", university: "ASTU", score: 100 });
    const r3 = createMockResource({ fileUniqueId: "freshman_bio", channelUsername: "aau_med", university: "AAU", score: 110 });

    const mockUser = { university: "ASTU" };
    const [res] = searchService.deduplicateStandaloneDuplicates([r1, r2, r3], mockUser);

    assert.strictEqual(res.university, "ASTU", `Expected ASTU representative, got ${res.university}`);
    assert.strictEqual(res.channelUsername, "astu_med", `Expected astu_med channel, got ${res.channelUsername}`);
  });

  // TEST F: Album members (groupId != null) are not incorrectly flattened or removed
  test("Test F: Album members (groupId != null) are not collapsed by fileUniqueId", () => {
    // Two pages of the same album (they might have different or same fileUniqueId)
    const album1_p1 = createMockResource({ groupId: "album_123", groupIndex: 0, groupTotal: 2, fileUniqueId: "img_uniq_1" });
    const album1_p2 = createMockResource({ groupId: "album_123", groupIndex: 1, groupTotal: 2, fileUniqueId: "img_uniq_2" });
    const standalone = createMockResource({ groupId: null, fileUniqueId: "stand_uniq" });

    const deduped = searchService.deduplicateStandaloneDuplicates([album1_p1, album1_p2, standalone]);
    // Standalone deduplication must pass album members through untouched
    assert.strictEqual(deduped.length, 3, `Expected all 3 items to remain, got ${deduped.length}`);
    assert.strictEqual(deduped[0].groupId, "album_123");
    assert.strictEqual(deduped[1].groupId, "album_123");
    assert.strictEqual(deduped[0].groupIndex, 0);
    assert.strictEqual(deduped[1].groupIndex, 1);
  });

  // TEST G: Empty search results remain correctly handled
  test("Test G: Empty and null search results remain correctly handled", () => {
    assert.deepStrictEqual(searchService.deduplicateStandaloneDuplicates([]), []);
    assert.deepStrictEqual(searchService.deduplicateStandaloneDuplicates(null), []);
    assert.deepStrictEqual(searchService.deduplicateStandaloneDuplicates(undefined), []);
  });

  // TEST H: Website and bot receive compatible result data
  test("Test H: Website and bot receive compatible result data", () => {
    const r1 = createMockResource({ fileUniqueId: "doc_test", channelUsername: "chan1" });
    const r2 = createMockResource({ fileUniqueId: "doc_test", channelUsername: "chan2" });

    const [res] = searchService.deduplicateStandaloneDuplicates([r1, r2]);

    // Core Bot & Web Contract fields
    const requiredFields = [
      "_id", "title", "url", "source", "type", "score", "fileId",
      "channelUsername", "isExam", "caption", "tags", "downloadCount",
      "fileName", "fileType", "fileSize", "_telegramResource",
      "alternativeSources", "channelCount", "duplicateCount", "universities"
    ];

    for (const f of requiredFields) {
      assert(f in res, `Expected field '${f}' to be present in result object`);
    }
  });

  console.log(`\nUnit Tests Summary: ${passed}/${total} passed.\n`);
  if (passed !== total) {
    throw new Error(`Unit tests failed: ${total - passed} failures.`);
  }
}

async function runIsolatedIntegrationTests() {
  console.log("=================================================================");
  console.log("RUNNING PHASE 2.2 ISOLATED LOCAL DB INTEGRATION TESTS");
  console.log("Database: mongodb://127.0.0.1:27017 / studyhub_isolated_restore_test_20261113");
  console.log("=================================================================\n");

  const mongoose = require("mongoose");
  const LOCAL_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";

  if (LOCAL_URI.includes("mongodb.net") || LOCAL_URI.includes("rfdlc8z")) {
    throw new Error("FATAL: Attempted to run integration test against production MongoDB Atlas!");
  }

  await mongoose.connect(LOCAL_URI, { family: 4 });
  const TelegramResource = require("../src/db/models/TelegramResource");

  // Verify baseline count before test to prove read-only
  const initialCount = await TelegramResource.countDocuments({});
  console.log(`Baseline collection document count: ${initialCount.toLocaleString()}`);

  const mockUser = {
    _id: "6a38158c81cff0b089b1184a",
    telegramId: 99887766,
    university: "AAU"
  };

  const queries = [
    "dbms exam",
    "dsa ppt",
    "math exam"
  ];

  for (const q of queries) {
    console.log(`>>> Executing search: "${q}" ...`);
    const results = await searchService.searchResources(q, mockUser);

    console.log(`    Total results returned: ${results.length}`);

    // Verify no two standalone results share the same fileUniqueId
    const seenUniqueIds = new Set();
    let duplicateViolations = 0;
    let clustersWithAlternatives = 0;

    for (const r of results) {
      if (!r.groupId && r.fileUniqueId) {
        if (seenUniqueIds.has(r.fileUniqueId)) {
          duplicateViolations++;
          console.error(`    [VIOLATION] Duplicate fileUniqueId returned in search results: ${r.fileUniqueId} (${r.fileName})`);
        } else {
          seenUniqueIds.add(r.fileUniqueId);
        }

        if (r.channelCount > 1) {
          clustersWithAlternatives++;
        }
      }
    }

    assert.strictEqual(duplicateViolations, 0, `Expected 0 duplicate violations for query "${q}", found ${duplicateViolations}`);
    console.log(`    ✓ Zero duplicate fileUniqueId violations.`);
    console.log(`    ✓ Deduplicated clusters with alternative sources: ${clustersWithAlternatives}`);

    if (results.length > 0) {
      const top = results[0];
      console.log(`    Top Result: "${top.title}" (Score: ${top.score}, Channels: ${top.channelCount || 1})`);
      if (top.alternativeSources && top.alternativeSources.length > 0) {
        console.log(`      Alternatives available: ${top.alternativeSources.map(s => '@' + s.channelUsername).join(', ')}`);
      }
    }
    console.log("");
  }

  // Verify database records remained completely untouched
  const finalCount = await TelegramResource.countDocuments({});
  assert.strictEqual(initialCount, finalCount, "FATAL: Database document count changed during search execution!");
  console.log(`✓ Post-test database count verified: ${finalCount.toLocaleString()} (0 modifications).\n`);

  await mongoose.disconnect();
}

async function main() {
  runUnitTests();
  await runIsolatedIntegrationTests();
  console.log("ALL PHASE 2.2 REGRESSION AND INTEGRATION TESTS COMPLETED SUCCESSFULLY.");
}

main().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
