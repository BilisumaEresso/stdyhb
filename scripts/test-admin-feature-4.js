require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderArchiveMonitorView,
  registerAdminPanelHandlers,
  getAdminPanelMessage,
} = require("../src/bot/commands/admin");
const {
  getArchiveMetrics,
  isArchiveSyncActive,
  startArchiveSync,
  stopArchiveSync,
  makeProgressBar,
} = require("../src/services/archiveSync.service");

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
  console.log("=== Testing Admin Feature 4: Archive Monitor & 1-Tap Backfill ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // --- Test 1: Progress Bar Formatting ---
  console.log("\n[Test 1] Visual progress bar helper");
  const bar0 = makeProgressBar(0);
  assert.strictEqual(bar0, "[░░░░░░░░░░]");
  const bar50 = makeProgressBar(50);
  assert.strictEqual(bar50, "[█████░░░░░]");
  const bar100 = makeProgressBar(100);
  assert.strictEqual(bar100, "[██████████]");
  console.log("✅ Passed progress bar rendering (0%, 50%, 100%)");

  // --- Test 2: Live Metrics Retrieval ---
  console.log("\n[Test 2] Live archive metrics from MongoDB");
  const metrics = await getArchiveMetrics();
  assert(typeof metrics.total === "number");
  assert(typeof metrics.archived === "number");
  assert(typeof metrics.unarchived === "number");
  assert(parseFloat(metrics.percentage) >= 0 && parseFloat(metrics.percentage) <= 100);
  console.log(`✅ Passed live metrics: ${metrics.archived.toLocaleString()} / ${metrics.total.toLocaleString()} (${metrics.percentage}%)`);

  // --- Test 3: renderArchiveMonitorView in Idle & Running States ---
  console.log("\n[Test 3] renderArchiveMonitorView views");
  const idleView = renderArchiveMonitorView({
    total: 67500,
    archived: 50200,
    unarchived: 17300,
    percentage: "74.4",
    progressBar: "[███████░░░]",
    pendingChannelCount: 42,
    isRunning: false,
    stats: null,
  });

  assert(idleView.text.includes("Archive Channel Monitor"));
  assert(idleView.text.includes("74.4%"));
  assert(idleView.text.includes("IDLE"));
  const idleButtons = idleView.keyboard.reply_markup.inline_keyboard;
  assert.strictEqual(idleButtons[0][0].text, "▶ Start Archive Sync");
  assert.strictEqual(idleButtons[0][0].callback_data, "adm_archive_start");
  console.log("✅ Passed idle view rendering");

  const runningView = renderArchiveMonitorView({
    total: 67500,
    archived: 50200,
    unarchived: 17300,
    percentage: "74.4",
    progressBar: "[███████░░░]",
    pendingChannelCount: 42,
    isRunning: true,
    stats: {
      startedAt: new Date(),
      processed: 45,
      succeeded: 43,
      failed: 2,
      currentChannel: "aastu_exams",
    },
  });

  assert(runningView.text.includes("RUNNING"));
  assert(runningView.text.includes("@aastu_exams"));
  assert(runningView.text.includes("45"));
  const runningButtons = runningView.keyboard.reply_markup.inline_keyboard;
  assert.strictEqual(runningButtons[0][0].text, "⏹ Stop Sync");
  assert.strictEqual(runningButtons[0][0].callback_data, "adm_archive_stop");
  console.log("✅ Passed active running view rendering");

  // --- Test 4: Mutex Locking & Worker Control ---
  console.log("\n[Test 4] Worker mutex and stop controls");
  // Test stop when not running
  const stopIdle = stopArchiveSync();
  assert.strictEqual(stopIdle.success, false);

  // Test start sync
  const startResult = await startArchiveSync({ batchSize: 5, maxBatches: 1 });
  assert.strictEqual(startResult.success, true);
  assert(isArchiveSyncActive().isRunning);

  // Test concurrent start attempt blocked by mutex
  const startDuplicate = await startArchiveSync({ batchSize: 5, maxBatches: 1 });
  assert.strictEqual(startDuplicate.success, false);
  assert(startDuplicate.message.includes("already in progress"));
  console.log("✅ Passed worker mutex lock against concurrent runs");

  // Request graceful stop
  const stopActive = stopArchiveSync();
  assert.strictEqual(stopActive.success, true);
  console.log("✅ Passed graceful stop signal dispatch");

  // --- Test 5: Bot Action Handlers Simulation ---
  console.log("\n[Test 5] Bot action handlers in MockBot");
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
  const nonAdminCtx = createMockCtx(7777777);
  await bot.triggerAction("adm_archive", nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin access adm_archive
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_archive", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("Archive Channel Monitor"));
  console.log("✅ Passed adm_archive monitor screen navigation");

  // Check main admin panel message includes archive health
  const mainMsg = await getAdminPanelMessage();
  assert(mainMsg.includes("Archive:"));
  console.log("✅ Passed main admin panel message archive coverage line");

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 4 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
