require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderReportCardView,
  renderAdminPanelKeyboard,
  getAdminPanelMessage,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");
const ResourceReport = require("../src/db/models/ResourceReport");
const TelegramResource = require("../src/db/models/TelegramResource");
const User = require("../src/db/models/User");

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
  console.log("=== Testing Admin Feature 3: Broken File Reports Dashboard ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // --- Test 1: Empty State Rendering ---
  console.log("\n[Test 1] renderReportCardView empty state");
  const emptyView = renderReportCardView([]);
  assert(emptyView.text.includes("No pending broken file reports"));
  assert.strictEqual(
    emptyView.keyboard.reply_markup.inline_keyboard[0][0].text,
    "◀ Back to Admin Panel"
  );
  console.log("✅ Passed empty state rendering");

  // --- Test 2: Card Rendering with Populated Data ---
  console.log("\n[Test 2] renderReportCardView with report and resource details");
  const mockResId = new mongoose.Types.ObjectId();
  const mockReport1 = {
    _id: new mongoose.Types.ObjectId(),
    resourceId: {
      _id: mockResId,
      fileName: "Advanced_Algorithms_Midterm.pdf",
      fileType: "pdf",
      fileSize: 3.5 * 1024 * 1024,
      channelUsername: "aau_cs_hub",
      messageId: 4421,
      isAvailable: true,
    },
    userId: {
      firstName: "Hirut",
      lastName: "Moges",
      username: "hirut_m",
    },
    telegramId: 11223344,
    reason: "download_failed",
    status: "pending",
    createdAt: new Date(),
  };

  const mockReport2 = {
    _id: new mongoose.Types.ObjectId(),
    resourceId: {
      _id: new mongoose.Types.ObjectId(),
      fileName: "Circuits_Lab_Manual.docx",
      fileType: "doc",
      fileSize: 1.2 * 1024 * 1024,
      channelUsername: "aastu_electrical",
      messageId: 8812,
      isAvailable: true,
    },
    userId: {
      firstName: "Bekele",
      username: "bekele",
    },
    telegramId: 55667788,
    reason: "password_locked",
    status: "pending",
    createdAt: new Date(),
  };

  const cardView = renderReportCardView([mockReport1], 0);
  assert(cardView.text.includes("Advanced_Algorithms_Midterm.pdf"));
  assert(cardView.text.includes("PDF · 3.5 MB"));
  assert(cardView.text.includes("@aau_cs_hub"));
  assert(cardView.text.includes("❌ Download Failed"));
  assert(cardView.text.includes("Hirut Moges"));
  assert(cardView.text.includes("🟢 Active in Search"));

  const buttons = cardView.keyboard.reply_markup.inline_keyboard;
  // Row 1: Disable and Dismiss
  assert.strictEqual(buttons[0][0].text, "🗑️ Disable File");
  assert.strictEqual(buttons[0][0].callback_data, `adm_rep_dis_${mockReport1._id}_0`);
  assert.strictEqual(buttons[0][1].text, "✅ Dismiss Report");
  assert.strictEqual(buttons[0][1].callback_data, `adm_rep_dism_${mockReport1._id}_0`);
  // Row 2: Direct file link
  assert.strictEqual(buttons[1][0].text, "🔗 Open File in Channel");
  assert.strictEqual(buttons[1][0].url, "https://t.me/aau_cs_hub/4421");
  console.log("✅ Passed report card formatting and action buttons");

  // Multi-item pagination test
  const multiView = renderReportCardView([mockReport1, mockReport2], 0);
  const multiButtons = multiView.keyboard.reply_markup.inline_keyboard;
  const navRow = multiButtons[2];
  assert(navRow.some((b) => b.text.includes("Next ▶")));
  assert(navRow.some((b) => b.text.includes("1/2")));
  console.log("✅ Passed multi-report pagination controls");

  // --- Test 3: Admin Keyboard Dynamic Badges ---
  console.log("\n[Test 3] Admin panel keyboard report count badge");
  const kbWithReports = renderAdminPanelKeyboard(5, 2);
  const allButtons = kbWithReports.reply_markup.inline_keyboard.flat();
  const reportsBtn = allButtons.find((b) => b.callback_data === "adm_reports");
  assert(reportsBtn !== undefined);
  assert.strictEqual(reportsBtn.text, "⚠️ Reports (5)");

  const pendingBtn = allButtons.find((b) => b.callback_data === "adm_pending");
  assert(pendingBtn !== undefined);
  assert.strictEqual(pendingBtn.text, "📋 Pending (2)");
  console.log("✅ Passed dynamic report badge generation");

  // --- Test 4: Database Integration & Action Handlers ---
  console.log("\n[Test 4] Database actions: 1-tap Disable vs Dismiss");
  const bot = new MockBot();
  registerAdminPanelHandlers(bot);

  // Clean prior test artifacts
  await ResourceReport.deleteMany({ channelUsername: /test_report_channel/ });
  await TelegramResource.deleteMany({ channelUsername: /test_report_channel/ });
  await User.deleteMany({ telegramId: "77788899" });

  // Create mock user
  const reporterUser = await User.create({
    telegramId: "77788899",
    username: "report_tester",
    firstName: "TestReporter",
  });

  // Create two mock resources
  const resToDisable = await TelegramResource.create({
    fileId: "mock_file_dis_1",
    messageId: 991,
    chatId: -1001234567,
    channelUsername: "test_report_channel",
    fileName: "broken_file.pdf",
    fileType: "pdf",
    isAvailable: true,
  });

  const resToDismiss = await TelegramResource.create({
    fileId: "mock_file_dism_2",
    messageId: 992,
    chatId: -1001234567,
    channelUsername: "test_report_channel",
    fileName: "valid_file.pdf",
    fileType: "pdf",
    isAvailable: true,
  });

  // Create two pending reports
  const repToDisable = await ResourceReport.create({
    userId: reporterUser._id,
    telegramId: 77788899,
    resourceId: resToDisable._id,
    resourceTitle: "broken_file.pdf",
    channelUsername: "test_report_channel",
    reason: "download_failed",
    status: "pending",
  });

  const repToDismiss = await ResourceReport.create({
    userId: reporterUser._id,
    telegramId: 77788899,
    resourceId: resToDismiss._id,
    resourceTitle: "valid_file.pdf",
    channelUsername: "test_report_channel",
    reason: "corrupt_content",
    status: "pending",
  });

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

  // Security check: non-admin
  const nonAdminCtx = createMockCtx(8888888);
  await bot.triggerAction("adm_reports", nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin access: adm_reports
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_reports", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("Broken File Report"));
  console.log("✅ Passed adm_reports dashboard retrieval");

  // Admin action: Disable Resource (adm_rep_dis)
  await bot.triggerAction(`adm_rep_dis_${repToDisable._id}_0`, adminCtx);
  const updatedRepDis = await ResourceReport.findById(repToDisable._id);
  assert.strictEqual(updatedRepDis.status, "resolved");

  const updatedResDis = await TelegramResource.findById(resToDisable._id);
  assert.strictEqual(updatedResDis.isAvailable, false);
  console.log("✅ Passed 1-tap Disable File: resource isAvailable set to false");

  // Admin action: Dismiss Report (adm_rep_dism)
  await bot.triggerAction(`adm_rep_dism_${repToDismiss._id}_0`, adminCtx);
  const updatedRepDism = await ResourceReport.findById(repToDismiss._id);
  assert.strictEqual(updatedRepDism.status, "reviewed");

  const updatedResDism = await TelegramResource.findById(resToDismiss._id);
  assert.strictEqual(updatedResDism.isAvailable, true); // Resource remains available
  console.log("✅ Passed 1-tap Dismiss Report: report resolved without altering resource");

  // Verify search exclusion: search query with { isAvailable: { $ne: false } }
  const searchResults = await TelegramResource.find({
    channelUsername: "test_report_channel",
    isAvailable: { $ne: false },
  });
  assert.strictEqual(searchResults.length, 1);
  assert.strictEqual(searchResults[0].fileName, "valid_file.pdf");
  console.log("✅ Verified broken resource is excluded from active search results");

  // Cleanup
  await ResourceReport.deleteMany({ _id: { $in: [repToDisable._id, repToDismiss._id] } });
  await TelegramResource.deleteMany({ _id: { $in: [resToDisable._id, resToDismiss._id] } });
  await User.deleteOne({ _id: reporterUser._id });

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 3 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
