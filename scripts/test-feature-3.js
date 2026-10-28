require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const { handleInlineQuery } = require("../src/bot/inline/inlineQuery");
const startCommand = require("../src/bot/commands/start");

async function runTests() {
  console.log("=== Testing Feature 3: Telegram Inline Mode & Deep-Linking ===");
  await mongoose.connect(process.env.MONGO_URI);

  try {
    // 1. Test Empty Inline Query
    let answeredResults = null;
    let answerOptions = null;

    const mockEmptyCtx = {
      inlineQuery: { query: "", offset: "0" },
      from: { id: 999999, first_name: "TestUser" },
      botInfo: { username: "StudyHubBot" },
      answerInlineQuery: async (results, options) => {
        answeredResults = results;
        answerOptions = options;
      }
    };

    await handleInlineQuery(mockEmptyCtx);
    assert.ok(answeredResults && answeredResults.length > 0, "Empty inline query should return suggestion cards");
    assert.strictEqual(answeredResults[0].type, "article", "Should be article type");
    assert.ok(answeredResults[0].title.startsWith("💡"), "Should have suggestion emoji");
    assert.ok(answeredResults[0].input_message_content.message_text.includes("Searching for"), "Should have valid input message content");
    console.log("✔ Empty inline query suggestions verified:", answeredResults.length, "suggestions returned");

    // 2. Test Search Inline Query (e.g. "dbms")
    let searchResults = null;
    let searchOptions = null;

    const mockSearchCtx = {
      inlineQuery: { query: "dbms", offset: "0" },
      from: { id: 999999, first_name: "TestUser" },
      botInfo: { username: "StudyHubBot" },
      answerInlineQuery: async (results, options) => {
        searchResults = results;
        searchOptions = options;
      }
    };

    await handleInlineQuery(mockSearchCtx);
    assert.ok(searchResults && searchResults.length > 0, "Inline search for 'dbms' should return results");
    
    const firstItem = searchResults[0];
    assert.strictEqual(firstItem.type, "article", "Result item should be article type");
    assert.ok(firstItem.title, "Result item must have a title");
    assert.ok(firstItem.description, "Result item must have a description");
    assert.ok(firstItem.input_message_content.message_text, "Must have card HTML message text");
    assert.strictEqual(firstItem.input_message_content.parse_mode, "HTML", "Must be HTML parse mode");

    // Verify deep link button
    assert.ok(firstItem.reply_markup && firstItem.reply_markup.inline_keyboard, "Must have inline keyboard");
    const firstButton = firstItem.reply_markup.inline_keyboard[0][0];
    assert.ok(firstButton.text.includes("Get File"), "Button should offer file retrieval");
    assert.ok(firstButton.url.includes("https://t.me/StudyHubBot?start="), "URL must be valid bot deep link");
    console.log("✔ Active inline search verified with deep-link URL:", firstButton.url);

    // 3. Test Deep-Link Execution in /start
    let downloadHandled = false;
    const fileDelivery = require("../src/telegram/fileDelivery");
    const origHandleDownload = fileDelivery.handleDownload;

    // Temporarily mock handleDownload to verify startCommand forwards payload
    fileDelivery.handleDownload = async (ctx, resId) => {
      downloadHandled = (resId === "mock_resource_123");
    };

    const mockStartCtx = {
      payload: "get_mock_resource_123",
      from: { id: 999999, first_name: "TestUser", username: "testuser" },
      reply: async () => {},
      scene: { enter: () => {} }
    };

    await startCommand(mockStartCtx);
    assert.ok(downloadHandled, "/start get_mock_resource_123 should trigger handleDownload");
    console.log("✔ Deep-link /start payload routing verified");

    // Restore original method
    fileDelivery.handleDownload = origHandleDownload;

    console.log("\nALL FEATURE 3 TESTS PASSED SUCCESSFULLY! 🚀");
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error("Feature 3 Test Error:", err);
  process.exit(1);
});
