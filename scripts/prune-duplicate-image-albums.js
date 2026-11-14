require("dotenv").config();
const mongoose = require("mongoose");
const TelegramResource = require("../src/db/models/TelegramResource");

async function pruneDuplicateImageAlbums() {
  console.log("================================================================================");
  console.log("🚀 EXECUTING INTRA-CHANNEL DUPLICATE IMAGE ALBUM PRUNING");
  console.log("================================================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB Atlas");

  const albums = await TelegramResource.aggregate([
    {
      $match: {
        isAvailable: { $ne: false },
        fileType: "image",
        groupId: { $ne: null },
        groupIndex: 1,
        caption: { $exists: true, $ne: "" }
      }
    },
    {
      $group: {
        _id: {
          channelUsername: "$channelUsername",
          captionPrefix: {
            $substrCP: [
              { $toLower: { $trim: { input: "$caption" } } },
              0,
              60
            ]
          }
        },
        count: { $sum: 1 },
        groupIds: { $push: "$groupId" },
        msgIds: { $push: "$messageId" }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  console.log(`Found ${albums.length} duplicate image album groups.`);

  const redundantGroupIds = [];
  for (const a of albums) {
    // Keep the latest post (highest messageId) as canonical
    const sorted = a.groupIds.map((g, i) => ({ g, msg: a.msgIds[i] })).sort((x, y) => y.msg - x.msg);
    // Mark older groupIds as redundant
    for (let i = 1; i < sorted.length; i++) {
      redundantGroupIds.push(sorted[i].g);
    }
  }

  console.log(`Identified ${redundantGroupIds.length} redundant album groupIds to mark isAvailable: false.`);

  const res = await TelegramResource.updateMany(
    { groupId: { $in: redundantGroupIds }, isAvailable: { $ne: false } },
    { $set: { isAvailable: false } }
  );

  console.log(`✅ Successfully marked ${res.modifiedCount} duplicate album photo documents as isAvailable: false.`);

  await mongoose.disconnect();
  console.log("✅ Done!");
}
pruneDuplicateImageAlbums().catch(console.error);
