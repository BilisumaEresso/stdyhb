const assert = require("assert");
const { getMainKeyboard } = require("../src/bot/keyboards");
const { BOT_COMMANDS, configureTelegramMenu } = require("../src/bot/menuConfig");

async function runTests() {
  console.log("=== RUNNING TELEGRAM BOT MENU & KEYBOARD TESTS ===");

  // Test 1: getMainKeyboard structure
  console.log("[TEST 1] Verifying getMainKeyboard properties...");
  const keyboard = getMainKeyboard();
  assert.ok(keyboard.reply_markup, "Keyboard must have reply_markup");
  assert.strictEqual(
    keyboard.reply_markup.is_persistent,
    true,
    "Keyboard must have is_persistent: true"
  );
  assert.strictEqual(
    keyboard.reply_markup.resize_keyboard,
    true,
    "Keyboard must have resize_keyboard: true"
  );
  assert.ok(
    keyboard.reply_markup.input_field_placeholder,
    "Keyboard must have input_field_placeholder"
  );
  assert.strictEqual(
    keyboard.reply_markup.keyboard.length,
    3,
    "Keyboard must have 3 rows"
  );

  // Check buttons
  const row1 = keyboard.reply_markup.keyboard[0];
  assert.strictEqual(row1[0].text, "🌐 Open Web App", "Row 1 Col 1 must be Open Web App");
  assert.ok(row1[0].web_app, "Row 1 Col 1 must have web_app target");
  assert.strictEqual(row1[1], "🔍 Search Resources", "Row 1 Col 2 must be Search Resources");

  console.log("✅ getMainKeyboard properties passed!");

  // Test 2: BOT_COMMANDS definitions
  console.log("[TEST 2] Verifying BOT_COMMANDS list...");
  const commandNames = BOT_COMMANDS.map((c) => c.command);
  assert.ok(commandNames.includes("start"), "Commands must include /start");
  assert.ok(commandNames.includes("search"), "Commands must include /search");
  assert.ok(commandNames.includes("menu"), "Commands must include /menu");
  assert.ok(commandNames.includes("web"), "Commands must include /web");
  assert.ok(commandNames.includes("saves"), "Commands must include /saves");
  assert.ok(commandNames.includes("help"), "Commands must include /help");
  assert.ok(commandNames.includes("profile"), "Commands must include /profile");
  console.log("✅ BOT_COMMANDS list passed!");

  // Test 3: configureTelegramMenu sets type: commands (not web_app)
  console.log("[TEST 3] Verifying configureTelegramMenu mock execution...");
  let menuButtonArg = null;
  let commandsArg = null;

  const mockBot = {
    telegram: {
      setChatMenuButton: async (arg) => {
        menuButtonArg = arg;
        return true;
      },
      setMyCommands: async (cmds) => {
        commandsArg = cmds;
        return true;
      },
    },
  };

  const configured = await configureTelegramMenu(mockBot, 1, 10);
  assert.strictEqual(configured, true, "configureTelegramMenu must return true on success");
  assert.ok(menuButtonArg, "setChatMenuButton must be called");
  assert.strictEqual(
    menuButtonArg.menuButton.type,
    "commands",
    "Menu button type must be 'commands', never 'web_app'!"
  );
  assert.ok(Array.isArray(commandsArg), "setMyCommands must receive commands array");
  assert.strictEqual(
    commandsArg.length,
    BOT_COMMANDS.length,
    "setMyCommands must register all BOT_COMMANDS"
  );
  console.log("✅ configureTelegramMenu mock execution passed!");

  console.log("\n🎉 ALL TELEGRAM BOT MENU TESTS PASSED CLEANLY!");
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
