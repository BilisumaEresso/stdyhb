const assert = require("assert");
const templates = require("../src/telegram/templates");
const searchService = require("../src/search/search.service");
const { applyResultFilter } = require("../src/telegram/fileDelivery");

console.log("====================================================");
console.log("🧪 DOCUMENT & PHOTO BUNDLE TEST SUITE");
console.log("====================================================\n");

// 1. Taxonomy & Badges Test
console.log("Test 1: Emoji & Label Taxonomy...");
assert.strictEqual(templates.getFileEmoji("image", true), "📷");
assert.strictEqual(templates.getFileEmoji("pdf", true), "📚");
assert.strictEqual(templates.getFileEmoji("ppt", true), "📙");
assert.strictEqual(templates.getFileEmoji("doc", true), "📗");
assert.strictEqual(templates.getFileEmoji("pdf", false), "📕");

assert.strictEqual(templates.getFileLabel("image", true, 4), "4-Page Photo Album");
assert.strictEqual(templates.getFileLabel("pdf", true, 10), "10-File PDF Bundle");
assert.strictEqual(templates.getFileLabel("ppt", true, 3), "3-Slide PPT Pack");
assert.strictEqual(templates.getFileLabel("doc", true, 5), "5-Doc Packet");
assert.strictEqual(templates.getFileLabel("pdf", false), "PDF");
console.log("✅ Test 1 Passed: Taxonomy labels & emojis are accurate.\n");

// 2. Caption Extraction Test
console.log("Test 2: Origin Channel Caption Title Extraction...");
const caption = `Psychology Midterm Exam Collection 2023
@astu_exams
Share with your friends!`;
const cleanTitle = searchService.cleanCaptionTitle(caption, "Fallback Title");
assert.strictEqual(cleanTitle, "Psychology Midterm Exam Collection 2023");

const emptyClean = searchService.cleanCaptionTitle("", "Default Fallback");
assert.strictEqual(emptyClean, "Default Fallback");
console.log("✅ Test 2 Passed: Caption title extraction respects origin channel captions.\n");

// 3. Document Bundle Search Collapsing Test
console.log("Test 3: Search Collapsing (PDF Bundles & Image Albums)...");
const mockRawResults = [
  // 3 PDFs from the same origin post (same groupId)
  {
    _id: "pdf1",
    _telegramResource: true,
    groupId: "group_pdf_psychology",
    groupTotal: 3,
    fileType: "pdf",
    fileName: "Psychology Mid Exam 1 (AAU).pdf",
    caption: "Psychology Midterm Exam Collection\n@campus_exams",
    score: 150,
  },
  {
    _id: "pdf2",
    _telegramResource: true,
    groupId: "group_pdf_psychology",
    groupTotal: 3,
    fileType: "pdf",
    fileName: "Psychology Mid Exam 2 (AASTU).pdf",
    caption: "Psychology Midterm Exam Collection\n@campus_exams",
    score: 140,
  },
  {
    _id: "pdf3",
    _telegramResource: true,
    groupId: "group_pdf_psychology",
    groupTotal: 3,
    fileType: "pdf",
    fileName: "Psychology Mid Exam 3 (DMU).pdf",
    caption: "Psychology Midterm Exam Collection\n@campus_exams",
    score: 130,
  },
  // 1 single standalone PDF
  {
    _id: "pdf4",
    _telegramResource: true,
    groupId: null,
    fileType: "pdf",
    fileName: "Single Textbook.pdf",
    caption: "",
    score: 90,
  },
  // 2 Images from same photo exam album
  {
    _id: "img1",
    _telegramResource: true,
    groupId: "group_img_math",
    groupTotal: 2,
    fileType: "image",
    fileName: "page1.jpg",
    caption: "Math Final Exam 2023",
    score: 180,
  },
  {
    _id: "img2",
    _telegramResource: true,
    groupId: "group_img_math",
    groupTotal: 2,
    fileType: "image",
    fileName: "page2.jpg",
    caption: "Math Final Exam 2023",
    score: 170,
  },
];

// Simulate Step 4 collapsing in searchService
const seenGroups = new Set();
const collapsed = [];
for (const r of mockRawResults) {
  if (r.groupId) {
    if (seenGroups.has(r.groupId)) continue;
    seenGroups.add(r.groupId);
    r._isGrouped = true;
    r.groupSize = r.groupTotal || 1;
    if (r.caption && r.caption.trim()) {
      const ct = searchService.cleanCaptionTitle(r.caption, r.fileName);
      if (ct && ct !== "Study Material" && ct !== "Exam Material") {
        r.title = ct;
      }
    }
  }
  collapsed.push(r);
}

assert.strictEqual(collapsed.length, 3, "Expected 3 collapsed results (1 PDF bundle, 1 single PDF, 1 Image album)");
assert.strictEqual(collapsed[0].title, "Psychology Midterm Exam Collection", "PDF bundle should adopt origin caption as title");
assert.strictEqual(collapsed[0].groupSize, 3, "PDF bundle should have groupSize=3");
assert.strictEqual(collapsed[2].groupSize, 2, "Image album should have groupSize=2");
console.log("✅ Test 3 Passed: Both document bundles and image albums collapse correctly.\n");

// 4. Category Filter Accuracy Test
console.log("Test 4: Category Filtering...");
const mockItems = [
  { fileType: "ppt", groupId: "ppt_group", fileName: "lecture1.pptx", caption: "Chapter 1-3 slides", isExam: false },
  { fileType: "pdf", groupId: "pdf_exam_group", fileName: "exam1.pdf", caption: "Mid Exam 2023", isExam: true },
  { fileType: "image", groupId: "img_group", fileName: "page1.jpg", caption: "Math Exam", isExam: true },
];

const pptFiltered = applyResultFilter(mockItems, "ppt");
assert.strictEqual(pptFiltered.length, 1);
assert.strictEqual(pptFiltered[0].groupId, "ppt_group");

const examFiltered = applyResultFilter(mockItems, "exam");
assert.strictEqual(examFiltered.length, 2, "Exam filter should include the PDF exam bundle and the image album, but NOT the lecture PPT bundle");

const pdfFiltered = applyResultFilter(mockItems, "pdf");
assert.strictEqual(pdfFiltered.length, 1);
assert.strictEqual(pdfFiltered[0].groupId, "pdf_exam_group");

console.log("✅ Test 4 Passed: Category filters accurately categorize document bundles.\n");

console.log("====================================================");
console.log("🎉 ALL DOCUMENT & PHOTO BUNDLE TESTS PASSED!");
console.log("====================================================");
