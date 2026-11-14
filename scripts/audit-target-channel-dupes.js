require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function auditTargetChannelDupes() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic'];

  for (const ch of channels) {
    const dupes = await TelegramResource.aggregate([
      {
        $match: {
          channelUsername: ch,
          isAvailable: { $ne: false },
          fileSize: { $gt: 0 },
          fileName: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            fileNameLower: { $toLower: { $trim: { input: "$fileName" } } },
            fileSize: "$fileSize"
          },
          count: { $sum: 1 },
          items: {
            $push: {
              _id: "$_id",
              msgId: "$messageId",
              groupId: "$groupId",
              fileType: "$fileType",
              title: "$cleanTitle"
            }
          }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`\n================================================================`);
    console.log(`@${ch}: ${dupes.length} duplicate file groups`);
    console.log(`================================================================`);
    let totalRedundant = 0;
    dupes.forEach(d => {
      totalRedundant += (d.count - 1);
    });
    console.log(`Total redundant duplicate copies in @${ch}: ${totalRedundant}`);

    console.log(`Top 5 duplicate files in @${ch}:`);
    dupes.slice(0, 5).forEach((d, idx) => {
      console.log(` [${idx + 1}] "${d._id.fileNameLower}" (${d._id.fileSize} bytes) - ${d.count} copies:`);
      d.items.forEach(it => {
        console.log(`     msg ${it.msgId} | grp: ${it.groupId} | "${it.title}"`);
      });
    });
  }

  await mongoose.disconnect();
}
auditTargetChannelDupes().catch(console.error);
