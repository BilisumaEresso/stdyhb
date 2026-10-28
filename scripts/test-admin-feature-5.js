require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderChannelManagerView,
  getChannelManagerData,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");
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
  console.log("=== Testing Admin Feature 5: Interactive Channel Manager ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // Clean prior test channels
  await TelegramChannel.deleteMany({ username: /test_mgr_channel/ });

  // Create test channels
  const activeCh = await TelegramChannel.create({
    username: "test_mgr_channel_active",
    university: "AASTU",
    active: true,
    healthStatus: "ACTIVE",
    totalIndexed: 450,
  });

  const deadCh = await TelegramChannel.create({
    username: "test_mgr_channel_dead",
    university: "AAU",
    active: true,
    healthStatus: "DEAD",
    failureCount: 4,
    totalIndexed: 120,
  });

  const inactiveCh = await TelegramChannel.create({
    username: "test_mgr_channel_inactive",
    university: "ASTU",
    active: false,
    healthStatus: "ACTIVE",
    totalIndexed: 30,
  });

  // --- Test 1: getChannelManagerData Queries & Filtering ---
  console.log("\n[Test 1] getChannelManagerData filtering");
  const allData = await getChannelManagerData(0, "all");
  assert(allData.totalCount >= 3);
  assert(allData.channels.length > 0);
  console.log(`✅ Passed 'all' filter (${allData.totalCount} channels, ${allData.totalPages} pages)`);

  const activeData = await getChannelManagerData(0, "active");
  assert(activeData.channels.every((c) => c.active === true));
  console.log("✅ Passed 'active' filter");

  const issuesData = await getChannelManagerData(0, "issues");
  assert(issuesData.totalCount >= 1);
  assert(issuesData.channels.length > 0);
  assert(issuesData.channels.every((c) => ["DEGRADED", "DEAD"].includes(c.healthStatus) || c.failureCount > 0));
  console.log(`✅ Passed 'issues' filter (found ${issuesData.totalCount} problematic channels)`);

  // --- Test 2: renderChannelManagerView Formatting ---
  console.log("\n[Test 2] renderChannelManagerView UI cards & buttons");
  const view = renderChannelManagerView({
    channels: [activeCh, inactiveCh],
    page: 0,
    totalPages: 2,
    totalCount: 6,
    filter: "all",
  });

  assert(view.text.includes("@test_mgr_channel_active"));
  assert(view.text.includes("AASTU"));
  assert(view.text.includes("450"));
  assert(view.text.includes("@test_mgr_channel_inactive"));

  const keyboard = view.keyboard.reply_markup.inline_keyboard;
  // Row 0: Active channel action buttons
  assert.strictEqual(keyboard[0][0].text, "⚡ Scan @test_mgr_c");
  assert.strictEqual(keyboard[0][1].text, "⏸ Deactivate");
  assert.strictEqual(keyboard[0][1].callback_data, "adm_ch_tog_test_mgr_channel_active_0_all");
  assert.strictEqual(keyboard[0][2].text, "🔗 Open");
  assert.strictEqual(keyboard[0][2].url, "https://t.me/test_mgr_channel_active");

  // Row 1: Inactive channel toggle should say "▶ Activate"
  assert.strictEqual(keyboard[1][1].text, "▶ Activate");
  assert.strictEqual(keyboard[1][1].callback_data, "adm_ch_tog_test_mgr_channel_inactive_0_all");

  // Filter row
  const filterRow = keyboard[2];
  assert(filterRow.some((b) => b.text.includes("• All •")));
  assert(filterRow.some((b) => b.text.includes("Active")));
  assert(filterRow.some((b) => b.text.includes("Issues")));

  // Nav row
  const navRow = keyboard[3];
  assert(navRow.some((b) => b.text.includes("Next ▶")));
  assert(navRow.some((b) => b.text.includes("1/2")));
  console.log("✅ Passed channel manager UI cards, action buttons, filter pills, and navigation");

  // --- Test 3: Action Handlers Integration in MockBot ---
  console.log("\n[Test 3] Action handlers (adm_channels, adm_ch_tog, adm_ch_flt, adm_ch_scan)");
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
  const nonAdminCtx = createMockCtx(5555555);
  await bot.triggerAction("adm_channels", nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin access adm_channels
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_channels", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("Channel Manager"));
  console.log("✅ Passed adm_channels screen retrieval");

  // Test 1-Tap Toggle Active -> Inactive
  await bot.triggerAction("adm_ch_tog_test_mgr_channel_active_0_all", adminCtx);
  const updatedDeactivated = await TelegramChannel.findOne({ username: "test_mgr_channel_active" });
  assert.strictEqual(updatedDeactivated.active, false);
  console.log("✅ Passed 1-tap deactivation: active toggled to false");

  // Test 1-Tap Toggle Inactive -> Active
  await bot.triggerAction("adm_ch_tog_test_mgr_channel_active_0_all", adminCtx);
  const updatedReactivated = await TelegramChannel.findOne({ username: "test_mgr_channel_active" });
  assert.strictEqual(updatedReactivated.active, true);
  console.log("✅ Passed 1-tap activation: active toggled back to true");

  // Test Filter Switch (Issues)
  await bot.triggerAction("adm_ch_flt_issues", adminCtx);
  assert(editedMessages[editedMessages.length - 1].text.includes("Problematic Channels"));
  console.log("✅ Passed in-place filter switching to 'issues'");

  // Test 1-Tap Force Scan
  await bot.triggerAction("adm_ch_scan_test_mgr_channel_active_0_all", adminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Force scan started")));
  console.log("✅ Passed 1-tap force scan trigger and notification");

  // Clean up
  await TelegramChannel.deleteMany({ username: /test_mgr_channel/ });

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 5 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
