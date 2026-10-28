require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");

console.log("=== Testing Admin Feature 1: In-Place Panel Navigation & Back Buttons ===");

// 1. Inspect admin panel keyboard and back button definitions
const admin = require("../src/bot/commands/admin");

// Mock Telegraf bot instance to capture registered actions
const registeredActions = new Map();
const mockBot = {
  action: (trigger, handler) => {
    registeredActions.set(trigger.toString(), handler);
  }
};

admin.registerAdminPanelHandlers(mockBot);

// 2. Verify all expected action routes are registered
const expectedActions = [
  "adm_stats",
  "adm_health",
  "adm_pending",
  "adm_logs",
  "adm_scan",
  "adm_indexstatus",
  "adm_broadcast",
  "adm_users",
  "adm_refresh",
  "adm_panel_main",
  "adm_help"
];

expectedActions.forEach(action => {
  assert.ok(registeredActions.has(action), `Action '${action}' must be registered`);
});
console.log("✔ All 11 admin panel actions registered successfully");

// 3. Test In-Place Navigation Simulation for sub-screens
let editedMessage = null;
let answeredAlert = null;

const createMockCtx = (fromId = 123456) => {
  process.env.ADMIN_ID = "123456";
  return {
    from: { id: fromId },
    editMessageText: async (text, extra) => {
      editedMessage = { text, extra };
    },
    answerCbQuery: async (msg, opts) => {
      answeredAlert = { msg, opts };
    },
    reply: async () => {}
  };
};

async function testSubScreen(actionName) {
  const handler = registeredActions.get(actionName);
  const ctx = createMockCtx();
  editedMessage = null;
  answeredAlert = null;

  await handler(ctx);
  assert.ok(editedMessage, `${actionName} must call editMessageText`);
  assert.strictEqual(editedMessage.extra.parse_mode, "HTML", `${actionName} must use HTML parse mode`);
  
  // Verify persistent Back to Admin Panel button
  const inlineButtons = editedMessage.extra.reply_markup?.inline_keyboard;
  assert.ok(inlineButtons, `${actionName} must attach an inline keyboard`);
  const backBtn = inlineButtons.flat().find(b => b.callback_data === "adm_panel_main");
  assert.ok(backBtn, `${actionName} must have a button returning to 'adm_panel_main'`);
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  try {
    await testSubScreen("adm_stats");
    console.log("✔ adm_stats in-place navigation verified");

    await testSubScreen("adm_health");
    console.log("✔ adm_health in-place navigation verified");

    await testSubScreen("adm_logs");
    console.log("✔ adm_logs in-place navigation verified");

    await testSubScreen("adm_users");
    console.log("✔ adm_users in-place navigation verified");

    await testSubScreen("adm_help");
    console.log("✔ adm_help in-place navigation verified");

    // 4. Test adm_panel_main returns to main panel with full dashboard keyboard
    const mainHandler = registeredActions.get("adm_panel_main");
    const ctx = createMockCtx();
    editedMessage = null;

    await mainHandler(ctx);
    assert.ok(editedMessage, "adm_panel_main must edit message");
    assert.ok(editedMessage.text.includes("StudyHub Admin Panel"), "Must show main dashboard title");
    const mainButtons = editedMessage.extra.reply_markup?.inline_keyboard;
    assert.ok(mainButtons.length >= 4, "Main panel must have full grid of action buttons");
    console.log("✔ adm_panel_main return to main dashboard verified");

    console.log("\nALL ADMIN FEATURE 1 TESTS PASSED SUCCESSFULLY! 🚀");
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(err => {
  console.error("Admin Feature 1 Test Error:", err);
  process.exit(1);
});
