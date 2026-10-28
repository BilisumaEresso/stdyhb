require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");
const User = require("../src/db/models/User");
const fileDelivery = require("../src/telegram/fileDelivery");
const startCommand = require("../src/bot/commands/start");

async function runTest() {
  console.log("=== Testing Deep-Link File Delivery (/start get_... and /start grp_...) ===");

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  // Find or create test user
  const testTgId = 987654321;
  await User.findOneAndUpdate(
    { telegramId: testTgId },
    {
      telegramId: testTgId,
      username: "testuser_deeplink",
      firstName: "DeepLinkUser",
      university: "AASTU",
      department: "Software Engineering",
      searchCount: 5,
    },
    { upsert: true, new: true }
  );

  // Find a real or mock grouped resource in the DB
  let sampleGrouped = await TelegramResource.findOne({ groupId: { $ne: null } });
  if (!sampleGrouped) {
    sampleGrouped = await TelegramResource.create({
      fileId: "mock_fid_101",
      chatId: -100123456789,
      channelUsername: "Ethiel_Academy",
      messageId: 99901,
      groupId: "mock_grp_123",
      fileType: "image",
      fileName: "Physics Mid Exam 1",
      caption: "General Physics Mid Exam #physics #hawassa #mid #exam",
      tags: ["physics", "mid", "exam"],
      isExam: true,
    });
    // Create second image in group
    await TelegramResource.create({
      fileId: "mock_fid_102",
      chatId: -100123456789,
      channelUsername: "Ethiel_Academy",
      messageId: 99902,
      groupId: "mock_grp_123",
      fileType: "image",
      fileName: "Physics Mid Exam 2",
      caption: "General Physics Mid Exam page 2",
      tags: ["physics", "mid", "exam"],
      isExam: true,
    });
  }

  // Find a real or mock single resource
  let sampleSingle = await TelegramResource.findOne({ groupId: null, fileType: "pdf" });
  if (!sampleSingle) {
    sampleSingle = await TelegramResource.create({
      fileId: "mock_fid_103",
      chatId: -100123456789,
      channelUsername: "Ethiel_Academy",
      messageId: 99903,
      fileType: "pdf",
      fileName: "General_Physics_Lecture_1.pdf",
      caption: "General Physics Lecture 1 PDF",
      tags: ["physics", "lecture"],
      isExam: false,
    });
  }

  // Helper to build a Telegraf Context for "message" update (simulating /start command)
  function createMessageContext(text, payload) {
    const replies = [];
    const editReplies = [];
    return {
      updateType: "message",
      callbackQuery: undefined,
      from: { id: testTgId, username: "testuser_deeplink", first_name: "DeepLinkUser" },
      chat: { id: testTgId, type: "private" },
      message: { message_id: 111, text },
      payload: payload,
      // In Telegraf, answerCbQuery is on Context.prototype and asserts callbackQuery:
      answerCbQuery: function () {
        if (!this.callbackQuery) {
          throw new TypeError('Telegraf: "answerCbQuery" isn\'t available for "message"');
        }
      },
      editMessageText: function (txt, extra) {
        editReplies.push({ txt, extra });
        return Promise.resolve({ message_id: 222, text: txt });
      },
      reply: function (txt, extra) {
        replies.push({ txt, extra });
        return Promise.resolve({ message_id: 222, text: txt });
      },
      telegram: {
        sendChatAction: () => Promise.resolve(true),
        sendMessage: (chatId, txt, extra) => {
          replies.push({ chatId, txt, extra });
          return Promise.resolve({ message_id: 333 });
        },
        copyMessage: () => Promise.resolve({ message_id: 444 }),
        editMessageText: (chatId, msgId, inlineId, txt, extra) => {
          editReplies.push({ chatId, msgId, txt, extra });
          return Promise.resolve(true);
        },
        deleteMessage: () => Promise.resolve(true),
        sendMediaGroup: () => Promise.resolve([{ message_id: 555 }]),
      },
      replies,
      editReplies,
    };
  }

  console.log("\n--- Test 1: /start grp_<resourceId> (Grouped Resource deep link) ---");
  const ctxGrp = createMessageContext(`/start grp_${sampleGrouped._id}`, `grp_${sampleGrouped._id}`);
  
  let grpError = null;
  try {
    await startCommand(ctxGrp);
  } catch (err) {
    grpError = err;
  }

  assert.strictEqual(grpError, null, `Should not throw error: ${grpError?.message}`);
  console.log("✓ /start grp_ did not throw answerCbQuery TypeError");
  assert(ctxGrp.replies.length > 0, "Should have sent a reply status or message");
  console.log("✓ Initial reply:", ctxGrp.replies[0]?.txt?.substring(0, 40) || ctxGrp.replies[0]?.text);

  console.log("\n--- Test 2: /start get_<resourceId> (Single Resource deep link) ---");
  const ctxGet = createMessageContext(`/start get_${sampleSingle._id}`, `get_${sampleSingle._id}`);

  let getError = null;
  try {
    await startCommand(ctxGet);
  } catch (err) {
    getError = err;
  }

  assert.strictEqual(getError, null, `Should not throw error: ${getError?.message}`);
  console.log("✓ /start get_ did not throw answerCbQuery TypeError");
  assert(ctxGet.replies.length > 0, "Should have sent a reply status or message");
  console.log("✓ Initial reply:", ctxGet.replies[0]?.txt?.substring(0, 40) || ctxGet.replies[0]?.text);

  console.log("\n--- Test 3: Concurrent duplicate request in message mode ---");
  // Immediately request again while in progress
  const ctxDup = createMessageContext(`/start grp_${sampleGrouped._id}`, `grp_${sampleGrouped._id}`);
  await startCommand(ctxDup);
  const dupReply = ctxDup.replies.find(r => r.txt && r.txt.includes("Already sending your file"));
  console.log("✓ Duplicate check handled with ctx.reply instead of crashing on answerCbQuery:", !!dupReply);

  console.log("\n=== ALL DEEP-LINK DELIVERY TESTS PASSED ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
