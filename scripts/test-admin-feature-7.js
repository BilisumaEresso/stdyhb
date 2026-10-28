require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  renderUserProfileCard,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");
const User = require("../src/db/models/User");
const SearchHistory = require("../src/db/models/SearchHistory");

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
  console.log("=== Testing Admin Feature 7: User Profile Inspector & Ban Tool ===");

  await mongoose.connect(process.env.MONGO_URI);
  console.log(" Connected to MongoDB");

  const adminId = (process.env.ADMIN_ID || "123456").split(",")[0].trim();

  // Clean prior test artifacts
  await User.deleteMany({ username: /test_inspect_user/ });

  // Create test student in DB
  const testStudent = await User.create({
    telegramId: "888111222",
    username: "test_inspect_user",
    firstName: "Solomon",
    lastName: "Tadesse",
    university: "AASTU",
    department: "Electrical & Computer Engineering",
    year: 4,
    semester: 2,
    searchCount: 28,
    isBanned: false,
  });

  const mockSearches = [
    { query: "VLSI Design past exams", searchedAt: new Date() },
    { query: "Signal Processing slides", searchedAt: new Date() },
  ];

  // --- Test 1: renderUserProfileCard Formatting ---
  console.log("\n[Test 1] renderUserProfileCard formatting");
  const cardView = renderUserProfileCard(testStudent, mockSearches);
  assert(cardView.text.includes("Solomon Tadesse"));
  assert(cardView.text.includes("@test_inspect_user"));
  assert(cardView.text.includes("888111222"));
  assert(cardView.text.includes("AASTU"));
  assert(cardView.text.includes("Electrical &amp; Computer Engineering"));
  assert(cardView.text.includes("Year 4, Sem 2"));
  assert(cardView.text.includes("28"));
  assert(cardView.text.includes("ACTIVE"));
  assert(cardView.text.includes("VLSI Design past exams"));

  const buttons = cardView.keyboard.reply_markup.inline_keyboard;
  // Row 0: Ban button
  assert.strictEqual(buttons[0][0].text, "🚫 Ban User");
  assert.strictEqual(buttons[0][0].callback_data, `adm_usr_ban_${testStudent._id}`);
  // Row 1: Direct link
  assert.strictEqual(buttons[1][0].text, "💬 Send Direct Telegram Message");
  assert.strictEqual(buttons[1][0].url, "https://t.me/test_inspect_user");
  console.log("✅ Passed profile card rendering with details and Ban button");

  // --- Test 2: Banned State Card Formatting ---
  console.log("\n[Test 2] renderUserProfileCard when user is banned");
  testStudent.isBanned = true;
  testStudent.bannedAt = new Date();
  const bannedCardView = renderUserProfileCard(testStudent, []);
  assert(bannedCardView.text.includes("SUSPENDED"));
  assert.strictEqual(
    bannedCardView.keyboard.reply_markup.inline_keyboard[0][0].text,
    "✅ Unban User"
  );
  console.log("✅ Passed banned state card rendering with Unban button");

  // Reset ban status for action handler tests
  testStudent.isBanned = false;
  testStudent.bannedAt = null;
  await testStudent.save();

  // --- Test 3: Action Handlers Integration (Inspect, Ban, Unban) ---
  console.log("\n[Test 3] Action handlers: adm_users, adm_usr_inspect, adm_usr_ban");
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
  const nonAdminCtx = createMockCtx(3333333);
  await bot.triggerAction(`adm_usr_ban_${testStudent._id}`, nonAdminCtx);
  assert(answeredAlerts.some((a) => a.text && a.text.includes("Admin only")));
  console.log("✅ Passed non-admin security barrier");

  // Admin access adm_users
  const adminCtx = createMockCtx(parseInt(adminId));
  await bot.triggerAction("adm_users", adminCtx);
  assert(editedMessages.length > 0);
  assert(editedMessages[editedMessages.length - 1].text.includes("User Management & Metrics"));
  console.log("✅ Passed adm_users screen with recent students list");

  // Admin inspects user
  await bot.triggerAction(`adm_usr_inspect_${testStudent._id}`, adminCtx);
  assert(editedMessages[editedMessages.length - 1].text.includes("Solomon Tadesse"));
  console.log("✅ Passed adm_usr_inspect profile retrieval");

  // Admin bans user
  await bot.triggerAction(`adm_usr_ban_${testStudent._id}`, adminCtx);
  const bannedUserDoc = await User.findById(testStudent._id);
  assert.strictEqual(bannedUserDoc.isBanned, true);
  assert(bannedUserDoc.bannedAt instanceof Date);
  assert(editedMessages[editedMessages.length - 1].text.includes("SUSPENDED"));
  console.log("✅ Passed 1-tap Ban User action (isBanned = true, timestamp recorded)");

  // Admin unbans user
  await bot.triggerAction(`adm_usr_ban_${testStudent._id}`, adminCtx);
  const unbannedUserDoc = await User.findById(testStudent._id);
  assert.strictEqual(unbannedUserDoc.isBanned, false);
  assert.strictEqual(unbannedUserDoc.bannedAt, null);
  assert(editedMessages[editedMessages.length - 1].text.includes("ACTIVE"));
  console.log("✅ Passed 1-tap Unban User action (isBanned = false, timestamp cleared)");

  // --- Test 4: Ban Enforcement Middleware Simulation ---
  console.log("\n[Test 4] Global ban enforcement simulation");
  // Test banned user blocked
  unbannedUserDoc.isBanned = true;
  await unbannedUserDoc.save();

  let nextCalled = false;
  let blockedReply = null;
  const mockUserCtx = {
    from: { id: 888111222 },
    reply: (msg) => {
      blockedReply = msg;
    },
  };

  const banMiddleware = async (ctx, next) => {
    if (adminId.includes(String(ctx.from?.id))) return next();
    const user = await User.findOne({ telegramId: String(ctx.from?.id) });
    if (user && user.isBanned) {
      return ctx.reply("⛔ Your StudyHub account has been suspended.");
    }
    return next();
  };

  await banMiddleware(mockUserCtx, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false);
  assert(blockedReply.includes("suspended"));
  console.log("✅ Passed global ban enforcement: banned user is intercepted early");

  // Clean up
  await User.deleteOne({ _id: testStudent._id });

  await mongoose.disconnect();
  console.log("\n🎉 ALL ADMIN FEATURE 7 TESTS PASSED SUCCESSFULLY!\n");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
