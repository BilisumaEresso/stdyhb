require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function verifyTargetChannels() {
  await mongoose.connect(process.env.MONGO_URI);
  const channels = ['freshman_materials', 'keleme_2013', 'ethioacadamic'];

  console.log("=== Target Channels Duplicate Audit After Prune ===");
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
          _id: { fileName: "$fileName", fileSize: "$fileSize" },
          count: { $sum: 1 },
          items: { $push: { id: "$_id", msg: "$messageId", title: "$cleanTitle" } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    console.log(`@${ch}: ${dupes.length} duplicate file groups remaining.`);
    if (dupes.length > 0) {
      dupes.slice(0, 5).forEach(d => {
        console.log(`  "${d._id.fileName}" (${d._id.fileSize}B) - ${d.count} copies:`);
        d.items.forEach(it => console.log(`    msg ${it.msg} | "${it.title}"`));
      });
    }
  }

  // Check photo album duplicates in these channels
  console.log("\n=== Checking Image Albums with Same Captions in Target Channels ===");
  for (const ch of channels) {
    const albumDupes = await TelegramResource.aggregate([
      {
        $match: {
          channelUsername: ch,
          isAvailable: { $ne: false },
          fileType: "image",
          groupIndex: 1,
          caption: { $exists: true, $ne: "" }
        }
      },
      {
        $group: {
          _id: {
            cleanCap: {
              $substrCP: [
                { $toLower: { $trim: { input: "$caption" } } },
                0,
                50
              ]
            }
          },
          count: { $sum: 1 },
          items: { $push: { id: "$_id", msg: "$messageId", groupId: "$groupId", title: "$cleanTitle" } }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);
    console.log(`@${ch}: ${albumDupes.length} image album duplicate caption groups.`);
    albumDupes.slice(0, 3).forEach(ad => {
      console.log(`  "${ad._id.cleanCap.replace(/\r?\n/g, ' ')}" - ${ad.count} albums:`);
      ad.items.forEach(it => console.log(`    msg ${it.msg} | grp: ${it.groupId} | "${it.title}"`));
    });
  }

  await mongoose.disconnect();
}
verifyTargetChannels().catch(console.error);
