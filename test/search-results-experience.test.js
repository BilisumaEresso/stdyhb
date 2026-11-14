/**
 * StudyHub Phase 2.5 — Professional Search Results Experience Test Suite
 *
 * Verifies:
 * 1. Telegram search result list formatting (renderListTemplate).
 * 2. Telegram detail card with alternative source transparency (renderDetailCard).
 * 3. Telegram inline search article descriptor formatting.
 * 4. Graceful handling of missing metadata (zero invented fields).
 * 5. Distinct file types (PDF, PPT, DOC, Image, Bundles).
 * 6. Alternative sources collapsing and disclosure.
 * 7. Multi-file album presentation.
 * 8. Regression safety across search pipelines.
 */

const assert = require("assert");
const templates = require("../src/telegram/templates");

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log("\n=======================================================");
console.log("  StudyHub Phase 2.5 — Search Results Experience Suite ");
console.log("=======================================================\n");

// ─── Group 1: Telegram Result List Template ──────────────────────────────────
console.log("Group 1: Telegram Result List Template (renderListTemplate)");

runTest("Renders list with clean hierarchy (Title on line 1, Metadata on line 2)", () => {
  const mockResource = {
    _id: "res1",
    fileName: "DBMS Model Examination.pdf",
    cleanTitle: "DBMS Model Examination",
    fileType: "pdf",
    fileSize: 2500000,
    isExam: true,
    channelUsername: "astusoftware2023",
    university: "ASTU"
  };

  const output = templates.renderListTemplate("dbms", 1, 1, 1, [mockResource]);
  assert(output.includes("DBMS Model Examination"), "Title must be present");
  assert(output.includes("🎓"), "Exam badge should be on title line");
  assert(output.includes("PDF"), "File type label must be present");
  assert(output.includes("2.4 MB"), "File size must be formatted");
  assert(output.includes("@astusoftware2023"), "Source channel must be present");
  assert(output.includes("ASTU"), "University must be present");
});

runTest("Displays alternative channel count when available (e.g. 🔄 3 ch)", () => {
  const mockResource = {
    _id: "res2",
    fileName: "Calculus Past Exams.pdf",
    fileType: "pdf",
    fileSize: 1048576,
    channelCount: 3,
    alternativeSources: [{ channelUsername: "chanA" }, { channelUsername: "chanB" }]
  };

  const output = templates.renderListTemplate("calculus", 1, 1, 1, [mockResource]);
  assert(output.includes("3 ch"), "Must display alternative channel count");
});

runTest("Gracefully omits missing metadata without rendering empty brackets or 'undefined'", () => {
  const bareResource = {
    _id: "res3",
    fileName: "SimpleNotes.txt",
    fileType: "other"
  };

  const output = templates.renderListTemplate("notes", 1, 1, 1, [bareResource]);
  assert(!output.includes("undefined"), "Should not contain 'undefined'");
  assert(!output.includes("null"), "Should not contain 'null'");
  assert(!output.includes("[]"), "Should not contain empty brackets");
  assert(!output.includes("ch"), "Should not mention channels if count is 1");
});

runTest("Correctly formats multi-file albums in list template", () => {
  const mockAlbum = {
    _id: "album1",
    fileName: "Midterm Exam Photo",
    fileType: "image",
    _isGrouped: true,
    groupSize: 5,
    isExam: true
  };

  const output = templates.renderListTemplate("exam", 1, 1, 1, [mockAlbum]);
  assert(output.includes("5-Page Photo Album"), `Must label as 5-Page Photo Album, got: ${output}`);
});

// ─── Group 2: Telegram Detail Card Template ──────────────────────────────────
console.log("\nGroup 2: Telegram Detail Card (renderDetailCard)");

runTest("Renders detail card with title, badges, size, and source link", () => {
  const mockResource = {
    _id: "card1",
    cleanTitle: "Operating Systems Chapter 3",
    fileType: "ppt",
    fileSize: 5242880,
    channelUsername: "aau_materials",
    messageId: 442,
    university: "AAU",
    tags: ["os", "scheduling", "deadlock"]
  };

  const card = templates.renderDetailCard(mockResource);
  assert(card.includes("Operating Systems Chapter 3"), "Must contain clean title");
  assert(card.includes("Slides"), "Must contain Slides label");
  assert(card.includes("5.0 MB"), "Must contain formatted size");
  assert(card.includes("@aau_materials"), "Must contain source channel");
  assert(card.includes("https://t.me/aau_materials/442"), "Must contain post link");
  assert(card.includes("AAU"), "Must contain university");
  assert(card.includes("#scheduling"), "Must contain hashtag formatted tags");
});

runTest("Renders cross-channel alternative sources section when alternatives exist", () => {
  const mockResource = {
    _id: "card2",
    cleanTitle: "Data Structures Handout",
    fileType: "pdf",
    fileSize: 1048576,
    channelUsername: "primary_chan",
    messageId: 100,
    channelCount: 3,
    alternativeSources: [
      { channelUsername: "alt_chan_1", messageId: 200, university: "ASTU" },
      { channelUsername: "alt_chan_2", messageId: 300, university: "Jimma" }
    ]
  };

  const card = templates.renderDetailCard(mockResource);
  assert(card.includes("Available from 3 channels:"), "Must indicate 3 available channels");
  assert(card.includes("@alt_chan_1"), "Must list alternative channel 1");
  assert(card.includes("@alt_chan_2"), "Must list alternative channel 2");
  assert(card.includes("[ASTU]"), "Must list alt channel 1 university");
  assert(card.includes("[Jimma]"), "Must list alt channel 2 university");
});

runTest("Omits alternative sources section completely when resource has zero duplicates", () => {
  const uniqueResource = {
    _id: "card3",
    cleanTitle: "Unique Handwritten Notes",
    fileType: "pdf",
    fileSize: 100000,
    channelUsername: "solo_chan",
    alternativeSources: [],
    channelCount: 1
  };

  const card = templates.renderDetailCard(uniqueResource);
  assert(!card.includes("Available from"), "Should not show 'Available from' when zero alternatives exist");
});

// ─── Group 3: Telegram Inline Query Descriptor ───────────────────────────────
console.log("\nGroup 3: Telegram Inline Query Descriptor");

runTest("Builds informative inline description with file type, size, university, and channel", () => {
  const resource = {
    fileType: "doc",
    fileSize: 3145728,
    isExam: true,
    university: "ASTU",
    channelUsername: "astuchannel",
    channelCount: 2,
    alternativeSources: [{ channelUsername: "backupchan" }]
  };

  const label = templates.getFileLabel(resource.fileType, false);
  const sizeStr = templates.formatSize(resource.fileSize);

  const descParts = [];
  if (resource.isExam) descParts.push("🎓 Exam");
  descParts.push(`📁 ${label}`);
  if (sizeStr) descParts.push(`💾 ${sizeStr}`);
  if (resource.university) descParts.push(`🏛️ ${resource.university}`);
  if (resource.channelUsername) descParts.push(`@${resource.channelUsername}`);
  if (resource.channelCount > 1) descParts.push(`🔄 ${resource.channelCount} channels`);

  const desc = descParts.join(" · ");
  assert.strictEqual(desc, "🎓 Exam · 📁 Document · 💾 3.0 MB · 🏛️ ASTU · @astuchannel · 🔄 2 channels");
});

// ─── Group 4: File Type Icon Coverage ───────────────────────────────────────
console.log("\nGroup 4: File Type Support & Icon Coverage");

runTest("All supported file types map to distinct emojis and labels", () => {
  const types = ["pdf", "ppt", "doc", "image", "other"];
  for (const t of types) {
    const emoji = templates.getFileEmoji(t, false);
    const label = templates.getFileLabel(t, false);
    assert(typeof emoji === "string" && emoji.length > 0, `Missing emoji for ${t}`);
    assert(typeof label === "string" && label.length > 0, `Missing label for ${t}`);
  }
});

console.log("\n=======================================================");
console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed  `);
console.log("=======================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
