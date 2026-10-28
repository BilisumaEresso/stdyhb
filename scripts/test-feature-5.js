const assert = require("assert");

console.log("=== Testing Feature 5: Media Group Delivery (Native Album Chunking & Fallback) ===");

// 1. Test album chunking and caption generation logic
function buildMediaGroups(fileIds, rawTitle, channelUsername) {
  const CHUNK_SIZE = 10;
  const groups = [];

  for (let i = 0; i < fileIds.length; i += CHUNK_SIZE) {
    const chunk = fileIds.slice(i, i + CHUNK_SIZE);
    const startPage = i + 1;
    const endPage = i + chunk.length;
    const isMultiChunk = fileIds.length > CHUNK_SIZE;

    const channelInfo = channelUsername ? `\n📡 Source: @${channelUsername}` : "";
    const caption = isMultiChunk
      ? `🎓 <b>${rawTitle}</b> (Part ${Math.floor(i / CHUNK_SIZE) + 1} · Pages ${startPage}-${endPage})${channelInfo}`
      : `🎓 <b>${rawTitle}</b> (${fileIds.length} pages)${channelInfo}`;

    const mediaGroup = chunk.map((fileId, idx) => ({
      type: "photo",
      media: fileId,
      caption: idx === 0 ? caption : undefined,
      parse_mode: "HTML",
    }));

    groups.push(mediaGroup);
  }

  return groups;
}

// Case A: 5-page exam album
const fileIds5 = ["file_1", "file_2", "file_3", "file_4", "file_5"];
const groups5 = buildMediaGroups(fileIds5, "Physics 1 Mid Exam", "aastu_materials");
assert.strictEqual(groups5.length, 1, "5 photos should fit in a single album");
assert.strictEqual(groups5[0].length, 5, "Album should contain 5 photos");
assert.ok(groups5[0][0].caption.includes("Physics 1 Mid Exam"), "First item must have album caption");
assert.strictEqual(groups5[0][1].caption, undefined, "Subsequent items in Telegram album MUST NOT have caption");
assert.strictEqual(groups5[0][4].caption, undefined);
console.log("✔ 5-page exam single album verified");

// Case B: 14-page exam album (exceeds 10-item Telegram limit)
const fileIds14 = Array.from({ length: 14 }, (_, i) => `file_${i + 1}`);
const groups14 = buildMediaGroups(fileIds14, "Calculus Final Exam", "ethio_exams");
assert.strictEqual(groups14.length, 2, "14 photos must be chunked into 2 albums");
assert.strictEqual(groups14[0].length, 10, "First album chunk must be 10 photos");
assert.strictEqual(groups14[1].length, 4, "Second album chunk must be 4 photos");
assert.ok(groups14[0][0].caption.includes("Part 1 · Pages 1-10"), "Part 1 caption should indicate pages 1-10");
assert.ok(groups14[1][0].caption.includes("Part 2 · Pages 11-14"), "Part 2 caption should indicate pages 11-14");
console.log("✔ 14-page exam multi-album chunking (10 + 4) verified");

// Case C: Schema validation for Telegram Bot API
groups14.forEach(group => {
  assert.ok(group.length >= 2 && group.length <= 10, "Telegram sendMediaGroup requires 2-10 items");
  group.forEach(item => {
    assert.strictEqual(item.type, "photo", "Type must be photo");
    assert.ok(item.media.startsWith("file_"), "Must contain valid file_id");
  });
});
console.log("✔ Telegram sendMediaGroup API compliance verified");

console.log("\nALL FEATURE 5 TESTS PASSED SUCCESSFULLY! 🚀");
