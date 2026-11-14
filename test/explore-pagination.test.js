/**
 * StudyHub Phase 2.7 — Website Search Pagination & Explore Browse Reliability Test Suite
 *
 * Verifies:
 * 1. Empty Explore page browsing (39,470 learning entities baseline).
 * 2. Standalone resource browsing (groupId === null).
 * 3. Album browsing & representative selection (groupIndex: 1, _isGrouped: true, groupSize >= 1).
 * 4. Multi-page search pagination with correct page, limit, total, totalPages.
 * 5. Last available page boundary navigation.
 * 6. Invalid page number sanitization & safe clamping (page <= 0, page > totalPages).
 * 7. Active file-type filtering (PDF, PPT, DOC, Image).
 * 8. University filtering (e.g., ASTU, AAU).
 * 9. Duplicate result prevention across consecutive pages (strictly 0 ID overlaps).
 * 10. Search with zero results (clean empty contract).
 * 11. Database read-only integrity (92,143 documents).
 */

const assert = require("assert");
const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const routes = require("../src/api/routes");

let totalTests = 0;
let passedTests = 0;

function runSyncTest(name, fn) {
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

async function runSuite() {
  console.log("\n=======================================================");
  console.log("  StudyHub Phase 2.7 — Explore Pagination & Browse     ");
  console.log("=======================================================\n");

  const TEST_DB_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
  await mongoose.connect(TEST_DB_URI);
  console.log("Connected to isolated test database.");

  const initialCount = await mongoose.connection.db.collection("telegramresources").countDocuments();
  console.log(`Baseline collection document count: ${initialCount.toLocaleString()}`);
  assert.strictEqual(initialCount, 92143, "Baseline document count must be 92,143");

  // Spin up ephemeral express server
  const app = express();
  app.use(express.json());
  app.use("/api", routes);

  const server = app.listen(0);
  const port = server.address().port;
  const client = axios.create({ baseURL: `http://127.0.0.1:${port}/api` });
  console.log(`Test API server listening on port ${port}.\n`);

  try {
    // ─── Test 1: Empty Explore Page Browsing ─────────────────────────────────
    console.log("Group 1: Initial Explore Browse & Entity Inventory");

    await runAsyncTest("Test 1: Empty query returns 200 OK with correct browse pagination", async () => {
      const res = await client.get("/search?page=1&limit=12");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.length, 12);
      assert.strictEqual(res.data.pagination.page, 1);
      assert.strictEqual(res.data.pagination.limit, 12);
      // Total available entities should exactly match 39,470
      assert.strictEqual(res.data.pagination.total, 39470);
      assert.strictEqual(res.data.pagination.totalPages, Math.ceil(39470 / 12));
    });

    // ─── Test 2: Standalone Resource Browsing ────────────────────────────────
    await runAsyncTest("Test 2: Standalone resources appear with groupId: null", async () => {
      const res = await client.get("/search?page=1&limit=20");
      const standalone = res.data.data.filter((r) => r.groupId === null || r.groupId === undefined);
      assert(standalone.length > 0, "Standalone resources must appear in browse results");
      const first = standalone[0];
      assert(first.title, "Standalone resource must have display title");
      assert(first.fileType, "Standalone resource must have fileType");
    });

    // ─── Test 3: Album Browsing & Group Index 1 ──────────────────────────────
    await runAsyncTest("Test 3: Album representatives appear with groupIndex 1 and bundle metadata", async () => {
      // Find albums by filtering fileType=image or checking groupId
      const res = await client.get("/search?fileType=image&page=1&limit=20");
      assert.strictEqual(res.status, 200);
      assert(res.data.data.length > 0, "Should return image albums");

      const album = res.data.data.find((r) => r.groupId !== null && r.groupId !== undefined);
      assert(album, "Must find an album item");
      assert.strictEqual(album.groupIndex, 1, "Album representative must have groupIndex: 1");
      assert.strictEqual(album._isGrouped, true, "Album item must have _isGrouped: true");
      assert(album.groupSize >= 1, "Album item must have valid groupSize");
      assert(album.groupTotal >= 1, "Album item must have groupTotal");
    });

    // ─── Test 4: Search With Multiple Pages ──────────────────────────────────
    console.log("\nGroup 2: Search Pagination & Deterministic Navigation");

    let page1Data = [];
    let page2Data = [];

    await runAsyncTest("Test 4: Search with multiple pages returns consecutive slices", async () => {
      const res1 = await client.get("/search?q=dbms&page=1&limit=12");
      const res2 = await client.get("/search?q=dbms&page=2&limit=12");

      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res1.data.pagination.page, 1);
      assert.strictEqual(res2.data.pagination.page, 2);
      assert.strictEqual(res1.data.data.length, 12);
      assert.strictEqual(res2.data.data.length, 12);

      page1Data = res1.data.data;
      page2Data = res2.data.data;
    });

    // ─── Test 5: Last Available Page ────────────────────────────────────────
    await runAsyncTest("Test 5: Navigating to last available page returns valid tail items", async () => {
      const initial = await client.get("/search?q=dbms&page=1&limit=12");
      const totalPages = initial.data.pagination.totalPages;

      const lastRes = await client.get(`/search?q=dbms&page=${totalPages}&limit=12`);
      assert.strictEqual(lastRes.status, 200);
      assert.strictEqual(lastRes.data.pagination.page, totalPages);
      assert(lastRes.data.data.length > 0 && lastRes.data.data.length <= 12);
    });

    // ─── Test 6: Invalid Page Numbers (Zero, Negative, Exceeded) ─────────────
    await runAsyncTest("Test 6: Invalid page numbers are sanitized and clamped cleanly", async () => {
      // Case A: page=0 clamped to 1
      const resZero = await client.get("/search?q=dbms&page=0&limit=12");
      assert.strictEqual(resZero.data.pagination.page, 1);

      // Case B: negative page clamped to 1
      const resNeg = await client.get("/search?q=dbms&page=-5&limit=12");
      assert.strictEqual(resNeg.data.pagination.page, 1);

      // Case C: page exceeds totalPages -> clamped to totalPages without false empty page
      const initial = await client.get("/search?q=dbms&page=1&limit=12");
      const totalPages = initial.data.pagination.totalPages;
      const resExcess = await client.get("/search?q=dbms&page=99999&limit=12");
      assert.strictEqual(resExcess.data.pagination.page, totalPages);
      assert(resExcess.data.data.length > 0, "Clamped tail page should not be falsely empty");
    });

    // ─── Test 7: Active File-Type Filters ───────────────────────────────────
    console.log("\nGroup 3: Filtering & Cross-Page Uniqueness");

    await runAsyncTest("Test 7: Active file-type filters strictly return matching types", async () => {
      const pdfRes = await client.get("/search?fileType=pdf&page=1&limit=10");
      pdfRes.data.data.forEach((r) => {
        assert.strictEqual((r.fileType || "").toLowerCase(), "pdf");
      });

      const pptRes = await client.get("/search?fileType=ppt&page=1&limit=10");
      pptRes.data.data.forEach((r) => {
        assert.strictEqual((r.fileType || "").toLowerCase(), "ppt");
      });
    });

    // ─── Test 8: University Filtering ───────────────────────────────────────
    await runAsyncTest("Test 8: University filter restricts results to university affiliation", async () => {
      const uRes = await client.get("/search?university=aau&page=1&limit=10");
      assert.strictEqual(uRes.status, 200);
      uRes.data.data.forEach((r) => {
        const matchesPrimary = (r.university || "").toLowerCase().includes("aau");
        const matchesArray = r.universities && r.universities.some((u) => u.toLowerCase().includes("aau"));
        const matchesAlt =
          r.alternativeSources && r.alternativeSources.some((s) => (s.university || "").toLowerCase().includes("aau"));
        assert(matchesPrimary || matchesArray || matchesAlt, "Result must match requested university");
      });
    });

    // ─── Test 9: Duplicate Prevention Across Consecutive Pages ───────────────
    await runAsyncTest("Test 9: Strictly zero duplicate items across consecutive search pages", async () => {
      const page1Ids = new Set(page1Data.map((r) => String(r._id)));
      const page2Ids = new Set(page2Data.map((r) => String(r._id)));

      const overlap = [...page1Ids].filter((id) => page2Ids.has(id));
      assert.strictEqual(overlap.length, 0, `Detected ${overlap.length} duplicate IDs across Page 1 and Page 2`);

      // Also verify browse mode consecutive pages
      const bPage1 = await client.get("/search?page=1&limit=15");
      const bPage2 = await client.get("/search?page=2&limit=15");
      const bIds1 = new Set(bPage1.data.data.map((r) => String(r._id)));
      const bIds2 = new Set(bPage2.data.data.map((r) => String(r._id)));
      const bOverlap = [...bIds1].filter((id) => bIds2.has(id));
      assert.strictEqual(bOverlap.length, 0, `Detected ${bOverlap.length} duplicate IDs across Browse Page 1 and Page 2`);
    });

    // ─── Test 10: Search with Zero Results ───────────────────────────────────
    await runAsyncTest("Test 10: Zero result search returns empty array and total: 0", async () => {
      const res = await client.get("/search?q=xyznonexistentterm99999&page=1&limit=12");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.data.length, 0);
      assert.strictEqual(res.data.pagination.total, 0);
      assert.strictEqual(res.data.pagination.totalPages, 1);
      assert.strictEqual(res.data.pagination.page, 1);
    });

    // ─── Test 11: Database Read-Only Integrity ──────────────────────────────
    console.log("\nGroup 4: Database Safety & Baseline Invariance");

    await runAsyncTest("Test 11: Database document count remains strictly unchanged at 92,143", async () => {
      const postCount = await mongoose.connection.db.collection("telegramresources").countDocuments();
      assert.strictEqual(postCount, 92143, "Database count must be strictly 92,143 (0 mutations)");
    });
  } finally {
    server.close();
    await mongoose.disconnect();
    console.log("\nServer and database connections closed.");
  }

  // ─── Final Summary ────────────────────────────────────────────────────────
  console.log("\n-------------------------------------------------------");
  console.log(`Results: ${passedTests} / ${totalTests} tests passed`);
  console.log("-------------------------------------------------------\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
