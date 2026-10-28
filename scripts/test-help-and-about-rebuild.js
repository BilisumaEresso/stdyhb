/**
 * Comprehensive verification script for Help, About & Developer Rebuild (StudyHub 2.0.0)
 */

require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const packageInfo = require("../package.json");

const {
  helpCommand,
  aboutCommand,
  developerCommand,
  renderHelpHub,
  renderSearchGuide,
  renderCommandsGuide,
  renderAboutView,
  renderDeveloperView,
  getLiveSystemStats,
  registerHelpHandlers,
} = require("../src/bot/commands/help");

async function runTests() {
  console.log("=================================================");
  console.log("🧪 TESTING HELP, ABOUT & DEVELOPER SUITE (v2.0.0)");
  console.log("=================================================");

  // 1. Version check
  console.log("\n[Test 1] Verify package.json version is 2.0.0");
  assert.strictEqual(packageInfo.version, "2.0.0", "Version must be bumped to 2.0.0");
  console.log(`  ✓ Version verified: ${packageInfo.version}`);

  // 2. Test Help Hub View
  console.log("\n[Test 2] Verify renderHelpHub view");
  const studentHub = renderHelpHub(false);
  assert.ok(studentHub.text.includes("Academic Help Center"), "Hub header missing");
  assert.ok(
    studentHub.keyboard.reply_markup.inline_keyboard.length >= 3,
    "Hub should have multiple button rows"
  );
  console.log("  ✓ Student Help Hub rendered correctly");

  const adminHub = renderHelpHub(true);
  assert.ok(adminHub.text.includes("Admin Operator:"), "Admin badge missing in admin view");
  console.log("  ✓ Admin Help Hub rendered correctly");

  // 3. Test Search Guide View
  console.log("\n[Test 3] Verify renderSearchGuide view");
  const searchGuide = renderSearchGuide(false);
  assert.ok(searchGuide.text.includes("Search Mastery Guide"), "Guide header missing");
  assert.ok(searchGuide.text.includes("Natural Query Search"), "Search section missing");
  assert.ok(searchGuide.text.includes("Inline Search"), "Inline search section missing");
  assert.ok(searchGuide.text.includes("Photo Exam Bundles"), "Exam set section missing");
  console.log("  ✓ Search Guide rendered with comprehensive tips");

  // 4. Test Commands Guide View
  console.log("\n[Test 4] Verify renderCommandsGuide view");
  const studentCommands = renderCommandsGuide(false);
  assert.ok(studentCommands.text.includes("/search"), "Student commands missing /search");
  assert.ok(studentCommands.text.includes("/about"), "Student commands missing /about");
  assert.ok(studentCommands.text.includes("/dev"), "Student commands missing /dev");
  assert.ok(!studentCommands.text.includes("/admin"), "Student should not see /admin in guide");

  const adminCommands = renderCommandsGuide(true);
  assert.ok(adminCommands.text.includes("/admin"), "Admin should see /admin in guide");
  assert.ok(adminCommands.text.includes("/broadcast"), "Admin should see /broadcast in guide");
  console.log("  ✓ Commands Guide properly conditionally rendered for student and admin");

  // 5. Test Live System Stats & About View
  console.log("\n[Test 5] Verify getLiveSystemStats & renderAboutView");
  const stats = await getLiveSystemStats();
  console.log(`  ✓ Live Stats retrieved: ${stats.totalResources} materials, ${stats.totalChannels} channels`);
  
  const aboutView = renderAboutView(stats, false);
  assert.ok(aboutView.text.includes("v2.0.0"), "About view missing version 2.0.0");
  assert.ok(aboutView.text.includes(stats.totalResources.toLocaleString()), "About view missing total materials count");
  assert.ok(aboutView.text.includes("System Highlights"), "About view missing system highlights section");
  console.log("  ✓ About StudyHub rendered with dynamic stats and version 2.0.0");

  // 6. Test Developer View
  console.log("\n[Test 6] Verify renderDeveloperView");
  const devView = renderDeveloperView(false);
  assert.ok(devView.text.includes("About the Developer"), "Developer header missing");
  assert.ok(devView.text.includes("Lead Engineer:"), "Lead Engineer section missing");
  assert.ok(devView.text.includes("Billy"), "Developer name Billy missing");
  assert.ok(devView.text.includes("bilisumaeresso.vercel.app"), "Developer portfolio URL missing from text");
  assert.ok(devView.text.includes("Core Technologies"), "Technologies section missing");
  assert.ok(devView.text.includes("Vision & Commitment"), "Vision missing");
  
  // Verify portfolio button exists in keyboard
  const keyboardButtons = devView.keyboard.reply_markup.inline_keyboard.flat();
  const portfolioBtn = keyboardButtons.find((btn) => btn.text.includes("Portfolio"));
  assert.ok(portfolioBtn, "Portfolio button missing from keyboard");
  assert.strictEqual(portfolioBtn.url, "https://bilisumaeresso.vercel.app", "Portfolio button URL mismatch");
  console.log("  ✓ Developer Spotlight rendered with rich profile, mission statement, and portfolio link");

  // 7. Test Bot Command Invocations (Message & CallbackQuery contexts)
  console.log("\n[Test 7] Verify Command Handlers (Message context)");
  let repliedText = "";
  let repliedExtra = null;
  const mockMsgCtx = {
    chat: { id: 12345, type: "private" },
    from: { id: 99999, first_name: "Abebe" },
    reply: async (text, extra) => {
      repliedText = text;
      repliedExtra = extra;
      return { message_id: 101 };
    },
  };

  await helpCommand(mockMsgCtx);
  assert.ok(repliedText.includes("Academic Help Center"), "helpCommand reply failed");

  await aboutCommand(mockMsgCtx);
  assert.ok(repliedText.includes("v2.0.0"), "aboutCommand reply failed");

  await developerCommand(mockMsgCtx);
  assert.ok(repliedText.includes("About the Developer"), "developerCommand reply failed");
  console.log("  ✓ Direct command invocations executed successfully");

  // 8. Test Callback Query Context (in-place message editing)
  console.log("\n[Test 8] Verify Callback Query in-place editing");
  let editedText = "";
  let answeredCb = false;
  const mockCbCtx = {
    chat: { id: 12345, type: "private" },
    from: { id: 99999, first_name: "Abebe" },
    updateType: "callback_query",
    callbackQuery: { id: "cb_1", data: "about_developer" },
    editMessageText: async (text, extra) => {
      editedText = text;
      return true;
    },
    answerCbQuery: async () => {
      answeredCb = true;
      return true;
    },
    reply: async (text) => {
      editedText = text;
      return true;
    },
  };

  await developerCommand(mockCbCtx);
  assert.ok(editedText.includes("About the Developer"), "developerCommand editMessageText failed");
  assert.strictEqual(answeredCb, true, "Callback query must be acknowledged");
  console.log("  ✓ In-place navigation via callback queries verified");

  // 9. Test Action Registrations
  console.log("\n[Test 9] Verify registerHelpHandlers registrations");
  const registeredActions = {};
  const mockBot = {
    action: (name, handler) => {
      registeredActions[name] = handler;
    },
  };
  registerHelpHandlers(mockBot);
  assert.ok(registeredActions["help_main"], "help_main missing");
  assert.ok(registeredActions["nav_help"], "nav_help missing");
  assert.ok(registeredActions["help_search"], "help_search missing");
  assert.ok(registeredActions["help_commands"], "help_commands missing");
  assert.ok(registeredActions["about_studyhub"], "about_studyhub missing");
  assert.ok(registeredActions["about_developer"], "about_developer missing");
  console.log(`  ✓ All 6 interactive navigation handlers registered`);

  console.log("\n=================================================");
  console.log("🎉 ALL HELP, ABOUT & DEVELOPER TESTS PASSED (100%)");
  console.log("=================================================");
}

runTests()
  .catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(0);
  });
