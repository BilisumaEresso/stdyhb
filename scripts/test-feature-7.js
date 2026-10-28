const assert = require("assert");
const templates = require("../src/telegram/templates");

console.log("=== Testing Feature 7: Campus Personalization Badges in Search Results ===");

const mockUserAastu = {
  university: "AASTU"
};

const mockUserHaramaya = {
  university: "Haramaya"
};

const mockUserNoUni = {
  university: ""
};

const resourceAastu = {
  _id: "res_1",
  fileName: "Database_Systems_Final.pdf",
  fileType: "pdf",
  fileSize: 1048576,
  channelUsername: "aastu_soft_eng",
  isExam: true
};

const resourceHaramaya = {
  _id: "res_2",
  fileName: "Exit_Exam_Model.pdf",
  fileType: "pdf",
  fileSize: 2048576,
  caption: "Haramaya University 2016 Model Exam",
  channelUsername: "general_exams",
  isExam: true
};

// 1. Test isCampusResource helper
assert.strictEqual(templates.isCampusResource(resourceAastu, mockUserAastu), true, "Should match AASTU channel");
assert.strictEqual(templates.isCampusResource(resourceAastu, mockUserHaramaya), false, "Should not match different campus");
assert.strictEqual(templates.isCampusResource(resourceHaramaya, mockUserHaramaya), true, "Should match Haramaya caption");
assert.strictEqual(templates.isCampusResource(resourceAastu, mockUserNoUni), false, "Should return false if user has no university");
assert.strictEqual(templates.isCampusResource(resourceAastu, null), false, "Should return false if user is null");
console.log("✔ isCampusResource matching logic verified");

// 2. Test renderListTemplate with Campus Badge
const listAastu = templates.renderListTemplate("database", 1, 1, 1, [resourceAastu], "all", mockUserAastu);
assert.ok(listAastu.includes("🏛️ <b>[AASTU]</b>"), "Matching campus item must include campus badge");

const listOther = templates.renderListTemplate("database", 1, 1, 1, [resourceAastu], "all", mockUserHaramaya);
assert.ok(!listOther.includes("🏛️ <b>[HARAMAYA]</b>"), "Non-matching campus item must not include badge");
console.log("✔ renderListTemplate campus badge verified");

// 3. Test renderDetailCard with Campus Header Badge & Profile Prompt
const cardAastu = templates.renderDetailCard(resourceAastu, mockUserAastu);
assert.ok(cardAastu.includes("🏛️ <b>My Campus (AASTU)</b>"), "Detail card must include My Campus header badge");
assert.ok(!cardAastu.includes("Set your university in /profile"), "User with uni should not see profile prompt");

const cardNoUni = templates.renderDetailCard(resourceAastu, mockUserNoUni);
assert.ok(!cardNoUni.includes("🏛️ <b>My Campus"), "User without uni should not see campus badge");
assert.ok(cardNoUni.includes("Set your university in /profile"), "User without uni should see prompt to set campus");
console.log("✔ renderDetailCard campus header and profile tips verified");

console.log("\nALL FEATURE 7 TESTS PASSED SUCCESSFULLY! 🚀");
