require("dotenv").config();
const assert = require("assert");
const templates = require("../src/telegram/templates");

// Sample mock resources
const mockResults = [
  { _id: "1", fileName: "calculus_exam_2023.pdf", fileType: "pdf", isExam: true },
  { _id: "2", fileName: null, caption: "Physics 1 Midterm Exam Solutions", fileType: "image", _isGrouped: true, groupSize: 5 },
  { _id: "3", fileName: "Lecture_04_Trees.pptx", fileType: "ppt", caption: "CS101 slides" },
  { _id: "4", fileName: "Biology_Textbook.pdf", fileType: "pdf" },
  { _id: "5", fileName: "AASTU_Database_Final.pdf", fileType: "pdf", channelUsername: "aastu_materials" }
];

const mockUser = {
  university: "AASTU"
};

console.log("=== Testing Feature 1: Filter Pills ===");

// 1. Test Filter Pills UI Generation
const pillsAll = templates.renderFilterPills("a1b2c3d4", "all");
assert.strictEqual(pillsAll.length, 2, "Pills should be in 2 rows");
assert.strictEqual(pillsAll[0][0].text, "• 🔄 All •", "Active filter 'all' should have bullet indicators");
assert.strictEqual(pillsAll[0][1].text, "🎓 Exams", "Inactive filter should have standard label");
console.log("✔ renderFilterPills markup test passed.");

const pillsExam = templates.renderFilterPills("a1b2c3d4", "exam");
assert.strictEqual(pillsExam[0][1].text, "• 🎓 Exams •", "Active filter 'exam' should have bullet indicators");
console.log("✔ renderFilterPills selection indicator test passed.");

// 2. Test Number Buttons with activeFilter
const numButtons = templates.renderNumberButtons("a1b2c3d4", 1, 3, "exam");
assert.strictEqual(numButtons[0][0].callback_data, "num_a1b2c3d4_1_0_exam", "Number callback must preserve filter");
console.log("✔ renderNumberButtons filter callback test passed.");

// 3. Test Nav Buttons with activeFilter
const navButtons = templates.renderNavButtons("a1b2c3d4", 1, 3, "ppt");
assert.strictEqual(navButtons[0].callback_data, "noop", "Prev button on page 1 should be noop");
assert.strictEqual(navButtons[2].callback_data, "pg_a1b2c3d4_2_ppt", "Next button must preserve filter");
console.log("✔ renderNavButtons filter callback test passed.");

// 4. Test renderListTemplate with filter badge
const listAll = templates.renderListTemplate("physics", 5, 1, 1, mockResults, "all");
assert.ok(!listAll.includes("· 🎓 <b>Exams</b>"), "All filter shouldn't have specific filter badge");

const listExam = templates.renderListTemplate("physics", 2, 1, 1, mockResults.slice(0, 2), "exam");
assert.ok(listExam.includes("· 🎓 <b>Exams</b>"), "Exam filter should include exam badge");
console.log("✔ renderListTemplate badges test passed.");

console.log("\nALL FEATURE 1 TESTS PASSED SUCCESSFULLY! 🚀");
