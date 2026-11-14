require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function checkUngroupedDetails() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic'];

  console.log("=== Target Channels Ungrouped Resources (Available Only) ===");
  for (const ch of channels) {
    const ungrouped = await TelegramResource.find({
      channelUsername: ch,
      groupId: null,
      isAvailable: { $ne: false }
    }).select('messageId fileName fileType cleanTitle caption').sort({ messageId: 1 }).lean();

    console.log(`\n@${ch}: ${ungrouped.length} ungrouped available resources`);
    
    // Check if any have adjacent messageIds (diff <= 2) and matching subject
    let candidateBundles = 0;
    for (let i = 0; i < ungrouped.length - 1; i++) {
      const cur = ungrouped[i];
      const next = ungrouped[i + 1];
      if (next.messageId - cur.messageId <= 2) {
        candidateBundles++;
        if (candidateBundles <= 5) {
          console.log(`  Candidate Pair (diff ${next.messageId - cur.messageId}):`);
          console.log(`    [A] msg ${cur.messageId} (${cur.fileType}): "${cur.cleanTitle}" | file: "${cur.fileName}"`);
          console.log(`    [B] msg ${next.messageId} (${next.fileType}): "${next.cleanTitle}" | file: "${next.fileName}"`);
        }
      }
    }
    console.log(`  Total adjacent pairs with diff <= 2: ${candidateBundles}`);
  }

  await mongoose.disconnect();
}
checkUngroupedDetails().catch(console.error);
