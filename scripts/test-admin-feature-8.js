require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderIndexerDiagnosticsView,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");
const {
  getIndexingDiagnostics,
  abortIndexing,
  isIndexingInProgress,
} = require("../src/search/telegramIndexer");
const TelegramChannel = require("../src/db/models/TelegramChannel");

// Mock Telegraf bot instance for capturing action handlers
class MockBot {
  constructor() {
    this.actionHandlers = new Map();
  }

  action(trigger, handler) {
    this.actionHandlers.set(trigger, handler);
  }

  async triggerAction(callbackData, ctx) {
    for (const [trigger, handler] of this.actionHandlers.entries()) {
      if (typeof trigger === "string" && trigger === callbackData) {
        ctx.match = [callbackData];
        return await handler(ctx);
      } else if (trigger instanceof RegExp) {
        const match = callbackData.match(trigger);
        if (match) {
          ctx.match = match;
          return await handler(ctx);
        }
      }
    }
    throw new Error(`No action handler registered for: ${callbackData}`);
  }
}

async function runTests() {
  console.log("=== Testing Admin Feature 8: Real-Time Indexer Diagnostics & Control ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // --- Test 1: getIndexingDiagnostics in Idle State ---
  console.log("\n[Test 1] getIndexingDiagnostics idle reporting");
  const idleDiag = getIndexingDiagnostics();
  assert.strictEqual(idleDiag.isRunning, false);
  assert.strictEqual(idleDiag.status, "IDLE");
  assert(typeof idleDiag.totalIndexed === "number");
  assert(typeof idleDiag.totalSkipped === "number");
  console.log("✅ Passed idle state diagnostic retrieval");

  // --- Test 2: abortIndexing when Idle ---
  console.log("\n[Test 2] abortIndexing validation when idle");
  const idleAbort = abortIndexing();
  assert.strictEqual(idleAbort.success, false);
  assert(idleAbort.message.includes("No indexing scan is currently running"));
  console.log("✅ Passed idle abort rejection");

  // --- Test 3: renderIndexerDiagnosticsView UI in Idle & Running States ---
  console.log("\n[Test 3] renderIndexerDiagnosticsView formatting");
  const idleView = renderIndexerDiagnosticsView(idleDiag, 4);
  assert(idleView.text.includes("Live Indexer Diagnostics & Control"));
  assert(idleView.text.includes("IDLE"));
  assert(idleView.text.includes("Newly Indexed"));
  assert(idleView.text.includes("Channels not fully indexed"));

  const idleButtons = idleView.keyboard.reply_markup.inline_keyboard;
  assert.strictEqual(idleButtons[0][0].text, "▶ Run Full Scan");
  assert.strictEqual(idleButtons[0][0].callback_data, "adm_scan");
  assert.strictEqual(idleButtons[0][1].text, "🔄 Refresh Diagnostics");
  assert.strictEqual(idleButtons[0][1].callback_data, "adm_indexstatus");
  console.log("✅ Passed idle view formatting and action buttons");

  // Running mock diagnostics
  const runningDiag = {
    isRunning: true,
    status: "RUNNING",
    elapsedSec: 135,
    percent: 42,
    totalChannels: 24,
    completedChannels: 10,
    currentChannel: "aau_economics_dept",
    totalIndexed: 480,
    totalSkipped: 1250,
    errors: 1,
    lastError: "FLOOD_WAIT_10",
  };

  const runningView = renderIndexerDiagnosticsView(runningDiag, 2);
  assert(runningView.text.includes("RUNNING"));
  assert(runningView.text.includes("2m 15s"));
  assert(runningView.text.includes("@aau_economics_dept"));
  assert(runningView.text.includes("10 / 24"));
  assert(runningView.text.includes("42%"));
  assert(runningView.text.includes("480"));
  assert(runningView.text.includes("FLOOD_WAIT_10"));

  const runningButtons = runningView.keyboard.reply_markup.inline_keyboard;
  assert.strictEqual(runningButtons[0][0].text, "⏹ Abort Scan");
  assert.strictEqual(runningButtons[0][0].callback_data, "adm_scan_abort");
  console.log("✅ Passed running view formatting with active channel, queue progress, and Abort button");

  // --- Test 4: Action Handlers Integration in MockBot ---
  console.log("\n[Test 4] Action handlers: adm_indexstatus, adm_scan_abort, adm_scan");
  const bot = new MockBot();
  registerAdminPanelHandlers(bot);

  let editedMessages = [];
  let answeredAlerts = [];

  const createMockCtx = (fromId) => ({
    from: { id: fromId },
    answerCbQuery: async (text, opts) => {
      answeredAlerts.push({ text, opts });
    },
    editMessageText: async (text, opts) => {
      editedMessages.push({ text, opts });
    },
    reply: async (text, opts) => {
      editedMessages.push({ text, opts });
    },
  });

  // Non-admin blocked
  const nonAdminCtx = createMockCtx(4444444);
  await bot.triggerAction("adm_indexstatus", nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin inspects indexer diagnostics
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_indexstatus", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("Live Indexer Diagnostics"));
  console.log("✅ Passed adm_indexstatus diagnostic screen retrieval");

  // Admin triggers abort when idle
  await bot.triggerAction("adm_scan_abort", adminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("No indexing scan")));
  console.log("✅ Passed adm_scan_abort handling when scan is idle");

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 8 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
