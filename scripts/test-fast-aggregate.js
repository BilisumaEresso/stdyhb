require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function testFast() {
  const t0 = Date.now();
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected in ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const duplicates = await TelegramResource.aggregate([
    {
      $match: {
        fileName: { $ne: "" },
        fileSize: { $gt: 0 },
        isAvailable: { $ne: false }
      }
    },
    {
      $group: {
        _id: { channelUsername: "$channelUsername", fileName: "$fileName", fileSize: "$fileSize" },
        count: { $sum: 1 },
        items: {
          $push: {
            id: "$_id",
            msgId: "$messageId",
            dl: "$downloadCount",
            grp: "$groupId",
            idx: "$groupIndex"
          }
        }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]).allowDiskUse(true);

  console.log(`Aggregation took ${Date.now() - t1}ms. Found ${duplicates.length} duplicate groups.`);
  
  let redundantCount = 0;
  duplicates.forEach(d => {
    redundantCount += (d.count - 1);
  });
  console.log(`Total redundant documents: ${redundantCount}`);

  // Test picking canonical for first 3
  duplicates.slice(0, 3).forEach(d => {
    console.log(`\nChannel: @${d._id.channelUsername} | File: "${d._id.fileName}" (${d._id.fileSize}B) | Copies: ${d.count}`);
    const sorted = d.items.sort((a, b) => {
      // 1. downloads
      if ((b.dl || 0) !== (a.dl || 0)) return (b.dl || 0) - (a.dl || 0);
      // 2. prefer groupIndex === 1 if grouped
      const aRep = (a.grp && a.idx === 1) ? 1 : 0;
      const bRep = (b.grp && b.idx === 1) ? 1 : 0;
      if (bRep !== aRep) return bRep - aRep;
      // 3. messageId desc (newest)
      return b.msgId - a.msgId;
    });
    console.log(`  Canonical to KEEP: msg ${sorted[0].msgId} (ID: ${sorted[0].id}, dl: ${sorted[0].dl})`);
    console.log(`  To HIDE (isAvailable: false): ${sorted.slice(1).map(x => `msg ${x.msgId} (ID: ${x.id})`).join(', ')}`);
  });

  await mongoose.disconnect();
}
testFast().catch(console.error);
