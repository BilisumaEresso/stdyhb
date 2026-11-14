require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function checkBundleGaps() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic'];

  for (const ch of channels) {
    // Check ungrouped docs that are close in messageId (diff <= 5) and have similar captions or sequential titles
    const docs = await TelegramResource.find({
      channelUsername: ch,
      fileType: { $in: ['pdf', 'ppt', 'doc', 'other'] },
      groupId: null,
      isAvailable: { $ne: false }
    }).sort({ messageId: 1 }).select('messageId fileName cleanTitle caption indexedAt');

    console.log(`\n=== @${ch}: ${docs.length} ungrouped documents ===`);
    let clusterCount = 0;
    for (let i = 0; i < docs.length - 1; i++) {
      const cur = docs[i];
      const next = docs[i + 1];
      const msgDiff = next.messageId - cur.messageId;
      if (msgDiff <= 4) {
        clusterCount++;
        if (clusterCount <= 10) {
          console.log(`  Candidate Pair (diff ${msgDiff}):`);
          console.log(`    Msg ${cur.messageId}: "${cur.cleanTitle}" | file: "${cur.fileName}"`);
          console.log(`    Msg ${next.messageId}: "${next.cleanTitle}" | file: "${next.fileName}"`);
          console.log(`    Cap1: ${(cur.caption || '').slice(0, 50)}`);
          console.log(`    Cap2: ${(next.caption || '').slice(0, 50)}`);
        }
      }
    }
    console.log(`  Total adjacent candidate pairs with msgDiff <= 4: ${clusterCount}`);
  }

  await mongoose.disconnect();
}
checkBundleGaps().catch(console.error);
