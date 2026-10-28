const assert = require("assert");
const templates = require("../src/telegram/templates");

console.log("=== Testing Feature 4: Direct 'View in Channel' Button & Links ===");

// 1. Test Detail Card Text HTML Link
const mockResourceWithChannel = {
  _id: "65b1234567890abcdef12345",
  fileName: "Compiler_Design_Exam_2023.pdf",
  fileType: "pdf",
  fileSize: 2048576,
  isExam: true,
  channelUsername: "aastu_software_engineering",
  messageId: 452
};

const cardHtml = templates.renderDetailCard(mockResourceWithChannel);
assert.ok(
  cardHtml.includes('<a href="https://t.me/aastu_software_engineering/452">@aastu_software_engineering</a>'),
  "Channel source must be an active HTML hyperlink"
);
console.log("✔ Detail card HTML source hyperlink verified");

// 2. Test Detail Card Text without messageId (channel root fallback)
const mockResourceNoMsgId = {
  _id: "65b1234567890abcdef12346",
  fileName: "Operating_Systems.pptx",
  fileType: "ppt",
  channelUsername: "ethio_study_materials"
};

const cardHtmlNoMsg = templates.renderDetailCard(mockResourceNoMsgId);
assert.ok(
  cardHtmlNoMsg.includes('<a href="https://t.me/ethio_study_materials">@ethio_study_materials</a>'),
  "Should link to channel root if messageId is omitted"
);
console.log("✔ Channel root fallback verified");

// 3. Test formatChannelUrl parsing logic
function formatChannelUrl(url, channelUsername, messageId) {
  if (channelUsername && messageId) {
    return `https://t.me/${channelUsername}/${messageId}`;
  }
  if (channelUsername) {
    return `https://t.me/${channelUsername}`;
  }
  if (url) {
    const match = url.match(/domain=([^&]+)(?:&post=(\d+))?/);
    if (match) {
      const ch = match[1];
      const msg = match[2];
      return msg ? `https://t.me/${ch}/${msg}` : `https://t.me/${ch}`;
    }
    if (url.startsWith("https://t.me/")) return url;
  }
  return null;
}

const url1 = formatChannelUrl(null, "my_channel", 123);
assert.strictEqual(url1, "https://t.me/my_channel/123");

const url2 = formatChannelUrl("tg://resolve?domain=test_channel&post=789", null, null);
assert.strictEqual(url2, "https://t.me/test_channel/789");

const url3 = formatChannelUrl("https://t.me/already_https/456", null, null);
assert.strictEqual(url3, "https://t.me/already_https/456");

const url4 = formatChannelUrl(null, null, null);
assert.strictEqual(url4, null, "Should return null if no channel info exists");
console.log("✔ formatChannelUrl transformation verified across all cases");

console.log("\nALL FEATURE 4 TESTS PASSED SUCCESSFULLY! 🚀");
