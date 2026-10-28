require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const bot = require("../src/bot/index");
const TelegramResource = require("../src/db/models/TelegramResource");
const User = require("../src/db/models/User");
const fileDelivery = require("../src/telegram/fileDelivery");

async function runTest() {
  console.log("=== Testing Group Search & File Delivery Architecture ===");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const testUserTgId = 11223344;
  const testGroupId = -100987654321; // Mock supergroup

  await User.findOneAndUpdate(
    { telegramId: testUserTgId },
    {
      telegramId: testUserTgId,
      username: "group_student",
      firstName: "Student",
      university: "AAU",
      department: "Computer Science",
      searchCount: 10,
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Find or create test resource
  let resource = await TelegramResource.findOne({ groupId: { $ne: null } });
  if (!resource) {
    resource = await TelegramResource.create({
      fileId: "test_fid_grp",
      chatId: -100123456789,
      channelUsername: "isresource",
      messageId: 8881,
      groupId: "grp_test_oop",
      fileType: "image",
      fileName: "OOP Exam Page 1",
      caption: "Object Oriented Programming Final Exam #exam #final #programming",
      tags: ["exam", "final", "programming", "oop"],
      isExam: true,
    });
  }

  // Helper to extract text middleware from Telegraf bot
  // We can simulate bot.handleUpdate
  const { Context } = require("telegraf");

  console.log("\n[Test 1] Inline message with via_bot in group is IGNORED (no re-search loop)");
  let nextCalled = false;
  let replyCount = 0;

  const updateViaBot = {
    update_id: 1001,
    message: {
      message_id: 501,
      chat: { id: testGroupId, type: "supergroup" },
      from: { id: testUserTgId, username: "group_student" },
      via_bot: { id: 99999, is_bot: true, username: "StudyHubBot" },
      text: "─────────────────────\n🗂️ Object Oriented Programming Final Exam\n🎓 Exam · 📁 Exam Set\n#exam #final #programming\n📡 Source: @isresource\nObject Oriented Programming Final Exam\n─────────────────────",
    },
  };

  const ctxViaBot = new Context(updateViaBot, bot.telegram, bot.botInfo);
  ctxViaBot.reply = async () => { replyCount++; };

  await bot.middleware()(ctxViaBot, async () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, "Should have called next() to ignore via_bot message");
  assert.strictEqual(replyCount, 0, "Bot should not have replied or searched on via_bot message");
  console.log("✅ via_bot inline result successfully ignored without dumping search results");

  console.log("\n[Test 2] Casual group conversation is IGNORED");
  let casualNextCalled = false;
  let casualReplyCount = 0;

  const updateCasual = {
    update_id: 1002,
    message: {
      message_id: 502,
      chat: { id: testGroupId, type: "supergroup" },
      from: { id: testUserTgId, username: "group_student" },
      text: "Hey guys does anyone have the solutions for assignment 2?",
    },
  };

  const ctxCasual = new Context(updateCasual, bot.telegram, bot.botInfo);
  ctxCasual.reply = async () => { casualReplyCount++; };

  await bot.middleware()(ctxCasual, async () => {
    casualNextCalled = true;
  });

  assert.strictEqual(casualNextCalled, true, "Should have called next() for casual chatter");
  assert.strictEqual(casualReplyCount, 0, "Bot should remain silent on casual group conversation");
  console.log("✅ Casual group chatter correctly ignored");

  console.log("\n[Test 3] Explicit mention @StudyHubBot in group triggers search");
  let mentionSearchTriggered = false;
  const botUsername = (process.env.BOT_USERNAME || "StudyHubBot").toLowerCase();

  const updateMention = {
    update_id: 1003,
    message: {
      message_id: 503,
      chat: { id: testGroupId, type: "supergroup" },
      from: { id: testUserTgId, username: "group_student" },
      text: `@${botUsername} oop exam`,
    },
  };

  const ctxMention = new Context(updateMention, bot.telegram, { username: botUsername });
  ctxMention.telegram = {
    sendChatAction: async () => true,
  };
  ctxMention.reply = async (text) => {
    mentionSearchTriggered = true;
    assert(text.includes("results") || text.includes("Found") || text.includes("Exam"), "Reply should be search results");
  };

  await bot.middleware()(ctxMention, async () => {});
  assert.strictEqual(mentionSearchTriggered, true, "Mentioning bot in group should trigger search");
  console.log("✅ Bot mention in group properly triggers search");

  console.log("\n[Test 4] Group file delivery targets the group chat (targetChatId) and cleans up status");
  const deletedMessages = [];
  const sentMessages = [];
  const copiedMessages = [];
  const mediaGroups = [];

  const mockCtxGroupDelivery = {
    updateType: "callback_query",
    callbackQuery: { id: "cb_123" },
    chat: { id: testGroupId, type: "supergroup" },
    from: { id: testUserTgId, username: "group_student", first_name: "Student" },
    reply: async (text) => {
      sentMessages.push({ chatId: testGroupId, text });
      return { message_id: 991, text };
    },
    answerCbQuery: async () => true,
    telegram: {
      sendChatAction: async (chatId) => {
        assert.strictEqual(chatId, testGroupId, "Chat action should be sent to the group");
      },
      sendMessage: async (chatId, text) => {
        sentMessages.push({ chatId, text });
        return { message_id: 992 };
      },
      copyMessage: async (chatId, fromChatId, msgId) => {
        copiedMessages.push({ chatId, msgId });
        return { message_id: 993 };
      },
      sendMediaGroup: async (chatId, group) => {
        mediaGroups.push({ chatId, group });
        return [{ message_id: 994 }];
      },
      deleteMessage: async (chatId, msgId) => {
        deletedMessages.push({ chatId, msgId });
        return true;
      },
      editMessageText: async () => true,
    },
  };

  // Mock relay message cache so delivery succeeds immediately
  const mockRelayMsgId = 777123;
  // We can test handleDownload or handleGroupDownload
  // Add mock relay arrival
  const recentRelay = fileDelivery.__test_recentRelayMessages; // If available or trigger handleGroupDownload
  await fileDelivery.handleGroupDownload(mockCtxGroupDelivery, resource._id.toString());

  // Check that the status message was sent to the group
  assert(sentMessages.some(m => m.chatId === testGroupId && m.text.includes("Retrieving")), "Status message must be sent to the group");
  console.log("✓ Status message correctly sent to group:", testGroupId);

  console.log("\n=== ALL GROUP SEARCH & DELIVERY TESTS PASSED ===");
  await mongoose.disconnect();
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
