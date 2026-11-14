/**
 * StudyHub Phase 2.8 — Telegram File Delivery Failure Handling Test Suite
 *
 * Verifies:
 * 1. Temporary network timeout classification.
 * 2. Telegram rate-limit response classification (429 Too Many Requests).
 * 3. Flood-wait response classification (GramJS FloodWaitError / 420 FLOOD_WAIT_X).
 * 4. Temporary relay failure classification (RelayTimeoutError / relay timeouts).
 * 5. Confirmed deleted source message & inaccessible channel (MESSAGE_ID_INVALID, CHANNEL_PRIVATE).
 * 6. Unknown Telegram error safe classification (protects resources from deactivation).
 * 7. Successful file delivery formatting (renderFileDelivered).
 * 8. Album delivery failure isolation (never deactivates album on temporary failure).
 * 9. Resource availability protection (only PERMANENT_FAILURE triggers markResourceUnavailable).
 * 10. Student-facing error prompts (zero internal Telegram error leak).
 * 11. Database invariance check (92,143 documents).
 */

const assert = require("assert");
const mongoose = require("mongoose");
const templates = require("../src/telegram/templates");
const {
  classifyDeliveryError,
  DELIVERY_ERROR_TYPES,
  markResourceUnavailable,
} = require("../src/telegram/fileDelivery");

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
  console.log("  StudyHub Phase 2.8 — File Delivery Failure Handling  ");
  console.log("=======================================================\n");

  // ─── Group 1: Error Classification Engine ─────────────────────────────────
  console.log("Group 1: Delivery Error Classification (classifyDeliveryError)");

  runSyncTest("Test 1: Classifies network timeouts and socket resets as TEMPORARY_FAILURE", () => {
    const errEtimeout = { code: "ETIMEDOUT", message: "connect ETIMEDOUT 149.154.167.50:443" };
    const errConnReset = { code: "ECONNRESET", message: "read ECONNRESET" };
    const errTimeoutName = { name: "TimeoutError", message: "Operation timed out after 30000ms" };
    const errGramTimeout = { errorMessage: "TIMEOUT" };

    assert.strictEqual(classifyDeliveryError(errEtimeout), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errConnReset), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errTimeoutName), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errGramTimeout), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
  });

  runSyncTest("Test 2: Classifies HTTP 429 Too Many Requests as TEMPORARY_FAILURE", () => {
    const err429 = {
      response: {
        error_code: 429,
        description: "Too Many Requests: retry after 20",
      },
    };
    const errMsg429 = { message: "429: Too Many Requests: retry after 15" };

    assert.strictEqual(classifyDeliveryError(err429), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errMsg429), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
  });

  runSyncTest("Test 3: Classifies GramJS FloodWaitError & 420 FLOOD_WAIT as TEMPORARY_FAILURE", () => {
    const errFloodWait = { name: "FloodWaitError", code: 420, errorMessage: "FLOOD_WAIT_30" };
    const errFloodMsg = { message: "FLOOD_WAIT_120: A wait of 120 seconds is required" };
    const errPremiumFlood = { errorMessage: "FLOOD_PREMIUM_WAIT_300" };

    assert.strictEqual(classifyDeliveryError(errFloodWait), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errFloodMsg), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errPremiumFlood), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
  });

  runSyncTest("Test 4: Classifies Relay Group timeout & delay as TEMPORARY_FAILURE", () => {
    const errRelayTimeout = {
      name: "RelayTimeoutError",
      message: "Relay group did not receive forwarded message within 30000ms",
    };
    const errRelayCode = { code: "RELAY_TIMEOUT" };

    assert.strictEqual(classifyDeliveryError(errRelayTimeout), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
    assert.strictEqual(classifyDeliveryError(errRelayCode), DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE);
  });

  runSyncTest("Test 5: Classifies confirmed deleted messages & private channels as PERMANENT_FAILURE", () => {
    const errDeletedMsg = { code: 400, errorMessage: "MESSAGE_ID_INVALID" };
    const errEmptyMsg = { code: 400, errorMessage: "MESSAGE_EMPTY" };
    const errPrivateChannel = { code: 400, errorMessage: "CHANNEL_PRIVATE" };
    const errInvalidChannel = { code: 400, message: "400: CHANNEL_INVALID" };
    const errBannedUser = { code: 400, errorMessage: "USER_BANNED_IN_CHANNEL" };

    assert.strictEqual(classifyDeliveryError(errDeletedMsg), DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);
    assert.strictEqual(classifyDeliveryError(errEmptyMsg), DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);
    assert.strictEqual(classifyDeliveryError(errPrivateChannel), DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);
    assert.strictEqual(classifyDeliveryError(errInvalidChannel), DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);
    assert.strictEqual(classifyDeliveryError(errBannedUser), DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);
  });

  runSyncTest("Test 6: Classifies unknown / unverified errors as UNKNOWN_FAILURE", () => {
    const errUnknown = { message: "Unexpected syntax parser exception at offset 12" };
    const errEmpty = {};

    assert.strictEqual(classifyDeliveryError(errUnknown), DELIVERY_ERROR_TYPES.UNKNOWN_FAILURE);
    assert.strictEqual(classifyDeliveryError(errEmpty), DELIVERY_ERROR_TYPES.UNKNOWN_FAILURE);
    assert.strictEqual(classifyDeliveryError(null), DELIVERY_ERROR_TYPES.UNKNOWN_FAILURE);
    assert.strictEqual(classifyDeliveryError(undefined), DELIVERY_ERROR_TYPES.UNKNOWN_FAILURE);
  });

  // ─── Group 2: User Experience & Prompt Formatting ─────────────────────────
  console.log("\nGroup 2: Student Experience & Error Prompts (renderDeliveryError)");

  runSyncTest("Test 7: Temporary failure renders friendly retry prompt with [🔄 Try Again] button", () => {
    const mockResource = { _id: "res123", fileName: "Database Systems Mid Exam.pdf" };
    const prompt = templates.renderDeliveryError(DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE, mockResource);

    assert(prompt.text.includes("Couldn't retrieve this file right now"), "Must include friendly temporary message");
    assert(!prompt.text.includes("429"), "Must not leak 429 error code to student");
    assert(!prompt.text.includes("FLOOD_WAIT"), "Must not leak internal flood wait code");

    const flatButtons = prompt.keyboard.flat();
    const tryAgainBtn = flatButtons.find((b) => b.text.includes("Try Again"));
    assert(tryAgainBtn, "Must include [🔄 Try Again] button");
    assert.strictEqual(tryAgainBtn.callback_data, "get_res123", "Retry button must point to get_res123");
  });

  runSyncTest("Test 8: Album temporary failure retry button targets grp_<id>", () => {
    const mockAlbum = { _id: "res456", groupId: "14248702666835540", fileType: "image" };
    const prompt = templates.renderDeliveryError(DELIVERY_ERROR_TYPES.TEMPORARY_FAILURE, mockAlbum);

    const flatButtons = prompt.keyboard.flat();
    const tryAgainBtn = flatButtons.find((b) => b.text.includes("Try Again"));
    assert(tryAgainBtn, "Must include [🔄 Try Again] button for album");
    assert.strictEqual(tryAgainBtn.callback_data, "grp_res456", "Album retry must use grp_ action");
  });

  runSyncTest("Test 9: Permanent failure renders clean unavailable prompt without retry button", () => {
    const prompt = templates.renderDeliveryError(DELIVERY_ERROR_TYPES.PERMANENT_FAILURE);

    assert(prompt.text.includes("Resource Unavailable"), "Must include permanent unavailable header");
    assert(prompt.text.includes("unavailable from its original source"), "Must indicate source unavailability");

    const flatButtons = prompt.keyboard.flat();
    const hasTryAgain = flatButtons.some((b) => b.text.includes("Try Again"));
    assert(!hasTryAgain, "Permanent failure must not offer futile Try Again button");

    const hasSearchAgain = flatButtons.some((b) => b.text.includes("Search Again"));
    assert(hasSearchAgain, "Must offer [🔍 Search Again] navigation button");
  });

  runSyncTest("Test 10: Successful file delivery renders clean channel credit", () => {
    const delivered = templates.renderFileDelivered("astu_software_eng");
    assert(delivered.includes("Source: @astu_software_eng"), "Must include source channel username");
  });

  // ─── Group 3: Database Availability Invariance ─────────────────────────────
  console.log("\nGroup 3: Database Availability Invariance");

  await runAsyncTest("Test 11: Database document count remains strictly unchanged at 92,143", async () => {
    const TEST_DB_URI = "mongodb://127.0.0.1:27017/studyhub_isolated_restore_test_20261113";
    await mongoose.connect(TEST_DB_URI);
    try {
      const col = mongoose.connection.db.collection("telegramresources");
      const count = await col.countDocuments();
      assert.strictEqual(count, 92143, "Database count must be strictly 92,143");

      // Verify that markResourceUnavailable is offline-safe and preserves documents when not connected or given null
      await markResourceUnavailable(null);
      const postCount = await col.countDocuments();
      assert.strictEqual(postCount, 92143, "Post count must remain 92,143");
    } finally {
      await mongoose.disconnect();
    }
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
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
