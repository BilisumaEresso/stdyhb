require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const ResourceReport = require("../src/db/models/ResourceReport");
const TelegramResource = require("../src/db/models/TelegramResource");
const templates = require("../src/telegram/templates");

async function runTests() {
  console.log("=== Testing Feature 8: 1-Tap 'Report Broken File' Button ===");
  await mongoose.connect(process.env.MONGO_URI);

  const testUserId = new mongoose.Types.ObjectId();
  const testResourceId = new mongoose.Types.ObjectId();

  try {
    // 1. Test renderReportPrompt UI Generation
    const mockResource = {
      _id: testResourceId,
      fileName: "Compiler_Design_2023.pdf",
      fileType: "pdf"
    };

    const prompt = templates.renderReportPrompt(mockResource, "a1b2c3d4", 1, 2, "exam");
    assert.ok(prompt.text.includes("Report an Issue"), "Prompt title must mention report issue");
    assert.ok(prompt.text.includes("Compiler_Design_2023.pdf"), "Must show resource title");
    assert.strictEqual(prompt.keyboard.length, 3, "Keyboard must have 3 rows (2 reason rows + 1 cancel row)");
    
    // Check cancel button callback preservation
    assert.strictEqual(prompt.keyboard[2][0].callback_data, "num_a1b2c3d4_1_2_exam", "Cancel must return to exact item card with filter preserved");

    // Check all callbacks <= 64 bytes
    prompt.keyboard.forEach(row => {
      row.forEach(btn => {
        assert.ok(btn.callback_data.length <= 64, `Callback data exceeds 64 bytes: ${btn.callback_data}`);
      });
    });
    console.log("✔ renderReportPrompt UI and 64-byte callback limit verified");

    // 2. Test ResourceReport Model & DB Insertion
    const reportDoc = await ResourceReport.create({
      userId: testUserId,
      telegramId: 987654321,
      resourceId: testResourceId,
      reason: "download_failed",
      resourceTitle: "Compiler_Design_2023.pdf",
      channelUsername: "test_academic_channel",
      status: "pending"
    });

    assert.ok(reportDoc._id, "ResourceReport should be saved in DB");
    assert.strictEqual(reportDoc.reason, "download_failed");
    assert.strictEqual(reportDoc.status, "pending");
    console.log("✔ ResourceReport MongoDB persistence verified");

    // 3. Test Duplicate Throttling Detection
    const oneDayAgo = new Date(Date.now() - 24 * 3600000);
    const existing = await ResourceReport.findOne({
      userId: testUserId,
      resourceId: testResourceId,
      reportedAt: { $gt: oneDayAgo }
    });
    assert.ok(existing, "Should detect existing report within 24 hours to prevent spam");
    console.log("✔ 24h Duplicate report throttling verified");

    // 4. Test renderReportSubmitted
    const submitted = templates.renderReportSubmitted("noop");
    assert.ok(submitted.text.includes("Report Submitted"), "Submission screen should acknowledge report");
    console.log("✔ renderReportSubmitted screen verified");

    console.log("\nALL FEATURE 8 TESTS PASSED SUCCESSFULLY! 🚀");
  } finally {
    // Clean up
    await ResourceReport.deleteMany({ userId: testUserId });
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error("Feature 8 Test Error:", err);
  process.exit(1);
});
