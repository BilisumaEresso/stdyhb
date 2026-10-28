require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const User = require("../src/db/models/User");
const SearchHistory = require("../src/db/models/SearchHistory");
const {
  getUserManagerData,
  renderUserManagerView,
  renderUserWarningView,
  renderUserProfileCard,
  usersCommand,
  registerAdminPanelHandlers,
} = require("../src/bot/commands/admin");

async function runTests() {
  console.log("=== Testing Admin Full User List Management & Actions ===");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const adminId = parseInt((process.env.ADMIN_ID || "123456").split(",")[0].trim());

  // Clean test users
  await User.deleteMany({ username: /test_mgmt_user/ });

  // Create batch of test users with different universities and statuses
  const testUsers = [];
  for (let i = 1; i <= 8; i++) {
    testUsers.push({
      telegramId: `77000${i}`,
      username: `test_mgmt_user_${i}`,
      firstName: `Student${i}`,
      university: i <= 3 ? "AASTU" : i <= 6 ? "AAU" : "ASTU",
      department: "Engineering",
      searchCount: i * 5,
      isBanned: i === 8, // 8th user is banned
      lastActive: new Date(Date.now() - (i === 7 ? 40 : 1) * 24 * 60 * 60 * 1000), // user 7 inactive > 30d
    });
  }
  await User.insertMany(testUsers);

  // Add dummy search history for user 1
  const user1 = await User.findOne({ username: "test_mgmt_user_1" });
  await SearchHistory.create({
    userId: user1._id,
    query: "Calculus Final Exam",
    normalizedQuery: "calculus final exam",
    searchedAt: new Date(),
  });

  // -------------------------------------------------------------
  // Test 1: getUserManagerData pagination & filtering
  // -------------------------------------------------------------
  console.log("\n[Test 1] getUserManagerData pagination and filter tests");
  const allData = await getUserManagerData(0, "all");
  assert(allData.totalCount >= 8, "Should find all users");
  assert.strictEqual(allData.users.length, 6, "Should respect USERS_PER_PAGE = 6");
  assert(allData.totalPages >= 2, "Should calculate at least 2 pages");
  assert(typeof allData.metrics.totalRegistered === "number");
  assert(typeof allData.metrics.activeToday === "number");
  console.log("✓ 'all' filter and page limit verified");

  const aastuData = await getUserManagerData(0, "aastu");
  assert(aastuData.users.every(u => u.university.startsWith("AASTU")), "AASTU filter should return only AASTU users");
  console.log("✓ 'aastu' university filter verified");

  const bannedData = await getUserManagerData(0, "banned");
  assert(bannedData.users.every(u => u.isBanned), "Banned filter should return only banned users");
  console.log("✓ 'banned' status filter verified");

  // -------------------------------------------------------------
  // Test 2: renderUserManagerView formatting
  // -------------------------------------------------------------
  console.log("\n[Test 2] renderUserManagerView formatting and keyboard controls");
  const view = renderUserManagerView(allData);
  assert(view.text.includes("User Management & Metrics"), "Should have header title");
  assert(view.text.includes("Filter:"), "Should show active filter title");
  assert(view.text.includes("Registered:"), "Should display registration metrics");

  const kb = view.keyboard.reply_markup.inline_keyboard;
  // Inspect button for student 1
  assert(kb.some(row => row.some(btn => btn.text.includes("Inspect Student") && btn.callback_data.includes("adm_usr_inspect_"))), "Should have inspect button");
  // Filter pills
  assert(kb.some(row => row.some(btn => btn.callback_data === "adm_usr_flt_all")), "Should have all filter pill");
  assert(kb.some(row => row.some(btn => btn.callback_data === "adm_usr_flt_banned")), "Should have banned filter pill");
  // Pagination next
  assert(kb.some(row => row.some(btn => btn.callback_data.includes("adm_usr_page_1_all"))), "Should have next page button");
  console.log("✓ User Manager view formatting and controls verified");

  // -------------------------------------------------------------
  // Test 3: Action Handlers & Warning Delivery
  // -------------------------------------------------------------
  console.log("\n[Test 3] Action handlers: pagination, warning delivery, search history clear");
  class MockBot {
    constructor() { this.handlers = new Map(); }
    action(regex, handler) { this.handlers.set(regex, handler); }
    async trigger(actionText, ctx) {
      for (const [regex, handler] of this.handlers.entries()) {
        if (typeof regex === "string" && regex === actionText) {
          ctx.match = [actionText];
          return await handler(ctx);
        } else if (regex instanceof RegExp) {
          const m = actionText.match(regex);
          if (m) {
            ctx.match = m;
            return await handler(ctx);
          }
        }
      }
      throw new Error(`No action handler for: ${actionText}`);
    }
  }

  const bot = new MockBot();
  registerAdminPanelHandlers(bot);

  const sentBotMessages = [];
  const editedMessages = [];
  const alerts = [];

  const mockAdminCtx = {
    from: { id: adminId },
    answerCbQuery: async (text, opts) => { alerts.push({ text, opts }); },
    editMessageText: async (text, extra) => { editedMessages.push({ text, extra }); return true; },
    reply: async (text, extra) => { editedMessages.push({ text, extra }); return true; },
    telegram: {
      sendMessage: async (chatId, text, extra) => {
        sentBotMessages.push({ chatId, text, extra });
        return { message_id: 888 };
      },
    },
  };

  // 3a. Admin switches page via adm_usr_page_1_all
  await bot.trigger("adm_usr_page_1_all", mockAdminCtx);
  assert(editedMessages.length > 0, "Page navigation should edit message");
  assert(editedMessages[editedMessages.length - 1].text.includes("Page 2/"), "Should show page 2");
  console.log("✓ In-place page navigation verified");

  // 3b. Admin opens warning sub-panel via adm_usr_warn_...
  await bot.trigger(`adm_usr_warn_${user1._id}_0_all`, mockAdminCtx);
  assert(editedMessages[editedMessages.length - 1].text.includes("Send Official Warning Notice"), "Should render warning panel");
  console.log("✓ Warning selector sub-panel verified");

  // 3c. Admin sends spam warning via adm_usr_sendwarn_...
  await bot.trigger(`adm_usr_sendwarn_${user1._id}_spam_0_all`, mockAdminCtx);
  assert(sentBotMessages.length > 0, "Bot should deliver warning message to student");
  assert.strictEqual(sentBotMessages[0].chatId, user1.telegramId, "Warning must go to student's telegramId");
  assert(sentBotMessages[0].text.includes("Official Notice from StudyHub Admins"), "Warning text must be delivered");
  assert(alerts.some(a => a.text && a.text.includes("Warning delivered")), "Admin should get alert feedback");
  console.log("✓ Direct warning delivered to student's Telegram PM");

  // 3d. Admin clears user search history via adm_usr_clearhist_...
  await bot.trigger(`adm_usr_clearhist_${user1._id}_0_all`, mockAdminCtx);
  const remainingSearches = await SearchHistory.countDocuments({ userId: user1._id });
  assert.strictEqual(remainingSearches, 0, "User search history should be wiped");
  const updatedUser1 = await User.findById(user1._id);
  assert.strictEqual(updatedUser1.searchCount, 0, "Search count should be reset to 0");
  assert(alerts.some(a => a.text && a.text.includes("Search history")), "Admin should get alert feedback");
  console.log("✓ User search history cleared and searchCount reset");

  // -------------------------------------------------------------
  // Test 4: /users command execution
  // -------------------------------------------------------------
  console.log("\n[Test 4] /users top-level command execution");
  const commandReplies = [];
  const mockCommandCtx = {
    message: { text: "/users aastu" },
    reply: async (text, extra) => {
      commandReplies.push({ text, extra });
      return { message_id: 999 };
    },
  };
  await usersCommand(mockCommandCtx);
  assert(commandReplies.length > 0, "Command should reply with User Manager");
  assert(commandReplies[0].text.includes("User Management & Metrics"), "Command should display User Manager header");
  assert(commandReplies[0].text.includes("AASTU"), "Command should respect filter argument");
  console.log("✓ /users command verified with filter support");

  console.log("\n=== ALL USER MANAGEMENT & ACTIONS TESTS PASSED ===");
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
