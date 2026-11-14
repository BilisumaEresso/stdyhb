const assert = require("assert");
const path = require("path");

async function runTests() {
  console.log("=== STUDYHUB 2.1 INTEGRATION TEST SUITE ===");

  // 1. Version Check
  const rootPkg = require("../package.json");
  const webPkg = require("../web/package.json");
  console.log(`[TEST 1] Root package.json version: ${rootPkg.version}`);
  console.log(`[TEST 1] Web package.json version: ${webPkg.version}`);
  assert.strictEqual(rootPkg.version, "2.1.0", "Root version must be 2.1.0");
  assert.strictEqual(webPkg.version, "2.1.0", "Web version must be 2.1.0");
  console.log("✅ Version check passed!");

  // 2. Admin Check
  const { isAdminUser } = require("../src/bot/commands/admin");
  process.env.ADMIN_ID = "1406047509, 99999999";
  assert.strictEqual(isAdminUser(1406047509), true, "Numeric ID should match");
  assert.strictEqual(isAdminUser("1406047509"), true, "String ID should match");
  assert.strictEqual(isAdminUser("99999999"), true, "Whitespace-padded ID should match");
  assert.strictEqual(isAdminUser("12345678"), false, "Non-admin ID should not match");
  assert.strictEqual(isAdminUser(null), false, "Null should not match");
  console.log("✅ isAdminUser logic passed!");

  // 3. About View Check
  const { renderAboutView, renderHelpHub } = require("../src/bot/commands/help");
  const aboutAdmin = renderAboutView({ totalResources: 1000, totalChannels: 25 }, true);
  const aboutStudent = renderAboutView({ totalResources: 1000, totalChannels: 25 }, false);

  // Check admin button presence
  const adminButtons = aboutAdmin.keyboard.reply_markup.inline_keyboard.flat();
  const hasAdminBtn = adminButtons.some(b => b.text && b.text.includes("Admin Panel"));
  assert.strictEqual(hasAdminBtn, true, "Admin view must have Admin Panel button");

  const studentButtons = aboutStudent.keyboard.reply_markup.inline_keyboard.flat();
  const studentHasAdminBtn = studentButtons.some(b => b.text && b.text.includes("Admin Panel"));
  assert.strictEqual(studentHasAdminBtn, false, "Student view must NOT have Admin Panel button");

  // Check web & channel buttons
  const hasWebBtn = adminButtons.some(b => b.text && (b.text.includes("Visit Web") || b.text.includes("Visit Website")) && b.url.includes("webstudyhub.vercel.app"));
  const hasChannelBtn = adminButtons.some(b => b.text && (b.text.includes("Join Channel") || b.text.includes("Official Channel")) && b.url.includes("t.me/studyhub_et"));
  assert.strictEqual(hasWebBtn, true, "About view must have Visit Web button");
  assert.strictEqual(hasChannelBtn, true, "About view must have Join Channel button");

  // Check version in text
  assert.ok(aboutAdmin.text.includes("v2.1.0"), "About view must show v2.1.0");
  assert.ok(aboutAdmin.text.includes("webstudyhub.vercel.app"), "About view must mention website");
  assert.ok(aboutAdmin.text.includes("@studyhub_et"), "About view must mention @studyhub_et");
  console.log("✅ About view rendering passed!");

  // 4. Search Results Template Check
  const templates = require("../src/telegram/templates");
  const listMsg = templates.renderListTemplate("calculus", 1, 1, 1, [{
    fileName: "calculus_exam.pdf",
    cleanTitle: "Calculus Final Exam",
    fileType: "pdf",
    fileSize: 1024 * 1024,
    channelUsername: "freshman_materials"
  }]);

  assert.ok(listMsg.includes("Calculus Final Exam"), "Search result list must show resource title");
  // Ensure message does NOT contain raw HTML links that trigger Telegram automatic preview cards
  assert.strictEqual(listMsg.includes('<a href="https://webstudyhub.vercel.app">'), false, "Search list must not contain preview-triggering link tags");
  console.log("✅ Search list template passed!");

  // 5. Detail Card Template Check
  const detailMsg = templates.renderDetailCard({
    _id: "67890abcdef",
    fileName: "physics_quiz.pdf",
    cleanTitle: "Physics Quiz 1",
    fileType: "pdf",
    fileSize: 500000,
    channelUsername: "freshman_materials"
  });

  assert.ok(detailMsg.includes("@freshman_materials"), "Detail card must display channel handle");
  assert.strictEqual(detailMsg.includes('<a href="https://t.me/freshman_materials'), false, "Detail card must avoid raw t.me links that trigger previews");
  console.log("✅ Detail card template passed!");

  // 6. Welcome Messages Check
  const welcomeNewMsg = templates.welcomeNew({ firstName: "Abebe" });
  assert.ok(welcomeNewMsg.includes("Abebe"), "Welcome new must include user name");
  assert.strictEqual(welcomeNewMsg.includes('<a href="https://webstudyhub.vercel.app">'), false, "Welcome new must avoid preview-generating link tags");

  const welcomeReturningMsg = templates.welcomeReturning({ firstName: "Abebe" });
  assert.ok(welcomeReturningMsg.includes("Abebe"), "Welcome returning must include user name");
  assert.strictEqual(welcomeReturningMsg.includes('<a href="https://webstudyhub.vercel.app">'), false, "Welcome returning must avoid preview-generating link tags");
  console.log("✅ Welcome messages passed!");

  console.log("\n🎉 ALL INTEGRATION TESTS PASSED CLEANLY!");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
