require('dotenv').config();
const mongoose = require('mongoose');
const TelegramResource = require('../src/db/models/TelegramResource');

async function inspectDuplicates() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const dupes = await TelegramResource.aggregate([
    {
      $match: {
        isAvailable: { $ne: false },
        fileSize: { $gt: 0 },
        fileName: { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: {
          channel: "$channelUsername",
          fileSize: "$fileSize",
          fileNameLower: { $toLower: { $trim: { input: "$fileName" } } }
        },
        count: { $sum: 1 },
        ids: { $push: "$_id" },
        msgIds: { $push: "$messageId" },
        dates: { $push: "$messageDate" },
        downloads: { $push: "$downloadCount" },
        groupIds: { $push: "$groupId" }
      }
    },
    { $match: { count: { $gt: 2 } } },
    { $limit: 10 }
  ]);

  console.log(`Sample intra-channel duplicates with count > 2:`);
  dupes.forEach(d => {
    console.log(`\nChannel: @${d._id.channel} | File: "${d._id.fileNameLower}" | Size: ${d._id.fileSize} | Count: ${d.count}`);
    for (let i = 0; i < d.ids.length; i++) {
      console.log(`  [${i+1}] ID: ${d.ids[i]} | msgId: ${d.msgIds[i]} | date: ${d.dates[i]} | downloads: ${d.downloads[i]} | groupId: ${d.groupIds[i]}`);
    }
  });

  await mongoose.disconnect();
}
inspectDuplicates().catch(console.error);
