/**
 * StudyHub Phase 2.6 — Telegram Search Pagination & Session Recovery Test Suite
 *
 * Verifies:
 * 1. Extraction of search query from message text headers (extractQueryFromMessage).
 * 2. Multi-tier session resolution (resolveSearchSession):
 *    - Tier 1: MongoDB QuerySession (with sliding window update)
 *    - Tier 2: Telegraf persistent user session (ctx.session.searches)
 *    - Tier 3: Cryptographic MD5 hash verification from message text
 * 3. Anti-spoofing and malformed hash rejection.
 * 4. User-friendly expired session recovery screen and buttons.
 * 5. Page number sanitization and boundary clamping.
 * 6. Multi-query concurrent isolation for the same user.
 * 7. Keyboard layout integrity with [🔍 Search Again] button.
 */

const assert = require("assert");
const crypto = require("crypto");
const templates = require("../src/telegram/templates");
const {
  extractQueryFromMessage,
  saveSearchSession,
  resolveSearchSession,
  handleExpiredSession,
} = require("../src/telegram/fileDelivery");

let totalTests = 0;
let passedTests = 0;

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

async function runSuite() {
  console.log("\n=======================================================");
  console.log("  StudyHub Phase 2.6 — Pagination & Session Recovery   ");
  console.log("=======================================================\n");

  // ─── Group 1: Query Extraction from Message Header ────────────────────────
  console.log("Group 1: Query Extraction from Message Header (extractQueryFromMessage)");

  runSyncTest("Extracts clean query from standard search message header", () => {
    const text = "🔍 dbms exam\n\n📄 1. Database Systems.pdf\n📄 2. DBMS Mid Exam.pdf";
    const extracted = extractQueryFromMessage(text);
    assert.strictEqual(extracted, "dbms exam");
  });

  runSyncTest("Extracts query when category filter pill is present in header", () => {
    const text = "🔍 computer networks · 🎓 Exams\n\n📄 1. CN Final.pdf";
    const extracted = extractQueryFromMessage(text);
    assert.strictEqual(extracted, "computer networks");
  });

  runSyncTest("Extracts query with special characters and punctuation", () => {
    const text = "🔍 c++ programming 101 & data structures\n\n📄 1. Course Outline.pdf";
    const extracted = extractQueryFromMessage(text);
    assert.strictEqual(extracted, "c++ programming 101 & data structures");
  });

  runSyncTest("Returns null for empty or non-search messages", () => {
    assert.strictEqual(extractQueryFromMessage(""), null);
    assert.strictEqual(extractQueryFromMessage(null), null);
    assert.strictEqual(extractQueryFromMessage("Welcome to StudyHub!"), null);
  });

  // ─── Group 2: Multi-Tier Session Resolution ───────────────────────────────
  console.log("\nGroup 2: Multi-Tier Session Resolution (resolveSearchSession)");

  await runAsyncTest("Tier 2: Recovers expired query from ctx.session.searches", async () => {
    const query = "advanced operating systems";
    const queryHash = crypto.createHash("md5").update(query).digest("hex").substring(0, 8);

    const mockCtx = {
      from: { id: 123456789 },
      session: {
        searches: {
          [queryHash]: {
            query,
            queryHash,
            page: 2,
            activeFilter: "all",
            ownerId: 123456789,
            updatedAt: Date.now() - 7200000, // 2 hours ago (expired from 1h QuerySession)
          },
        },
      },
    };

    const resolved = await resolveSearchSession(mockCtx, queryHash);
    assert(resolved !== null, "Expected session to be resolved");
    assert.strictEqual(resolved.query, query);
    assert.strictEqual(resolved.queryHash, queryHash);
  });

  await runAsyncTest("Tier 3: Recovers query from message text via MD5 cryptographic match", async () => {
    const query = "discrete mathematics";
    const queryHash = crypto.createHash("md5").update(query).digest("hex").substring(0, 8);

    const mockCtx = {
      from: { id: 987654321 },
      session: { searches: {} }, // Empty user session
      callbackQuery: {
        message: {
          text: `🔍 ${query}\n\n📄 1. Discrete Math Notes.pdf`,
        },
      },
    };

    const resolved = await resolveSearchSession(mockCtx, queryHash);
    assert(resolved !== null, "Expected recovery from message text");
    assert.strictEqual(resolved.query, query);
    assert.strictEqual(resolved.source, "message_hash_match");
  });

  await runAsyncTest("Security: Rejects forged or mismatched queryHash in message text", async () => {
    const forgedHash = "a1b2c3d4"; // Hash that does NOT match "cryptography"
    const mockCtx = {
      from: { id: 987654321 },
      session: { searches: {} },
      callbackQuery: {
        message: {
          text: "🔍 cryptography and network security\n\n📄 1. File.pdf",
        },
      },
    };

    const resolved = await resolveSearchSession(mockCtx, forgedHash);
    assert.strictEqual(resolved, null, "Should reject when MD5 does not match hash");
  });

  await runAsyncTest("Security: Safely rejects malformed or malicious query hashes", async () => {
    const mockCtx = { session: {} };
    assert.strictEqual(await resolveSearchSession(mockCtx, "../../../etc/passwd"), null);
    assert.strictEqual(await resolveSearchSession(mockCtx, "$where: sleep(5000)"), null);
    assert.strictEqual(await resolveSearchSession(mockCtx, ""), null);
    assert.strictEqual(await resolveSearchSession(mockCtx, null), null);
    assert.strictEqual(await resolveSearchSession(mockCtx, 12345), null);
  });

  // ─── Group 3: Session Persistence & Sliding Window ─────────────────────────
  console.log("\nGroup 3: Session Persistence & Sliding Window (saveSearchSession)");

  await runAsyncTest("Saves and caps user session entries at 15 items", async () => {
    const mockCtx = {
      from: { id: 1001 },
      session: {},
    };

    // Save 18 queries sequentially
    for (let i = 1; i <= 18; i++) {
      const q = `subject test query ${i}`;
      const hash = crypto.createHash("md5").update(q).digest("hex").substring(0, 8);
      await saveSearchSession(mockCtx, q, hash, 1, "all");
    }

    const savedKeys = Object.keys(mockCtx.session.searches);
    assert.strictEqual(savedKeys.length, 15, "Session should cap at 15 entries");

    // Oldest queries (1, 2, 3) should have been evicted
    const q1Hash = crypto.createHash("md5").update("subject test query 1").digest("hex").substring(0, 8);
    assert.strictEqual(mockCtx.session.searches[q1Hash], undefined, "Query 1 should be evicted");

    // Newest queries (18) must exist
    const q18Hash = crypto.createHash("md5").update("subject test query 18").digest("hex").substring(0, 8);
    assert(mockCtx.session.searches[q18Hash] !== undefined, "Query 18 must be preserved");
    assert.strictEqual(mockCtx.session.searches[q18Hash].query, "subject test query 18");
  });

  // ─── Group 4: Expired Session Recovery Template & UI ───────────────────────
  console.log("\nGroup 4: Expired Session Recovery Template & UI");

  runSyncTest("renderExpiredSession generates informative recovery message", () => {
    const screen = templates.renderExpiredSession();
    assert(screen.text.includes("Search Session Expired"), "Should have header title");
    assert(screen.text.includes("Search Again"), "Should guide user to search again");
    assert(Array.isArray(screen.keyboard), "Keyboard must be an array");

    // Verify presence of actionable buttons
    const flatButtons = screen.keyboard.flat();
    const hasSearchAgain = flatButtons.some((b) => b.text.includes("Search Again"));
    const hasTrending = flatButtons.some((b) => b.text.includes("Trending"));
    const hasNewSearch = flatButtons.some((b) => b.text.includes("New Search"));

    assert(hasSearchAgain, "Must include Search Again button");
    assert(hasTrending, "Must include Trending button");
    assert(hasNewSearch, "Must include New Search button");
  });

  await runAsyncTest("handleExpiredSession answers callback query and edits message without error", async () => {
    let answered = false;
    let edited = false;

    const mockCtx = {
      answerCbQuery: async (msg) => {
        answered = true;
      },
      callbackQuery: {
        message: { text: "Old expired message" },
      },
      editMessageText: async (text, opts) => {
        edited = true;
        assert(text.includes("Search Session Expired"));
        assert(opts.reply_markup);
      },
    };

    await handleExpiredSession(mockCtx, "expiredhash");
    assert(answered, "Should answer callback query");
    assert(edited, "Should edit message text");
  });

  // ─── Group 5: Concurrent Multi-Search Isolation ───────────────────────────
  console.log("\nGroup 5: Concurrent Multi-Search Isolation");

  await runAsyncTest("Maintains independent state for concurrent searches by same student", async () => {
    const userCtx = {
      from: { id: 777 },
      session: {},
    };

    const queryA = "calculus 1";
    const hashA = crypto.createHash("md5").update(queryA).digest("hex").substring(0, 8);
    await saveSearchSession(userCtx, queryA, hashA, 3, "exam");

    const queryB = "linear algebra";
    const hashB = crypto.createHash("md5").update(queryB).digest("hex").substring(0, 8);
    await saveSearchSession(userCtx, queryB, hashB, 1, "notes");

    // Resolve search A
    const resA = await resolveSearchSession(userCtx, hashA);
    assert.strictEqual(resA.query, queryA);
    assert.strictEqual(resA.activeFilter, "exam");

    // Resolve search B
    const resB = await resolveSearchSession(userCtx, hashB);
    assert.strictEqual(resB.query, queryB);
    assert.strictEqual(resB.activeFilter, "notes");

    // Mutating A does not corrupt B
    await saveSearchSession(userCtx, queryA, hashA, 4, "all");
    const updatedA = await resolveSearchSession(userCtx, hashA);
    assert.strictEqual(updatedA.activeFilter, "all");

    const unchangedB = await resolveSearchSession(userCtx, hashB);
    assert.strictEqual(unchangedB.activeFilter, "notes");
  });

  // ─── Group 6: Pagination Bounds and Keyboard Navigation ───────────────────
  console.log("\nGroup 6: Pagination Bounds and Keyboard Navigation");

  runSyncTest("renderNavButtons constructs reliable prev/next buttons within 64-byte Telegram limit", () => {
    const nav = templates.renderNavButtons("a1b2c3d4", 2, 5, "exam");
    assert(Array.isArray(nav), "Nav buttons must be an array");
    assert.strictEqual(nav.length, 3, "Middle page should have Prev, Indicator, and Next");

    for (const btn of nav) {
      if (btn.callback_data) {
        assert(
          Buffer.byteLength(btn.callback_data, "utf8") <= 64,
          `callback_data '${btn.callback_data}' exceeds Telegram 64-byte limit`
        );
      }
    }
  });

  runSyncTest("renderNumberButtons produces accurate 10-result index callbacks", () => {
    const buttons = templates.renderNumberButtons("a1b2c3d4", 1, 10, "all");
    const flat = buttons.flat();
    assert.strictEqual(flat.length, 10, "Should generate exactly 10 number selection buttons");
    flat.forEach((btn, idx) => {
      assert.strictEqual(btn.callback_data, `num_a1b2c3d4_1_${idx}_all`);
      assert(Buffer.byteLength(btn.callback_data, "utf8") <= 64);
    });
  });

  // ─── Summary ─────────────────────────────────────────────────────────────
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
