require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkDocs() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log("=== Checking Ungrouped Non-Images (PDF, PPT, DOC) in @keleme_2013 ===");
  const nonImages = await TelegramResource.find({
    channelUsername: "keleme_2013",
    fileType: { $ne: "image" },
    groupId: null
  })
    .sort({ messageId: 1 })
    .limit(100)
    .lean();

  console.log(`Found ${nonImages.length} sample ungrouped non-images.`);

  // Find consecutive messageIds or same timestamp
  for (let i = 0; i < nonImages.length - 1; i++) {
    const cur = nonImages[i];
    const next = nonImages[i + 1];

    const msgDiff = next.messageId - cur.messageId;
    const sameDate = cur.messageDate && next.messageDate &&
      Math.abs(new Date(cur.messageDate) - new Date(next.messageDate)) < 120000;

    if (msgDiff <= 3 && sameDate) {
      console.log(`Potential Bundle:`);
      console.log(`  Msg ${cur.messageId} (${cur.fileType}): "${cur.fileName}" | caption: "${(cur.caption || '').replace(/\r?\n/g, ' ').slice(0, 40)}" | date: ${cur.messageDate?.toISOString()}`);
      console.log(`  Msg ${next.messageId} (${next.fileType}): "${next.fileName}" | caption: "${(next.caption || '').replace(/\r?\n/g, ' ').slice(0, 40)}" | date: ${next.messageDate?.toISOString()}`);
    }
  }

  await mongoose.disconnect();
}
checkDocs().catch(console.error);
