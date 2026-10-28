require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  broadcastCommand,
  registerBroadcastHandlers,
  renderBroadcastPreview,
  getAudienceCount,
  pendingBroadcasts,
} = require("../src/bot/commands/broadcast");
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
  console.log("=== Testing Admin Feature 6: Targeted & Campus-Filtered Broadcasts ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // Clean prior test users
  await User.deleteMany({ username: /test_bc_user/ });

  // Create test users for different campuses and activity timestamps
  const aastuUser = await User.create({
    telegramId: "1110001",
    username: "test_bc_user_aastu",
    university: "AASTU",
    lastActive: new Date(),
  });

  const aauUser = await User.create({
    telegramId: "1110002",
    username: "test_bc_user_aau",
    university: "AAU",
    lastActive: new Date(),
  });

  const astuUser = await User.create({
    telegramId: "1110003",
    username: "test_bc_user_astu",
    university: "ASTU",
    lastActive: new Date(),
  });

  const inactiveUser = await User.create({
    telegramId: "1110004",
    username: "test_bc_user_inactive",
    university: "Other",
    lastActive: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
  });

  // --- Test 1: getAudienceCount Query Resolution ---
  console.log("\n[Test 1] Audience count calculations");
  const allCount = await getAudienceCount("all");
  assert(allCount >= 4);
  console.log(`✅ Passed 'all' audience count (${allCount} students)`);

  const aastuCount = await getAudienceCount("aastu");
  assert(aastuCount >= 1);
  console.log(`✅ Passed 'aastu' audience count (${aastuCount} students)`);

  const activeCount = await getAudienceCount("active");
  assert(activeCount >= 3);
  console.log(`✅ Passed 'active' audience count (${activeCount} students)`);

  // --- Test 2: renderBroadcastPreview UI & Audience Pills ---
  console.log("\n[Test 2] renderBroadcastPreview preview & audience selector");
  const mockBroadcast = {
    type: "text",
    content: "Semester 2 Registration Deadline Announcement",
    targetAudience: "aastu",
    audienceCount: aastuCount,
    buttons: [{ text: "Register Here", url: "https://portal.aastu.edu.et" }],
  };

  const preview = renderBroadcastPreview(mockBroadcast, "test_bc_1");
  assert(preview.text.includes("Broadcast Preview"));
  assert(preview.text.includes("AASTU"));
  assert(preview.text.includes("Semester 2 Registration"));
  assert(preview.text.includes("attached URL button"));

  const kb = preview.keyboard.reply_markup.inline_keyboard;
  // Row 0: All & Active
  assert.strictEqual(kb[0][0].callback_data, "bc_aud_test_bc_1_all");
  assert.strictEqual(kb[0][1].callback_data, "bc_aud_test_bc_1_active");
  // Row 1: Universities with active selection pill marked
  assert(kb[1][0].text.includes("• 🏛️ AASTU •"));
  assert.strictEqual(kb[1][0].callback_data, "bc_aud_test_bc_1_aastu");
  assert.strictEqual(kb[1][1].callback_data, "bc_aud_test_bc_1_aau");
  // Row 2: Confirm & Cancel
  assert.strictEqual(kb[2][0].callback_data, "bc_confirm_test_bc_1");
  assert.strictEqual(kb[2][1].callback_data, "bc_cancel_test_bc_1");
  console.log("✅ Passed broadcast preview formatting with audience selector pills");

  // --- Test 3: Action Handlers & Targeted Delivery ---
  console.log("\n[Test 3] Action handlers: audience switching & campus-targeted delivery");
  const bot = new MockBot();
  registerBroadcastHandlers(bot);

  // Set up pending broadcast
  const testBcId = "mock_bc_123";
  pendingBroadcasts.set(testBcId, {
    type: "text",
    content: "Notice for AASTU students only!",
    caption: "",
    fileId: null,
    buttons: [],
    targetAudience: "all",
    audienceCount: allCount,
    adminChatId: parseInt(adminId),
  });

  let editedMessages = [];
  let answeredAlerts = [];
  let sentMessages = [];

  const createMockCtx = (fromId) => ({
    from: { id: fromId },
    answerCbQuery: async (text, opts) => {
      answeredAlerts.push({ text, opts });
    },
    editMessageText: async (text, opts) => {
      editedMessages.push({ text, opts });
    },
    telegram: {
      sendMessage: async (chatId, text, opts) => {
        sentMessages.push({ chatId, text, opts });
      },
      sendPhoto: async (chatId, fileId, opts) => {
        sentMessages.push({ chatId, fileId, opts });
      },
    },
  });

  // Security test
  const nonAdminCtx = createMockCtx(6666666);
  await bot.triggerAction(`bc_aud_${testBcId}_aastu`, nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin switches audience to AASTU
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction(`bc_aud_${testBcId}_aastu`, adminCtx);
  const updatedPending = pendingBroadcasts.get(testBcId);
  assert.strictEqual(updatedPending.targetAudience, "aastu");
  assert(editedMessages[editedMessages.length - 1].text.includes("AASTU"));
  console.log("✅ Passed in-place audience switching to AASTU");

  // Admin confirms and sends broadcast
  await bot.triggerAction(`bc_confirm_${testBcId}`, adminCtx);

  // Verify only AASTU user received message among test users
  const testRecipients = sentMessages.filter((m) =>
    ["1110001", "1110002", "1110003", "1110004"].includes(m.chatId)
  );
  assert.strictEqual(testRecipients.length, 1);
  assert.strictEqual(testRecipients[0].chatId, "1110001"); // only AASTU user!
  console.log("✅ Verified targeted delivery: ONLY AASTU students received the broadcast");

  // Verify completion report was rendered
  assert(editedMessages[editedMessages.length - 1].text.includes("Broadcast Completed!"));
  assert(editedMessages[editedMessages.length - 1].text.includes("AASTU"));
  console.log("✅ Verified broadcast completion report");

  // Clean up
  await User.deleteMany({ username: /test_bc_user/ });

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 6 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
