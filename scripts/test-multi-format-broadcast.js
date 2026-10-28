require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const User = require("../src/db/models/User");
const {
  broadcastCommand,
  registerBroadcastHandlers,
  pendingBroadcasts,
} = require("../src/bot/commands/broadcast");

async function runTests() {
  console.log("=== Testing Multi-Format Broadcasting Architecture ===");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const adminId = parseInt((process.env.ADMIN_ID || "123456").split(",")[0].trim());

  // Setup test user
  await User.findOneAndUpdate(
    { telegramId: 99887766 },
    {
      telegramId: 99887766,
      username: "student_broadcast_test",
      university: "AASTU",
      department: "Software Engineering",
    },
    { upsert: true, returnDocument: "after" }
  );

  const copiedMessages = [];
  const sentPhotos = [];
  const sentVideos = [];
  const sentDocuments = [];
  const sentTexts = [];
  const editedMessages = [];
  const replies = [];

  const mockTelegram = {
    copyMessage: async (chatId, fromChatId, msgId, extra) => {
      copiedMessages.push({ chatId, fromChatId, msgId, extra });
      return { message_id: 1001 };
    },
    sendPhoto: async (chatId, fileId, extra) => {
      sentPhotos.push({ chatId, fileId, extra });
      return { message_id: 1002 };
    },
    sendVideo: async (chatId, fileId, extra) => {
      sentVideos.push({ chatId, fileId, extra });
      return { message_id: 1003 };
    },
    sendDocument: async (chatId, fileId, extra) => {
      sentDocuments.push({ chatId, fileId, extra });
      return { message_id: 1004 };
    },
    sendMessage: async (chatId, text, extra) => {
      sentTexts.push({ chatId, text, extra });
      return { message_id: 1005 };
    },
    editMessageText: async (chatId, msgId, inlineId, text) => {
      editedMessages.push({ chatId, msgId, text });
      return true;
    },
  };

  // Mock bot to capture actions
  class MockBot {
    constructor() {
      this.handlers = new Map();
    }
    action(regex, handler) {
      this.handlers.set(regex, handler);
    }
    async trigger(actionText, ctx) {
      for (const [regex, handler] of this.handlers.entries()) {
        const match = actionText.match(regex);
        if (match) {
          ctx.match = match;
          return await handler(ctx);
        }
      }
      throw new Error(`No handler for action: ${actionText}`);
    }
  }

  const bot = new MockBot();
  registerBroadcastHandlers(bot);

  // -------------------------------------------------------------
  // Test 1: Reply-to-Broadcast (Photo + Button)
  // -------------------------------------------------------------
  console.log("\n[Test 1] Reply-to-Broadcast with Photo and custom URL button");
  const ctxReplyPhoto = {
    chat: { id: adminId },
    from: { id: adminId },
    message: {
      message_id: 201,
      text: "/broadcast BUTTON: Join Channel | https://t.me/Ethiel_Academy",
      reply_to_message: {
        message_id: 200,
        photo: [{ file_id: "photo_thumb" }, { file_id: "photo_full_hd" }],
        caption: "Important Announcement: Final Exam Timetable Released!",
      },
    },
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { message_id: 202, text };
    },
    telegram: mockTelegram,
  };

  await broadcastCommand(ctxReplyPhoto);
  assert(replies.length > 0, "Preview message should have been sent");
  const preview1 = replies[replies.length - 1];
  assert(preview1.text.includes("PHOTO"), "Preview should detect PHOTO type");
  assert(preview1.text.includes("Delivering replied message with 100% native formatting"), "Preview should notice reply-to mode");
  console.log("✓ Reply-to Photo preview generated with native copy mode");

  // Find the broadcast ID created
  const broadcastId1 = Array.from(pendingBroadcasts.keys()).pop();
  assert(broadcastId1, "Should have pending broadcast in map");

  // Confirm broadcast 1
  const ctxConfirm1 = {
    chat: { id: adminId },
    from: { id: adminId },
    telegram: mockTelegram,
    editMessageText: async (text) => {
      editedMessages.push(text);
      return true;
    },
    answerCbQuery: async () => true,
  };

  await bot.trigger(`bc_confirm_${broadcastId1}`, ctxConfirm1);
  assert(copiedMessages.length > 0, "Should use copyMessage for replied photo");
  assert.strictEqual(copiedMessages[0].msgId, 200, "Should copy the replied message ID 200");
  assert(copiedMessages[0].extra?.reply_markup?.inline_keyboard?.length > 0, "Should attach the parsed button");
  console.log("✓ Delivered replied photo with native copyMessage and URL button");

  // -------------------------------------------------------------
  // Test 2: Reply-to-Broadcast (Document / PDF)
  // -------------------------------------------------------------
  console.log("\n[Test 2] Reply-to-Broadcast with Document (PDF Schedule)");
  const ctxReplyDoc = {
    chat: { id: adminId },
    from: { id: adminId },
    message: {
      message_id: 301,
      text: "/broadcast",
      reply_to_message: {
        message_id: 300,
        document: { file_id: "doc_schedule_pdf", file_name: "Academic_Schedule.pdf" },
        caption: "Here is the official Academic Calendar PDF.",
      },
    },
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { message_id: 302, text };
    },
    telegram: mockTelegram,
  };

  await broadcastCommand(ctxReplyDoc);
  const broadcastId2 = Array.from(pendingBroadcasts.keys()).pop();
  await bot.trigger(`bc_confirm_${broadcastId2}`, ctxConfirm1);
  const docCopy = copiedMessages.find((m) => m.msgId === 300);
  assert(docCopy, "Should copy document message ID 300");
  console.log("✓ Delivered replied Document PDF with native copyMessage");

  // -------------------------------------------------------------
  // Test 3: Direct Media with /broadcast Caption
  // -------------------------------------------------------------
  console.log("\n[Test 3] Direct Video with /broadcast caption");
  const ctxDirectVideo = {
    chat: { id: adminId },
    from: { id: adminId },
    message: {
      message_id: 401,
      video: { file_id: "vid_lecture_101" },
      caption: "/broadcast Watch the Orientation Recording!\nBUTTON: Open Stream | https://youtube.com/watch?v=123",
    },
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { message_id: 402, text };
    },
    telegram: mockTelegram,
  };

  await broadcastCommand(ctxDirectVideo);
  const broadcastId3 = Array.from(pendingBroadcasts.keys()).pop();
  await bot.trigger(`bc_confirm_${broadcastId3}`, ctxConfirm1);
  assert(sentVideos.length > 0, "Should deliver video directly");
  assert.strictEqual(sentVideos[0].fileId, "vid_lecture_101");
  assert.strictEqual(sentVideos[0].extra.caption, "Watch the Orientation Recording!");
  assert(sentVideos[0].extra.reply_markup?.inline_keyboard?.length > 0, "Should attach button");
  console.log("✓ Direct video with caption broadcasted cleanly without /broadcast prefix");

  // -------------------------------------------------------------
  // Test 4: Direct Formatted Text with Telegram Entities
  // -------------------------------------------------------------
  console.log("\n[Test 4] Direct Formatted Text with Telegram Entities (Hyperlink + Bold)");
  const rawTextWithCmd = "/broadcast Check out the Student Portal for grades.";
  const ctxDirectText = {
    chat: { id: adminId },
    from: { id: adminId },
    message: {
      message_id: 501,
      text: rawTextWithCmd,
      entities: [
        { type: "bot_command", offset: 0, length: 10 },
        { type: "text_link", offset: 21, length: 14, url: "https://portal.aastu.edu.et" },
      ],
    },
    reply: async (text, extra) => {
      replies.push({ text, extra });
      return { message_id: 502, text };
    },
    telegram: mockTelegram,
  };

  await broadcastCommand(ctxDirectText);
  const broadcastId4 = Array.from(pendingBroadcasts.keys()).pop();
  await bot.trigger(`bc_confirm_${broadcastId4}`, ctxConfirm1);
  assert(sentTexts.length > 0, "Should deliver text message");
  const lastText = sentTexts[sentTexts.length - 1];
  assert.strictEqual(lastText.text, "Check out the Student Portal for grades.");
  assert(lastText.extra?.entities?.length === 1, "Should preserve text_link entity without bot_command");
  assert.strictEqual(lastText.extra.entities[0].type, "text_link");
  assert.strictEqual(lastText.extra.entities[0].url, "https://portal.aastu.edu.et");
  console.log("✓ Text entities and hyperlinks preserved with accurate offset shifting");

  // -------------------------------------------------------------
  // Test 5: Empty Broadcast Command -> Comprehensive Help Guide
  // -------------------------------------------------------------
  console.log("\n[Test 5] Empty /broadcast without reply or text shows Guide");
  let guideSent = false;
  const ctxEmpty = {
    chat: { id: adminId },
    from: { id: adminId },
    message: { message_id: 601, text: "/broadcast" },
    reply: async (text) => {
      if (text.includes("Multi-Format Broadcast") && text.includes("Reply-to-Broadcast")) {
        guideSent = true;
      }
    },
  };
  await broadcastCommand(ctxEmpty);
  assert(guideSent, "Should send user-friendly multi-format broadcast guide");
  console.log("✓ Multi-format broadcast guide verified");

  console.log("\n=== ALL MULTI-FORMAT BROADCAST TESTS PASSED ===");
  await mongoose.disconnect();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
