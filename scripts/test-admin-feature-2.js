require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderPendingRecommendationView,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");
const ChannelRecommendation = require("../src/db/models/ChannelRecommendation");
const TelegramChannel = require("../src/db/models/TelegramChannel");
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
  console.log("=== Testing Admin Feature 2: Channel Recommendation Approvals ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // --- Test 1: renderPendingRecommendationView with Empty State ---
  console.log("\n[Test 1] renderPendingRecommendationView empty state");
  const emptyView = renderPendingRecommendationView([]);
  assert(emptyView.text.includes("No pending channel recommendations"));
  assert.strictEqual(
    emptyView.keyboard.reply_markup.inline_keyboard[0][0].text,
    "◀ Back to Admin Panel"
  );
  console.log("✅ Passed empty state rendering");

  // --- Test 2: renderPendingRecommendationView with Recommendations ---
  console.log("\n[Test 2] renderPendingRecommendationView single and multiple items");
  const mockRec1 = {
    _id: new mongoose.Types.ObjectId(),
    channelUsername: "aastu_software_hub",
    university: "AASTU",
    type: "Exams",
    reason: "Great past exams for software engineering",
    recommendedBy: { firstName: "Abebe", lastName: "Kebede", username: "abebe_k" },
    createdAt: new Date(),
  };

  const mockRec2 = {
    _id: new mongoose.Types.ObjectId(),
    channelUsername: "aau_freshman_notes",
    university: "AAU",
    type: "Lecture Notes",
    recommendedBy: { firstName: "Almaz", username: "almaz" },
    createdAt: new Date(),
  };

  const singleView = renderPendingRecommendationView([mockRec1], 0);
  assert(singleView.text.includes("@aastu_software_hub"));
  assert(singleView.text.includes("AASTU"));
  assert(singleView.text.includes("Abebe Kebede"));
  assert(singleView.text.includes("Exams"));

  const buttons = singleView.keyboard.reply_markup.inline_keyboard;
  // Row 1: Approve and Reject
  assert.strictEqual(buttons[0][0].text, "✅ Approve & Index");
  assert.strictEqual(buttons[0][0].callback_data, `adm_appr_${mockRec1._id}_0`);
  assert.strictEqual(buttons[0][1].text, "❌ Reject");
  assert.strictEqual(buttons[0][1].callback_data, `adm_rejc_${mockRec1._id}_0`);
  // Row 2: Open Channel URL
  assert.strictEqual(buttons[1][0].text, "🔗 Open Channel");
  assert.strictEqual(buttons[1][0].url, "https://t.me/aastu_software_hub");
  console.log("✅ Passed single item rendering with buttons and URL");

  // Test pagination with 2 items
  const multiView = renderPendingRecommendationView([mockRec1, mockRec2], 0);
  const multiButtons = multiView.keyboard.reply_markup.inline_keyboard;
  // Row 3 should be pagination
  const navRow = multiButtons[2];
  assert(navRow.some((b) => b.text.includes("Next ▶")));
  assert(navRow.some((b) => b.text.includes("1/2")));
  console.log("✅ Passed multi-item pagination rendering");

  // --- Test 3: Action Handlers Integration ---
  console.log("\n[Test 3] Testing approval, rejection, and pagination handlers in MockBot");
  const bot = new MockBot();
  registerAdminPanelHandlers(bot);

  // Setup test mock user in DB
  await ChannelRecommendation.deleteMany({ channelUsername: /test_channel/ });
  await TelegramChannel.deleteMany({ username: /test_channel/ });
  await User.deleteMany({ telegramId: "99887766" });

  let testStudent = await User.create({
    telegramId: "99887766",
    username: "student_tester",
    firstName: "Test",
    university: "AASTU",
  });

  // Create two pending recommendations in DB
  const testRecApprove = await ChannelRecommendation.create({
    channelUsername: "test_channel_to_approve",
    university: "AASTU",
    type: "Exams",
    reason: "Comprehensive exam collections",
    recommendedBy: testStudent._id,
    status: "pending",
  });

  const testRecReject = await ChannelRecommendation.create({
    channelUsername: "test_channel_to_reject",
    university: "AAU",
    type: "Other",
    recommendedBy: testStudent._id,
    status: "pending",
  });

  // Track context calls
  let notifiedUsers = [];
  let editedMessages = [];
  let answeredAlerts = [];

  const createMockCtx = (fromId) => ({
    from: { id: fromId },
    telegram: {
      sendMessage: async (targetId, text, opts) => {
        notifiedUsers.push({ targetId, text });
      },
    },
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

  // 3a. Test Security: Non-admin gets blocked
  const nonAdminCtx = createMockCtx(9999999);
  await bot.triggerAction("adm_pending", nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed admin-only security gate");

  // 3b. Test Admin viewing pending list
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_pending", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("Pending Channel Recommendation"));
  console.log("✅ Passed adm_pending list retrieval");

  // 3c. Test Admin approving recommendation
  await bot.triggerAction(`adm_appr_${testRecApprove._id}_0`, adminCtx);
  const updatedApprovedRec = await ChannelRecommendation.findById(testRecApprove._id);
  assert.strictEqual(updatedApprovedRec.status, "approved");

  // Verify upserted into TelegramChannel
  const createdChannel = await TelegramChannel.findOne({ username: "test_channel_to_approve" });
  assert(createdChannel !== null);
  assert.strictEqual(createdChannel.active, true);
  assert.strictEqual(createdChannel.university, "AASTU");

  // Verify student was notified
  assert(notifiedUsers.some((n) => n.targetId === "99887766" && n.text.includes("approved")));
  console.log("✅ Passed 1-tap Approve & Index flow + student notification");

  // 3d. Test Admin rejecting recommendation
  await bot.triggerAction(`adm_rejc_${testRecReject._id}_0`, adminCtx);
  const updatedRejectedRec = await ChannelRecommendation.findById(testRecReject._id);
  assert.strictEqual(updatedRejectedRec.status, "rejected");
  console.log("Notified users in test:", notifiedUsers);
  assert(notifiedUsers.some((n) => String(n.targetId) === "99887766" && n.text.includes("criteria")));
  console.log("✅ Passed 1-tap Reject flow + student notification");

  // Clean up test documents
  await ChannelRecommendation.deleteMany({ _id: { $in: [testRecApprove._id, testRecReject._id] } });
  await TelegramChannel.deleteOne({ username: "test_channel_to_approve" });
  await User.deleteOne({ telegramId: "99887766" });

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 2 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
